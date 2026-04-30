import type { Maybe } from "@thi.ng/api";
import { ARG_DRY_RUN, string, type Command } from "@thi.ng/args";
import { compareByKey } from "@thi.ng/compare";
import {
	float,
	parseCSVFromString,
	type CellTransform,
	type ColumnSpec,
	type ColumnSpecs,
} from "@thi.ng/csv";
import { FMT_yyyyMMdd } from "@thi.ng/date";
import { illegalArgs, illegalState } from "@thi.ng/errors";
import { bufferHash, readJSON, readText, writeJSON } from "@thi.ng/file-io";
import {
	assocObj,
	comp,
	filter,
	map,
	mapcat,
	pairs,
	push,
	transduce,
} from "@thi.ng/transducers";
import type {
	AppCtx,
	CommonOpts,
	HashableTransaction,
	Transaction,
} from "../api.js";
import { ARG_DB } from "../args.js";

interface ImportOpts extends CommonOpts {
	db: string;
	dryRun: boolean;
	spec: string;
}

export const IMPORT: Command<ImportOpts, CommonOpts, AppCtx<ImportOpts>> = {
	desc: "Import transactions from CSV using provided import spec",
	opts: {
		...ARG_DB,
		...ARG_DRY_RUN,
		spec: string({
			alias: "s",
			desc: "Import spec (TX defaults & CSV column mappings/transforms)",
			required: true,
		}),
	},
	fn: command,
};

interface ImportSpec {
	delim?: string;
	defaults: Partial<Transaction>;
	columns: Record<string, ImportColumnSpec>;
}

interface ImportColumnSpec {
	alias: string;
	tx?: string;
	default?: any;
}

async function command(ctx: AppCtx<ImportOpts>) {
	const spec = readJSON<ImportSpec>(ctx.opts.spec, ctx.logger);
	const columns = compileColumnSpecs(spec.columns);
	let db: Transaction[] = [];
	try {
		db = readJSON<Transaction[]>(ctx.opts.db, ctx.logger);
	} catch (e) {
		ctx.logger.warn(`couldn't load DB, creating new one...`);
	}
	const index = new Set(db.map((x) => x.hash));
	const delta = db.length - index.size;
	if (delta) illegalState(`DB contains ${delta} duplicate transactions`);
	try {
		const tx = transduce(
			comp(
				mapcat((path) => parseFile(ctx, path, columns, spec.delim)),
				map((tx) => <HashableTransaction>{ ...spec.defaults, ...tx }),
				map(injectHash),
				filter((tx) => {
					if (index.has(tx.hash)) {
						ctx.logger.debug(
							`skipping duplicate tx: ${JSON.stringify(tx)}`
						);
						return false;
					}
					index.add(tx.hash);
					return true;
				})
			),
			push<Transaction>(),
			ctx.inputs
		);
		if (!tx.length) {
			ctx.logger.info("no new transactions imported...");
			return;
		}
		ctx.logger.info(`adding ${tx.length} new transactions`);
		db = db.concat(tx).sort(compareByKey("date"));
		writeJSON(ctx.opts.db, db, null, 4, ctx.logger, ctx.opts.dryRun);
	} catch (e) {
		console.log(e);
	}
}

const compileColumnSpecs = (rules: Record<string, ImportColumnSpec>) =>
	transduce(
		map(([k, v]) => {
			let tx: Maybe<CellTransform>;
			if (v.tx) {
				tx = KNOWN_TRANSFORMS[v.tx];
				if (!tx)
					illegalArgs(`column '${k}' unknown transform ID: ${v.tx}`);
			}
			return <[string, ColumnSpec]>[k, { ...v, tx }];
		}),
		assocObj<ColumnSpec>(),
		pairs(rules)
	);

const parseFile = (
	ctx: AppCtx<ImportOpts>,
	path: string,
	cols: ColumnSpecs,
	delim?: string
) =>
	parseCSVFromString({ all: false, cols, delim }, readText(path, ctx.logger));

const injectHash = (tx: HashableTransaction) => {
	const $tx = <Transaction>tx;
	$tx.hash = hashTransaction(tx);
	return $tx;
};

const hashTransaction = (tx: HashableTransaction) =>
	bufferHash(
		[
			tx.accountA,
			tx.accountB,
			tx.date,
			tx.desc,
			tx.ref,
			tx.amount,
			tx.currencyA,
			tx.currencyB,
		].join("|"),
		undefined,
		"sha256"
	);

const KNOWN_TRANSFORMS: Record<string, CellTransform> = {
	amount: (x) => parseInt(x.replace(/[.,]/g, "")),
	clean: (x) => x.replace(/\s+/g, " "),
	date_ddmmyy: (x) => {
		x = x.split(" ")[0];
		const parts = x.split(/[./-]/g).map((x) => +x);
		if (!parts.every(isFinite)) illegalArgs(`invalid date: ${x}`);
		let [d, m, y] = parts;
		if (y < 2000) y = 2000 + y;
		return FMT_yyyyMMdd(new Date(Date.UTC(y, m - 1, d)));
	},
	rate: float(1),
};

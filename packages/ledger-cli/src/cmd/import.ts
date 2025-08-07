import type { Maybe } from "@thi.ng/api";
import { ARG_DRY_RUN, string, type Args, type Command } from "@thi.ng/args";
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
	rules: string;
}

export const IMPORT: Command<ImportOpts, CommonOpts, AppCtx<ImportOpts>> = {
	desc: "Import transactions from CSV",
	opts: <Args<ImportOpts>>{
		...ARG_DB,
		...ARG_DRY_RUN,
		rules: string({
			alias: "r",
			desc: "Import rules (CSV column transforms)",
			optional: false,
		}),
	},
	fn: command,
};

export interface ImportColumnSpec extends ColumnSpec {
	alias: string;
	default?: any;
}

async function command(ctx: AppCtx<ImportOpts>) {
	const rules = compileRules(readJSON(ctx.opts.rules, ctx.logger));
	let db: Transaction[] = [];
	try {
		db = readJSON<Transaction[]>(ctx.opts.db, ctx.logger);
	} catch (e) {
		ctx.logger.warn(`couldn't load DB, creating new one...`);
	}
	const index = new Set(db.map((x) => x.hash));
	const delta = db.length - index.size;
	if (delta) illegalState(`DB contains ${delta} duplicate transactions`);
	const tx = transduce(
		comp(
			mapcat((path) => parseFile(ctx, path, rules)),
			map((tx) => {
				tx.hash = hashTransaction(<HashableTransaction>tx);
				return <Transaction>tx;
			}),
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
}

const compileRules = (rules: Record<string, any>) =>
	transduce(
		map(([k, v]) => {
			let tx: Maybe<CellTransform>;
			if (v.tx) {
				tx = KNOWN_TRANSFORMS[v.tx];
				if (!tx)
					illegalArgs(`column '${k}' unknown transform ID: ${v.tx}`);
			}
			return <[string, ImportColumnSpec]>[k, { ...v, tx }];
		}),
		assocObj<ImportColumnSpec>(),
		pairs(rules)
	);

const parseFile = (ctx: AppCtx<ImportOpts>, path: string, rules: ColumnSpecs) =>
	parseCSVFromString(
		{
			all: false,
			cols: rules,
		},
		readText(path, ctx.logger)
	);

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

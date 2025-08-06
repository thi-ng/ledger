import type { Maybe } from "@thi.ng/api";
import { string, type Args, type Command } from "@thi.ng/args";
import { compareByKey } from "@thi.ng/compare";
import {
	parseCSVFromString,
	type CellTransform,
	type ColumnSpec,
	type ColumnSpecs,
} from "@thi.ng/csv";
import { FMT_yyyyMMdd } from "@thi.ng/date";
import { illegalArgs } from "@thi.ng/errors";
import { bufferHash, readJSON, readText, writeJSON } from "@thi.ng/file-io";
import {
	assocObj,
	comp,
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
import { ARG_DB, ARG_DRY_RUN } from "../args.js";

interface ImportOpts extends CommonOpts {
	db: string;
	dryRun: boolean;
	rules: string;
}

export const IMPORT: Command<ImportOpts, CommonOpts, AppCtx<ImportOpts>> = {
	desc: "Import transactions from CSV",
	opts: <Args<ImportOpts>>{
		...ARG_DRY_RUN,
		...ARG_DB,
		rules: string({
			alias: "r",
			desc: "Import rules (CSV column transforms)",
			optional: false,
		}),
	},
	fn: command,
};

async function command(ctx: AppCtx<ImportOpts>) {
	const rules = compileRules(readJSON(ctx.opts.rules, ctx.logger));
	const tx = transduce(
		comp(
			mapcat((path) => parseFile(ctx, path, rules)),
			map((tx) => {
				tx.hash = hashTransaction(<HashableTransaction>tx);
				return <Transaction>tx;
			})
		),
		push<Transaction>(),
		ctx.inputs
	);
	tx.sort(compareByKey("date"));
	writeJSON(ctx.opts.db, tx, null, 4, ctx.logger);
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
			return <[string, ColumnSpec]>[k, { alias: v.alias, tx }];
		}),
		assocObj<ColumnSpec>(),
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
			tx.currency,
		].join("|"),
		undefined,
		"sha256"
	);

const KNOWN_TRANSFORMS: Record<string, CellTransform> = {
	shortDate: (x) => {
		const [d, m, y] = x.split(/[./]/g);
		return FMT_yyyyMMdd(new Date(Date.UTC(2000 + +y, +m - 1, +d)));
	},
	amount: (x) => parseInt(x.replace(/[.,]/g, "")),
	clean: (x) => x.replace(/\s+/g, " "),
};

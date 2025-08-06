import { string, type Args, type Command } from "@thi.ng/args";
import { readJSON, writeJSON } from "@thi.ng/file-io";
import { ENV, evalSource } from "@thi.ng/lispy";
import type {
	AppCtx,
	ClassifierSpec,
	CommonOpts,
	Entry,
	Transaction,
} from "../api.js";
import { ARG_DB, ARG_JOURNAL } from "../args.js";

interface ClassifyOpts extends CommonOpts {
	db: string;
	journal: string;
	rules: string;
}

export const CLASSIFY: Command<
	ClassifyOpts,
	CommonOpts,
	AppCtx<ClassifyOpts>
> = {
	desc: "Classify transactions",
	opts: <Args<ClassifyOpts>>{
		...ARG_DB,
		...ARG_JOURNAL,
		rules: string({
			alias: "r",
			desc: "Classifier rules",
			optional: false,
		}),
	},
	inputs: 0,
	fn: command,
};

async function command(ctx: AppCtx<ClassifyOpts>) {
	const spec = readJSON<ClassifierSpec>(ctx.opts.rules, ctx.logger);
	const db = readJSON(ctx.opts.db, ctx.logger);
	const entries: Entry[] = [];
	for (let tx of db) {
		const entry = classifyTransaction(ctx, tx, spec);
		if (entry) entries.push(entry);
	}
	writeJSON(ctx.opts.journal, entries, null, 4, ctx.logger);
}

const classifyTransaction = (
	ctx: AppCtx<ClassifyOpts>,
	tx: Transaction,
	{ defaults, rules }: ClassifierSpec
) => {
	const entry = <Entry>{
		date: tx.date,
		desc: tx.desc,
		amount: tx.amount,
		currency: tx.currency,
		...defaults,
	};
	let isClassified = false;
	for (let rule of rules) {
		const result = evalSource(
			rule.if,
			{
				...ENV,

				// extend/override DSL default builtins
				// see: https://thi.ng/lispy for details

				accountA: tx.accountA,
				accountB: tx.accountB,
				desc: tx.desc.toLowerCase(),
				payee: tx.payee.toLowerCase(),
				payeeID: tx.payeeID,
				type: tx.type.toLowerCase(),

				contains: (field: string, ...args: string[]) => {
					return args.some((x) => field.includes(x));
				},

				match: (field: string, ...args: string[]) => {
					return args.some((x) => new RegExp(x, "i").test(field));
				},
			},
			{ string: "'" }
		);
		if (result) {
			ctx.logger.debug(rule.then, tx.payee);
			Object.assign(entry, rule.then);
			isClassified = true;
			break;
		}
	}
	if (!isClassified) {
		ctx.logger.warn("unclassified", tx.date, tx.amount, tx.payee, tx.desc);
	}
	return entry;
};

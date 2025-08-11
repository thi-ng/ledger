import { ARG_DRY_RUN, strings, type Args, type Command } from "@thi.ng/args";
import { readJSON, readJSONAsync, writeJSON } from "@thi.ng/file-io";
import { ENV, evalSource } from "@thi.ng/lispy";
import { comp, keep, mapcat, push, transduce } from "@thi.ng/transducers";
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
	dryRun: boolean;
	journal: string;
	rules: string[];
}

export const CLASSIFY: Command<
	ClassifyOpts,
	CommonOpts,
	AppCtx<ClassifyOpts>
> = {
	desc: "Classify transactions using provided rules & filters",
	opts: <Args<ClassifyOpts>>{
		...ARG_DB,
		...ARG_DRY_RUN,
		...ARG_JOURNAL,
		rules: strings({
			alias: "r",
			desc: "Classifier rules",
			optional: false,
		}),
	},
	inputs: 0,
	fn: command,
};

async function command(ctx: AppCtx<ClassifyOpts>) {
	const specs = await Promise.all(
		ctx.opts.rules.map((path) =>
			readJSONAsync<ClassifierSpec>(path, ctx.logger)
		)
	);
	const db = readJSON<Transaction[]>(ctx.opts.db, ctx.logger);
	const entries = transduce(
		comp(
			mapcat((tx) =>
				specs.map((spec) => classifyTransaction(ctx, tx, spec))
			),
			keep()
		),
		push<Entry>(),
		db
	);
	writeJSON(ctx.opts.journal, entries, null, 4, ctx.logger, ctx.opts.dryRun);
}

const classifyTransaction = (
	ctx: AppCtx<ClassifyOpts>,
	tx: Transaction,
	{ accountA, defaults, rules }: ClassifierSpec
) => {
	if (tx.accountA !== accountA) {
		ctx.logger.debug("skipping non-matching tx", tx);
		return;
	}
	const entry = <Entry>{
		date: tx.date,
		desc: tx.desc,
		amount: tx.amount,
		currency: tx.currencyA,
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
				currencyA: tx.currencyA,
				currencyB: tx.currencyB,
				amount: tx.amount,
				rate: tx.rate,
				desc: tx.desc.toLowerCase(),
				ref: tx.ref.toLowerCase(),
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
			ctx.logger.debug(rule.then, tx.payee, tx.amount);
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

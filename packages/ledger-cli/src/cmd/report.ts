import { string, type Args, type Command } from "@thi.ng/args";
import { readJSON } from "@thi.ng/file-io";
import { table, type Row } from "@thi.ng/markdown-table";
import type { AppCtx, CommonOpts, Entry } from "../api.js";
import { ARG_JOURNAL } from "../args.js";

interface ReportOpts extends CommonOpts {
	journal: string;
	from: string;
	to: string;
}

export const REPORT: Command<ReportOpts, CommonOpts, AppCtx<ReportOpts>> = {
	desc: "TODO.",
	opts: <Args<ReportOpts>>{
		...ARG_JOURNAL,
		from: string({
			desc: "start date",
		}),
		to: string({
			desc: "end date",
		}),
	},
	fn: command,
};

async function command({ inputs, opts, logger }: AppCtx<ReportOpts>) {
	const entries = readJSON<Entry[]>(opts.journal, logger);
	const balances = computeBalances(entries, {
		filters: inputs,
		from: opts.from,
		to: opts.to,
	});
	const rows: Row[] = [];
	for (let k of Object.keys(balances).sort()) {
		const bal = balances[k];
		rows.push([k, (bal.amount / 100).toFixed(2), bal.curr, bal.num]);
	}
	console.log(
		table(["Balance", "Amount", "Currency", "TX count"], rows, {
			align: ["l", "r", "l", "r"],
		})
	);
}

export interface ComputeBalanceOpts {
	filters: string[];
	from: string;
	to: string;
}

export const computeBalances = (
	entries: Entry[],
	opts: Partial<ComputeBalanceOpts>
) => {
	const balances: Record<
		string,
		{ amount: number; curr: string; num: number }
	> = {};

	const ensureBalance = (id: string, curr: string) =>
		balances[id] ?? (balances[id] = { curr, amount: 0, num: 0 });

	for (let entry of entries) {
		if (!includeEntry(entry, opts)) continue;
		const a = ensureBalance(entry.accountA, entry.currency);
		const b = ensureBalance(entry.accountB, entry.currency);
		a.amount += entry.amount;
		b.amount -= entry.amount;
		a.num++;
		b.num++;
	}
	return balances;
};

const includeEntry = (
	entry: Entry,
	{ filters, from, to }: Partial<ComputeBalanceOpts>
): boolean => {
	if (filters?.length && !filters.some((f) => entry.accountB.startsWith(f)))
		return false;
	if (from && entry.date < from) return false;
	if (to && entry.date > to) return false;
	return true;
};

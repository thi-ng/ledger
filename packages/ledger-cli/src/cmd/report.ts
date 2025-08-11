import { string, type Args, type Command } from "@thi.ng/args";
import { readJSON } from "@thi.ng/file-io";
import { table, type Row } from "@thi.ng/markdown-table";
import { defMultiTrie } from "@thi.ng/trie";
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
	const keys = Object.keys(balances).sort();
	const trie = defMultiTrie(
		keys.map((k) => <const>[k.split(":"), balances[k].amount])
	);
	const seen = new Set<string>();
	const rows: Row[] = [];
	for (let k of keys) {
		const parts = k.split(":");
		for (let i = 0; i < parts.length; i++) {
			const currParts = parts.slice(0, i + 1);
			const currKey = currParts.join(":");
			if (inputs.length && !inputs.some((x) => currKey.startsWith(x)))
				continue;
			if (seen.has(currKey)) continue;
			const children = [...trie.values(currParts)];
			const sum = children.length
				? children.reduce((a, b) => a + b, 0)
				: balances[currKey].amount;
			const num = children.length
				? [...trie.keys(currParts)].reduce(
						(a, k) => a + balances[k.join(":")].num,
						0
				  )
				: balances[currKey].num;
			rows.push([currKey, (sum / 100).toFixed(2), balances[k].curr, num]);
			seen.add(currKey);
		}
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

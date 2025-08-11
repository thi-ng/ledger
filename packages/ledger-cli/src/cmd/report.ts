import { identity, type Nullable } from "@thi.ng/api";
import { oneOf, string, strings, type Args, type Command } from "@thi.ng/args";
import { formatCSVString } from "@thi.ng/csv";
import { defmulti } from "@thi.ng/defmulti";
import { readJSON } from "@thi.ng/file-io";
import { table, type Row } from "@thi.ng/markdown-table";
import { defMultiTrie } from "@thi.ng/trie";
import {
	CURRENCY_DIGITS,
	type AppCtx,
	type CommonOpts,
	type Entry,
} from "../api.js";
import { ARG_JOURNAL } from "../args.js";

interface ReportOpts extends CommonOpts {
	journal: string;
	fmt: "csv" | "json" | "md";
	from: string;
	to: string;
	include: string[];
}

export const REPORT: Command<ReportOpts, CommonOpts, AppCtx<ReportOpts>> = {
	desc: "Produce balance reports (optionally filtered) in different formats",
	opts: <Args<ReportOpts>>{
		...ARG_JOURNAL,
		fmt: oneOf(["csv", "json", "md"], {
			alias: "f",
			desc: "Output format",
			default: "md",
		}),
		include: strings({
			alias: "i",
			desc: "Only include given balance ID",
			hint: "NAME",
			group: "filters",
		}),
		from: string({
			desc: "Start date (yyyy-MM-dd format)",
			hint: "DATE",
			group: "filters",
		}),
		to: string({
			desc: "End date (yyyy-MM-dd format)",
			hint: "DATE",
			group: "filters",
		}),
	},
	fn: command,
};

async function command({ opts, logger }: AppCtx<ReportOpts>) {
	const entries = readJSON<Entry[]>(opts.journal, logger);
	const balances = computeBalances(entries, {
		filters: opts.include,
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
		const keyParts = k.split(":");
		for (let i = 0; i < keyParts.length; i++) {
			const subParts = keyParts.slice(0, i + 1);
			const subKey = subParts.join(":");
			if (!includeName(opts.include, subKey)) continue;
			if (seen.has(subKey)) continue;
			const children = [...trie.values(subParts)];
			const sum = children.length
				? children.reduce((a, b) => a + b, 0)
				: balances[subKey].amount;
			const num = children.length
				? [...trie.keys(subParts)].reduce(
						(a, k) => a + balances[k.join(":")].num,
						0
				  )
				: balances[subKey].num;
			const currency = balances[k].currency;
			rows.push([
				subKey,
				(sum / 100).toFixed(CURRENCY_DIGITS[currency] ?? 2),
				currency,
				num,
			]);
			seen.add(subKey);
		}
	}
	outputRows(opts.fmt, rows);
}

const outputRows = defmulti<ReportOpts["fmt"], Row[], void>(
	identity,
	{},
	{
		csv: (_, rows) => {
			console.log(
				formatCSVString(
					{ header: ["Balance", "Amount", "Currency", "TX count"] },
					rows
				)
			);
		},
		json: (_, rows) => {
			console.log(
				JSON.stringify(
					rows.map((x) => ({
						id: x[0],
						amount: x[1],
						currency: x[2],
						count: x[3],
					})),
					null,
					4
				)
			);
		},
		md: (_, rows) => {
			console.log(
				table(["Balance", "Amount", "Currency", "TX count"], rows, {
					align: ["l", "r", "l", "r"],
				})
			);
		},
	}
);

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
		{ amount: number; currency: string; num: number }
	> = {};

	const ensureBalance = (id: string, currency: string) =>
		balances[id] ?? (balances[id] = { currency, amount: 0, num: 0 });

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
	if (!includeName(filters, entry.accountB)) return false;
	if (from && entry.date < from) return false;
	if (to && entry.date > to) return false;
	return true;
};

const includeName = (filters: Nullable<string[]>, name: string) =>
	!filters?.length || filters.some((f) => name.startsWith(f));

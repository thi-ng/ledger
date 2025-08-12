import { identity, type Nullable } from "@thi.ng/api";
import {
	flag,
	oneOf,
	string,
	strings,
	type Args,
	type Command,
} from "@thi.ng/args";
import { formatCSVString } from "@thi.ng/csv";
import { defmulti } from "@thi.ng/defmulti";
import { readJSON, writeText } from "@thi.ng/file-io";
import { table, type Row } from "@thi.ng/markdown-table";
import { defMultiTrie } from "@thi.ng/trie";
import {
	CURRENCY_DIGITS,
	type AppCtx,
	type CommonOpts,
	type Entry,
} from "../api.js";
import { ARG_JOURNAL, ARG_OUT_FILE } from "../args.js";

interface ReportOpts extends CommonOpts {
	aggregate: boolean;
	delim: string;
	fmt: "csv" | "json" | "md";
	from: string;
	include: string[];
	journal: string;
	outFile?: string;
	to: string;
}

interface ComputeBalanceOpts {
	filters: string[];
	from: string;
	to: string;
}

interface Balance {
	amount: number;
	currency: string;
	num: number;
}

export const REPORT: Command<ReportOpts, CommonOpts, AppCtx<ReportOpts>> = {
	desc: "Produce balance reports (optionally filtered) in different formats",
	opts: <Args<ReportOpts>>{
		...ARG_JOURNAL,
		...ARG_OUT_FILE,
		aggregate: flag({
			alias: "a",
			desc: "Compute aggregates of nested balances",
		}),
		delim: string({
			alias: "d",
			desc: "Delimiter char for nested balance IDs",
			default: ":",
		}),
		fmt: oneOf(["csv", "json", "md"], {
			alias: "f",
			desc: "Output format",
			default: "md",
		}),
		from: string({
			desc: "Start date (yyyy-MM-dd format)",
			hint: "DATE",
			group: "filters",
		}),
		include: strings({
			alias: "i",
			desc: "Only include given balance ID",
			hint: "NAME",
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
	const report = formatRows(opts.fmt, aggregateBalances(balances, opts));
	if (opts.outFile) {
		writeText(opts.outFile, report, logger);
	} else {
		console.log(report);
	}
}

const computeBalances = (
	entries: Entry[],
	opts: Partial<ComputeBalanceOpts>
) => {
	const balances: Record<string, Balance> = {};

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

const aggregateBalances = (
	balances: Record<string, Balance>,
	{ aggregate, delim, include }: ReportOpts
) => {
	const keys = Object.keys(balances).sort();
	const trie = defMultiTrie(
		keys.map((k) => <const>[k.split(delim), balances[k].amount])
	);
	const seen = new Set<string>();
	const rows: Row[] = [];
	for (let k of keys) {
		const keyParts = k.split(delim);
		const len = keyParts.length - 1;
		for (let i = aggregate ? 0 : len; i <= len; i++) {
			const subParts = keyParts.slice(0, i + 1);
			const subKey = subParts.join(delim);
			if (!includeName(include, subKey)) continue;
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
	return rows;
};

const formatRows = defmulti<ReportOpts["fmt"], Row[], string>(
	identity,
	{},
	{
		csv: (_, rows) =>
			formatCSVString(
				{ header: ["Balance", "Amount", "Currency", "TX count"] },
				rows
			),
		json: (_, rows) =>
			JSON.stringify(
				rows.map((x) => ({
					id: x[0],
					amount: x[1],
					currency: x[2],
					count: x[3],
				})),
				null,
				4
			),
		md: (_, rows) =>
			table(["Balance", "Amount", "Currency", "TX count"], rows, {
				align: ["l", "r", "l", "r"],
			}),
	}
);

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

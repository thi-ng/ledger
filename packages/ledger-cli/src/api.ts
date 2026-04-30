import type { CommandCtx } from "@thi.ng/args";
import { readJSON } from "@thi.ng/file-io";
import { join } from "node:path";

export const PKG = readJSON(join(process.argv[2], "package.json"));

export interface CommonOpts {
	verbose: boolean;
	quiet: boolean;
}

export interface AppCtx<T extends CommonOpts> extends CommandCtx<
	T,
	CommonOpts
> {}

export interface Transaction {
	accountA: string;
	accountB: string;
	currencyA: string;
	currencyB: string;
	date: string;
	type: string;
	desc: string;
	ref: string;
	payee: string;
	payeeID: string;
	amount: number;
	rate: number;
	hash: string;
}

export type HashableTransaction = Pick<
	Transaction,
	| "accountA"
	| "accountB"
	| "currencyA"
	| "currencyB"
	| "date"
	| "desc"
	| "ref"
	| "amount"
>;

export interface Classifier {
	if: string;
	then: Partial<Entry>;
}

export interface ClassifierSpec {
	accountA: string;
	defaults: Partial<Entry>;
	rules: Classifier[];
}

export interface Entry {
	date: string;
	desc: string;
	accountA: string;
	accountB: string;
	amount: number;
	currency: string;
}

/**
 * Only list non-standard currencies here. Default precision is 2 digits.
 */
export const CURRENCY_DIGITS: Record<string, number> = {
	BTC: 8,
	ETH: 9,
	XTZ: 6,
};

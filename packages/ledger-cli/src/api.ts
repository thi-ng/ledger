import type { CommandCtx } from "@thi.ng/args";
import { readJSON } from "@thi.ng/file-io";
import { join } from "node:path";

export const PKG = readJSON(join(process.argv[2], "package.json"));

export interface CommonOpts {
	verbose: boolean;
	quiet: boolean;
}

export interface AppCtx<T extends CommonOpts>
	extends CommandCtx<T, CommonOpts> {}

export interface Transaction {
	accountA: string;
	accountB: string;
	date: string;
	type: string;
	desc: string;
	ref: string;
	payee: string;
	payeeID: string;
	amount: number;
	currency: string;
	hash?: string;
}

export type HashableTransaction = Pick<
	Transaction,
	"accountA" | "accountB" | "date" | "desc" | "ref" | "amount" | "currency"
>;

export interface Classifier {
	if: string;
	then: Partial<Entry>;
}

export interface ClassifierSpec {
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

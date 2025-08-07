import { flag, string, type Args } from "@thi.ng/args";
import type { CommonOpts } from "./api.js";

export const ARGS_COMMON: Args<CommonOpts> = {
	verbose: flag({
		alias: "v",
		desc: "Display extra information",
	}),
	quiet: flag({
		alias: "q",
		desc: "Disable logging",
	}),
};

export const ARG_DRY_RUN = {
	dryRun: flag({
		desc: "Dry run (no changes actually performed)",
	}),
};

export const ARG_DB = {
	db: string({
		desc: "Ledger DB path",
		default: process.env.THING_LEDGER_FILE!,
	}),
};

export const ARG_JOURNAL = {
	journal: string({
		alias: "j",
		desc: "Ledger journal path",
		default: process.env.THING_JOURNAL_FILE!,
	}),
};

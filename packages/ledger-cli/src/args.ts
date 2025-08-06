import { flag, string, type Args } from "@thi.ng/args";
import { tmpdir } from "node:os";
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
		desc: "Ledger journal path",
		default: process.env.THING_JOURNAL_FILE!,
	}),
};

export const ARG_OUT_DIR = (
	defaultVal?: string,
	desc?: string
): { outDir: ReturnType<typeof string> } => ({
	outDir: string({
		alias: "O",
		desc: "Output directory" + (desc ?? ""),
		default: defaultVal,
		optional: !!defaultVal,
	}),
});

export const ARG_TMP_DIR = (
	defaultVal = process.env.LAYER_TMP_DIR ?? tmpdir(),
	desc?: string
): { tmpDir: ReturnType<typeof string> } => ({
	tmpDir: string({
		alias: "tmp",
		desc: "Output directory for tempory files" + (desc ?? ""),
		default: defaultVal,
	}),
});

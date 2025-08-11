import { cliApp, THING_HEADER } from "@thi.ng/args";
import { LogLevel } from "@thi.ng/logger";
import { config } from "dotenv";
import { PKG, type AppCtx, type CommonOpts } from "./api.js";
import { ARGS_COMMON } from "./args.js";
import { CLASSIFY } from "./cmd/classify.js";
import { IMPORT } from "./cmd/import.js";
import { REPORT } from "./cmd/report.js";

config({ quiet: true });

cliApp<CommonOpts, AppCtx<any>>({
	opts: ARGS_COMMON,
	commands: {
		classify: CLASSIFY,
		import: IMPORT,
		report: REPORT,
	},
	name: "ledger",
	ctx: async (ctx) => {
		if (ctx.opts.quiet) ctx.logger.level = LogLevel.NONE;
		else if (ctx.opts.verbose) ctx.logger.level = LogLevel.DEBUG;
		return ctx;
	},
	start: 3,
	usage: {
		groups: ["flags", "main", "filters"],
		prefix: `${THING_HEADER(PKG.name, PKG.version, PKG.desc)}

Usage: ledger-cli <cmd> [opts] input [...]
       ledger-cli <cmd> --help\n\n`,
		showGroupNames: true,
		paramWidth: 30,
		lineWidth: 96,
	},
});

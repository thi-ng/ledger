import { ConsoleLogger, type LogLevelName } from "@thi.ng/logger";

export const LOGGER = new ConsoleLogger(
	"tool",
	<LogLevelName>(process.env["LOG_LEVEL"] ?? "DEBUG")
);

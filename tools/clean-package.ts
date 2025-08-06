// SPDX-License-Identifier: Apache-2.0
import { deleteDir, deleteFile, dirs, files } from "@thi.ng/file-io";
import { basename } from "node:path";
import { LOGGER } from "./logger.js";

// accept & merge additional dirs as CLI args
const removeDirs = new Set([
	"doc",
	"api",
	"generated",
	"internal",
	...process.argv.slice(2),
]);

for (let d of dirs(".", (x) => removeDirs.has(basename(x)), 1)) {
	console.log("removing directory:", d);
	deleteDir(d, LOGGER);
}

for (let f of files(".", /\.(map|js|d\.ts|tsbuildinfo|wasm|wast|o)$/)) {
	if (f.indexOf("/bin/") === -1) {
		deleteFile(f, LOGGER);
	}
}

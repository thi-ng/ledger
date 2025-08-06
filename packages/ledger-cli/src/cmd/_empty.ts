import type { Args, Command } from "@thi.ng/args";
import type { AppCtx, CommonOpts } from "../api.js";

interface DummyOpts extends CommonOpts {}

export const DUMMY: Command<DummyOpts, CommonOpts, AppCtx<DummyOpts>> = {
    desc: "TODO.",
    opts: <Args<DummyOpts>>{},
    fn: command,
};

async function command(ctx: AppCtx<DummyOpts>) {
    console.log(ctx);
}

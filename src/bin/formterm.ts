import * as fs from "node:fs/promises";
import { inquirer } from "../lib";
import { FakeRPC, RPCAsker } from "../lib/rpc";

// get first argument
const [file] = process.argv.slice(2);

async function importPath(path: string) {
	return "file://" + await fs.realpath(path);
}

const asker = new RPCAsker(new FakeRPC());
const module = await import(await importPath(file));
await module.default(asker);

// await inquirer(async (asker) => {
// 	const module = await import(await importPath(file));
// 	await module.default(asker);
// });

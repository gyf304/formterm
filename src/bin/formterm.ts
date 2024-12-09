import * as prompts from "@inquirer/prompts";

import * as fs from "node:fs/promises";
import { Form, InquirerAsker } from "../lib";
import { Hono } from "hono";
import { hono } from "../lib/hono";

const help = `
Usage: formterm <term|serve> [...files/directories]

Commands:
  term       Start a terminal
  serve      Start a server
`.trim();

// get first argument
const [cmd, ...files] = process.argv.slice(2);
if (cmd === "help") {
	console.log(help);
	process.exit(0);
}
if (cmd !== "term" && cmd !== "serve") {
	console.log(help);
	process.exit(1);
}
if (files.length === 0) {
	console.log(help);
	process.exit(1);
}

async function list(path: string) {
	const stat = await fs.stat(path);
	if (stat.isFile()) {
		return [path];
	}
	const files = await fs.readdir(path);
	const paths: string[] = [];
	for (const file of files) {
		paths.push(...await list(path + "/" + file));
	}
	return paths;
}

async function importPath(path: string) {
	return "file://" + await fs.realpath(path);
}

async function load(path: string[]) {
	const all = await Promise.all(path.map(async (file) => await import(await importPath(file)).then((module) => module.default)));
	return all.filter((form): form is Form => form instanceof Form);
}

async function term(files: string[]) {
	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.length === 0) {
		console.error("No forms found");
		process.exit(1);
		return;
	}
	const form = forms.length > 1 ? await prompts.select({
		message: "Select a form",
		choices: forms.map((f, i) => ({ name: f.name ?? f.id, value: f })),
	}) : forms[0];
	await form.run(new InquirerAsker());
}

async function serve(files: string[]) {
	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.length === 0) {
		console.error("No forms found");
		process.exit(1);
		return;
	}
	const app = new Hono();
	if (process.isBun) {
		const {
			createBunWebSocket,
			serveStatic,
		} = await import("hono/bun");
		const {
			upgradeWebSocket,
			websocket,
		} = createBunWebSocket();
		hono(
			app,
			upgradeWebSocket,
			serveStatic,
			new Map(forms.map((form) => [form.id, form])),
		);
		await Bun.serve({
			fetch: app.fetch,
			websocket,
		});
	} else {
		throw new Error("Not implemented");
	}
}

switch (cmd) {
	case "term":
		await term(files);
		break;
	case "serve":
		await serve(files);
		break;
	default:
		throw new Error("Unreachable");
}

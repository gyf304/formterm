#!/usr/bin/env node
import * as fs from "node:fs/promises";

import * as prompts from "@inquirer/prompts";
import { Hono } from "hono";

import { Form } from "../lib/index.js";
import { InquirerAsker } from "../lib/inquirer.js";
import { hono } from "../lib/hono.js";

// if we are executing this file with node,
// check if bun or tsx is available and re-execute
console.log("process.argv", process.argv);
if (process.argv[0].split("/").pop() === "node") {
	// check if bun is available in PATH
	const bun = await fs.access("bun", fs.constants.X_OK)
		.then(() => true)
		.catch(() => false);
	console.log("bun", bun);
}

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
	const all = await Promise.all(path.map(
		async (file) => await import(await importPath(file)).then((module) => [file, module.default] as const)
	));
	const forms = new Map<string, Form>(
		all
			.filter(([_, form]) => form instanceof Form)
			.map(([_, form]) => [form.id, form] as const)
	);
	return forms;
}

async function term(files: string[]) {
	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.size === 0) {
		console.error("No forms found");
		process.exit(1);
		return;
	}
	const form = forms.size > 1 ? await prompts.select({
		message: "Select a form",
		choices: Array.from(
			forms.entries().map(([id, f]) => ({ name: `${f.name ?? "Untitled"} (${id})`, value: f }))
		),
	}) : Array.from(forms.values())[0];
	await form.run(new InquirerAsker());
}

async function serve(files: string[]) {
	let port = 3000;
	if (process.env.PORT) {
		port = parseInt(process.env.PORT, 10);
		if (isNaN(port)) {
			console.error("Invalid port number");
			process.exit(1);
		}
	}
	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.size === 0) {
		console.error("No forms found");
		process.exit(1);
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
			forms,
		);
		await Bun.serve({
			fetch: app.fetch,
			websocket,
			port,
		});
	} else {
		const { serve } = await import("@hono/node-server");
		const { createNodeWebSocket } = await import("@hono/node-ws");
		const { serveStatic } = await import("@hono/node-server/serve-static");
		const {
			upgradeWebSocket,
			injectWebSocket,
		} = createNodeWebSocket({ app });
		hono(
			app,
			upgradeWebSocket,
			serveStatic,
			forms,
		);
		const server = serve({
			fetch: app.fetch,
			port,
		});
		injectWebSocket(server);
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

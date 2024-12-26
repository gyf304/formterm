#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as child from "node:child_process";

import arg from "arg";
import which from "which";
import * as prompts from "@inquirer/prompts";
import { Hono } from "hono";

import { Form, unindent } from "../lib/index.js";
import { InquirerAsker } from "../lib/inquirer.js";
import { hono, type HonoConfig } from "../lib/hono.js";

const help = unindent`
Usage: formterm <term|serve> [...files/directories]

Commands:
  term       Run form(s) in terminal
  serve      Serve form(s) over HTTP

Options:
  -h, --help               Show this help message
  --interpreter <command>  Use a different interpreter (defaults to: bun, tsx, or node)
`;

const globalArgs = arg({
	"--help": Boolean,
	"--interpreter": String,

	"-h": "--help",
}, {
	stopAtPositional: true,
});

if (globalArgs["--help"]) {
	console.log(help);
	process.exit(0);
}

const currentInterpreter = process.argv[0].split(/[/\\]/).pop();
const requestedInterpreter = globalArgs["--interpreter"];

if (requestedInterpreter === undefined) {
	// check if bun or tsx is available and re-execute
	if (currentInterpreter === "node") {
		// check if bun is available in PATH
		for (const interpreter of ["bun", "tsx"]) {
			const path = await which(interpreter, { nothrow: true });
			if (path !== null) {
				console.log(`Using interpreter ${interpreter}`);
				const code = await new Promise<void>((resolve) => {
					const proc = child.spawn(path, process.argv.slice(1), { stdio: "inherit" });
					proc.on("exit", resolve);
				});
				process.exit(code ?? 0);
			}
		}
		console.log("Using interpreter node");
	}
} else {
	console.log(`Using interpreter ${requestedInterpreter}`);
	const code = await new Promise<void>((resolve) => {
		const proc = child.spawn(requestedInterpreter, process.argv.slice(1), { stdio: "inherit" });
		proc.on("exit", resolve);
	});
	process.exit(code ?? 0);
}

// get first argument
const [cmd, ...restArgs] = globalArgs["_"];

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

async function term(argv: string[]) {
	const args = arg({
		"--help": Boolean,
		"--show-description": Boolean,
		"-d": "--show-description",
	}, {
		argv,
	});

	if (args["--help"] || args["_"].length === 0) {
		console.log(unindent`
			Usage: formterm term [...files/directories]

			Options:
			  -d, --show-description    Show question descriptions
		`);
		process.exit(0);
	}

	const files = args["_"];

	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.size === 0) {
		console.error("No forms found");
		process.exit(1);
	}
	const form = forms.size > 1 ? await prompts.select({
		message: "Select a form",
		choices: Array.from(
			forms.entries().map(([id, f]) => ({ name: `${f.title ?? "Untitled"} (${id})`, value: f }))
		),
	}) : Array.from(forms.values())[0];
	await form.run(new InquirerAsker({ showDescription: args["--show-description"] }));
}

async function serve(argv: string[]) {
	const args = arg({
		"--help": Boolean,
		"--no-index": Boolean,
		"--port": Number,
		"-p": "--port",
	}, {
		argv,
	});

	if (args["--help"] || args["_"].length === 0) {
		console.log(unindent`
			Usage: formterm serve [...files/directories]

			Options:
			  -p, --port <port>    Port to listen on (default: 3000)
			  --no-index           Disable index page
		`);
		process.exit(0);
	}

	const files = args["_"];
	const port = args["--port"] ?? 3000;

	const allFiles = await Promise.all(files.map(async (file) => await list(file)))
		.then((files) => files.flat());
	const forms = await load(allFiles);
	if (forms.size === 0) {
		console.error("No forms found");
		process.exit(1);
	}
	const app = new Hono();
	const config: HonoConfig = {
		noIndex: args["--no-index"],
	};
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
			config,
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
			config,
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
		await term(restArgs);
		break;
	case "serve":
		await serve(restArgs);
		break;
	default:
		console.log(help);
		process.exit(1);
		break;
}

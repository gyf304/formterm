import * as path from "node:path";
import { Context, Env, Hono, MiddlewareHandler } from "hono";

import { RPC, RPCAsker, RPCRequest } from "./rpc.js";
import { JSONRPCRequest, jsonRPCResponseSchema, Resolver } from "./ws.js";
import { Form, FormInfo } from "./base.js";
import { UpgradeWebSocket, WSContext } from "hono/ws";
import { ServeStaticOptions } from "hono/serve-static";

type ServeStatic = (options: ServeStaticOptions<Env>) => MiddlewareHandler;

class HonoWebSocketRPC implements RPC {
	private readonly resolvers = new Map<string, Resolver<any>>();
	constructor(private readonly ws: WSContext) {}

	async call(request: RPCRequest): Promise<unknown> {
		if (this.ws === undefined) {
			throw new Error("WebSocket not connected");
		}

		const rpcId = Math.random().toString(36).slice(2);
		const rpcRequest = {
			jsonrpc: "2.0",
			id: rpcId,
			method: request.method,
			params: request,
		} satisfies JSONRPCRequest;

		this.ws.send(JSON.stringify(rpcRequest));
		return new Promise((resolve, reject) => {
			this.resolvers.set(rpcId, { resolve, reject });
		});
	}

	public onMessage(message: string) {
		const response = jsonRPCResponseSchema.parse(JSON.parse(message));
		const resolver = this.resolvers.get(response.id);
		if (!resolver) {
			return;
		}
		if (response.error) {
			resolver.reject(response.error);
		} else {
			resolver.resolve(response.result);
		}
		this.resolvers.delete(response.id);
	}

	public onClose() {
		this.resolvers.forEach(({ reject }) => reject(new Error("WebSocket closed")));
	}

	public onError(err: any) {
		this.resolvers.forEach(({ reject }) => reject(err));
	}
}

export class HonoAsker extends RPCAsker {
	readonly rpc: HonoWebSocketRPC;

	constructor(
		rpc: HonoWebSocketRPC,
		public readonly context: Context,
	) {
		super(rpc);
		this.rpc = rpc;
	}
}

function dir(path: string, level = 1) {
	path = path.replace(/file:\/\//, "");
	path = path.replace(/\/$/, "");
	let pathParts = path.split("/");
	pathParts = pathParts.slice(0, pathParts.length - level);
	return pathParts.join("/");
}

export interface HonoConfig {
	staticRoot?: string;
	defaultForm?: string;
	prefix?: string;
}

export function hono(
	app: Hono,
	upgradeWebSocket: UpgradeWebSocket,
	serveStatic: ServeStatic,
	forms: {
		get: (key: string) => Form | undefined,
	},
	config?: HonoConfig,
) {
	let staticRoot = config?.staticRoot ?? dir(import.meta.url.toString(), 3) + "/dist/ui/";
	staticRoot = path.relative(process.cwd(), staticRoot);
	let prefix = config?.prefix ?? "";
	if (prefix !== "") {
		prefix = prefix.replace(/^\/+/, "").replace(/\/+$/, "");
		prefix = "/" + prefix;
	}

	const serveIndex = serveStatic({
		root: staticRoot,
		rewriteRequestPath: () => "/index.html",
	});

	const serveAssets = serveStatic({
		root: staticRoot,
		rewriteRequestPath: (path) => "/" + path.split("/").pop(),
	});

	if (config?.defaultForm !== undefined) {
		if (prefix !== "") {
			app.get(prefix, async (c) => {
				const form = forms.get(config.defaultForm!);
				if (!form) {
					return c.notFound();
				}
				return c.redirect(encodeURIComponent(config.defaultForm!) + "/");
			});
		}
		app.get(`${prefix}/`, async (c) => {
			const form = forms.get(config.defaultForm!);
			if (!form) {
				return c.notFound();
			}
			return c.redirect(encodeURIComponent(config.defaultForm!) + "/");
		});
	}

	app.get(`${prefix}/:form`, async (c) => {
		const formName = decodeURIComponent(c.req.param("form")!);
		const form = forms.get(formName);
		if (!form) {
			return c.notFound();
		}
		const url = new URL(c.req.url);
		return c.redirect(url.pathname + "/");
	});

	app.get(`${prefix}/:form/`, async (c, next) => {
		const formName = decodeURIComponent(c.req.param("form")!);
		const form = forms.get(formName);
		if (!form) {
			return c.notFound();
		}
		return await serveIndex(c, next);
	});

	app.get(`${prefix}/:form/info.json`, async (c, next) => {
		const form = forms.get(c.req.param("form"));
		if (!form) {
			return c.notFound();
		}
		return c.json({
			id: form.id,
			name: form.name,
			description: form.description,
		} satisfies FormInfo);
	});

	app.get(`${prefix}/:form/ws`, upgradeWebSocket(async (c) => {
		let rpc: HonoWebSocketRPC | undefined;
		return {
			onOpen: (evt, ws) => {
				const form = forms.get(decodeURIComponent(c.req.param("form")));
				if (form === undefined) {
					ws.close(404, "Not Found");
					return;
				}
				ws.binaryType = "arraybuffer";
				rpc = new HonoWebSocketRPC(ws);
				const asker = new HonoAsker(rpc, c);
				form.run(asker).catch((err) => {
					console.error(err);
					ws.close(500, "Internal Server Error");
				}).finally(() => {
					ws.close();
				});
			},
			onMessage: (evt, ws) => {
				if (rpc === undefined) {
					return;
				}
				if (typeof evt.data === "string") {
					rpc.onMessage(evt.data);
				}
			},
			onClose: (evt, ws) => {
				if (rpc === undefined) {
					return;
				}
				rpc.onClose();
			},
			onError: (evt, ws) => {
				if (rpc === undefined) {
					return;
				}
				rpc.onError(evt);
			},
		};
	}));

	app.get(`${prefix}/:form/:filename`, serveAssets);
}

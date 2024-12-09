import * as zod from "zod";

import { Context, Env, Hono, MiddlewareHandler } from "hono";

import { RPC, RPCAsker, RPCRequest, RPCResponse } from "./rpc.js";
import { JSONRPCRequest, jsonRPCResponseSchema, Resolver } from "./ws.js";
import { Form, FormInfo } from "./base.js";
import { UpgradeWebSocket, WSContext } from "hono/ws";
import { getCookie, setCookie } from "hono/cookie";
import { ServeStaticOptions } from "hono/serve-static";
import { CookieOptions } from "hono/utils/cookie.js";

type ServeStatic = (options: ServeStaticOptions<Env>) => MiddlewareHandler;

interface Config {
	staticRoot: string;
}

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

	async fetch(url: string) {
		return this.rpc.call({
			method: "fetch",
			url,
		});
	}

	async redirect(url: string) {
		return this.rpc.call({
			method: "redirect",
			url,
		});
	}
}

function dir(path: string) {
	path = path.replace(/file:\/\//, "");
	path = path.replace(/\/$/, "");
	const pathParts = path.split("/");
	pathParts.pop();
	return pathParts.join("/");
}

export function hono(
	app: Hono,
	upgradeWebSocket: UpgradeWebSocket,
	serveStatic: ServeStatic,
	forms: {
		get: (key: string) => Form | undefined,
		keys?: () => Iterable<string>,
	},
	config: Config = {
		staticRoot: dir(import.meta.url.toString()) + "/../../dist/ui"
	},
) {
	const serveIndex = serveStatic({
		root: config.staticRoot,
		rewriteRequestPath: () => "/index.html",
	});

	app.get("/static/*", serveStatic({
		root: config.staticRoot,
		rewriteRequestPath: (path) => path.replace(/^\/static\//, "/"),
	}));

	app.get("/forms", async (c) => {
		return c.json(Array.from(forms.keys?.() ?? []));
	});

	app.get("/forms/:form", async (c, next) => {
		const form = forms.get(c.req.param("form"));
		if (!form) {
			return c.notFound();
		}
		return await serveIndex(c, next);
	});

	app.get("/forms/:form/info.json", async (c, next) => {
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

	app.get("/forms/:form/ws", upgradeWebSocket(async (c) => {
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
}

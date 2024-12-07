import * as zod from "zod"
import { RPC } from "./rpc.js";

const requestSchema = zod.object({
	jsonrpc: zod.literal("2.0"),
	id: zod.string(),
	method: zod.string(),
	params: zod.unknown(),
});

const responseSchema = zod.object({
	jsonrpc: zod.literal("2.0"),
	id: zod.string(),
	result: zod.any(),
	error: zod.object({
		code: zod.number(),
		message: zod.string(),
		data: zod.any(),
	}).optional(),
});

interface Resolver<T> {
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}

export class WebSocketRPC implements RPC {
	private readonly resolvers = new Map<string, Resolver<any>>();

	constructor(private readonly ws: WebSocket) {
		ws.onmessage = (event) => {
			const response = responseSchema.parse(JSON.parse(event.data));
			const resolver = this.resolvers.get(response.id);
			if (!resolver) {
				return;
			}
			if (response.error) {
				this.resolvers.get(response.id)?.reject(response.error);
			} else {
				this.resolvers.get(response.id)?.resolve(response.result);
			}
			this.resolvers.delete(response.id);
		};

		ws.onclose = () => {
			this.resolvers.forEach(({ reject }) => reject(new Error("WebSocket closed")));
		};
	}

	async call(method: string, params: unknown): Promise<unknown> {
		const id = Math.random().toString(36).slice(2);
		const request = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		} satisfies zod.infer<typeof requestSchema>;

		this.ws.send(JSON.stringify(request));
		return new Promise((resolve, reject) => {
			this.resolvers.set(id, { resolve, reject });
		});
	}
}

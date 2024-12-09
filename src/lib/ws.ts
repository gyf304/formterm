import * as zod from "zod"
import { RPC, RPCRequest } from "./rpc.js";

export const jsonRPCRequestSchema = zod.object({
	jsonrpc: zod.literal("2.0"),
	id: zod.string(),
	method: zod.string(),
	params: zod.unknown(),
});
export type JSONRPCRequest = zod.infer<typeof jsonRPCRequestSchema>;

export const jsonRPCResponseSchema = zod.object({
	jsonrpc: zod.literal("2.0"),
	id: zod.string(),
	result: zod.any(),
	error: zod.object({
		code: zod.number(),
		message: zod.string(),
		data: zod.any(),
	}).optional(),
});
export type JSONRPCResponse = zod.infer<typeof jsonRPCResponseSchema>;

export interface Resolver<T> {
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}

export class WebSocketRPC implements RPC {
	private readonly resolvers = new Map<string, Resolver<any>>();

	constructor(private readonly ws: WebSocket) {
		ws.onmessage = (event) => {
			const response = jsonRPCResponseSchema.parse(JSON.parse(event.data));
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

	async call(request: RPCRequest): Promise<unknown> {
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
}

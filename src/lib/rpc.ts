import * as zod from "zod";
import { AnswerType, Asker, Question, QuestionConfig, QuestionContext } from "./base.js";

export interface RPCAskRequest<C extends QuestionConfig = QuestionConfig> {
	method: "ask";
	id: string;
	config: C;
}

export type RPCAskResponse<C extends QuestionConfig = QuestionConfig> = AnswerType<C>;
export interface RPCCancelRequest {
	method: "cancel";
	id: string;
}

export interface RPCRemoveRequest {
	method: "remove";
	id: string;
}

export interface RPCFetchRequest {
	method: "fetch";
	url: string;
}

export interface RPCRedirectRequest {
	method: "redirect";
	url: string;
}

export type RPCRequest = RPCAskRequest | RPCCancelRequest | RPCRemoveRequest | RPCFetchRequest | RPCRedirectRequest;
export type RPCResponse<I extends RPCRequest> =
	I extends RPCAskRequest<infer C> ? RPCAskResponse<C> :
	I extends RPCCancelRequest ? void :
	I extends RPCRemoveRequest ? void :
	I extends RPCFetchRequest ? void :
	I extends RPCRedirectRequest ? void :
	never;

export interface RPC {
	call(request: RPCRequest): Promise<unknown>;
}
export class FakeRPC implements RPC {
	async call(request: RPCRequest): Promise<unknown> {
		console.log(request);
		throw new Error("Not implemented");
	}
}

function getSchema(config: QuestionConfig): zod.ZodType<AnswerType<QuestionConfig>> {
	switch (config.type) {
		case "info":
			return zod.void();
		case "text":
			return zod.string();
		case "password":
			return zod.string();
		case "checkboxes":
			return zod.array(zod.string())
				.refine((values) => values.every((value) => Object.keys(config.choices).includes(value)))
				.transform((values) => Array.from(new Set(values)));
		case "radio":
			return zod.string().refine((value) => Object.keys(config.choices).includes(value));
		case "dropdown":
			return zod.string().refine((value) => Object.keys(config.choices).includes(value));
		case "date":
			return zod.string().date();
		case "time":
			return zod.string().time();
		case "group":
			return zod.object(Object.fromEntries(
				Object.entries(config.questions)
					.map(([key, question]) => [key, getSchema(question)] as const),
			));
		default:
			throw new Error(`Unknown question type: ${(config as any).type}`);
	}
}

function signalPromise(signal: AbortSignal): Promise<Event> {
	return new Promise((_resolve, reject) => {
		signal.addEventListener("abort", reject, { once: true });
	});
}

export class RPCQuestion<A extends RPCAsker> extends Question<A, QuestionConfig, any> {
	public readonly id = Math.random().toString(36).slice(2);
	protected abortController: AbortController = new AbortController();

	private async call() {
		const result = await this.asker.rpc.call({
			method: "ask",
			id: this.id,
			config: this.config,
		});
		const parsed = getSchema(this.config).parse(result);
		return parsed;
	}

	protected async run(): Promise<any> {
		if (this.signal.aborted) {
			throw new Error("Question aborted");
		}
		signalPromise(this.signal).catch(() => {
			this.asker.rpc.call({
				method: "cancel",
				id: this.id,
			});
		});
		return await Promise.race([signalPromise(this.signal), this.call()]);
	}

	get signal() {
		if (this.context?.signal) {
			return AbortSignal.any([this.context.signal, this.abortController.signal]);
		}
		return this.abortController.signal;
	}
}

export class RPCAsker extends Asker {
	constructor(public readonly rpc: RPC) {
		super();
	}

	ask<C extends QuestionConfig>(config: C, context?: QuestionContext): Question<this, C, AnswerType<C>> {
		return new RPCQuestion(this, config, context) as any;
	}
}

import * as zod from "zod";
import { AnswerType, Asker, CheckboxesQuestionConfig, DropdownQuestionConfig, GroupQuestionConfig, InfoQuestionConfig, MarkdownQuestionConfig, OmitType, PasswordQuestionConfig, Question, QuestionConfig, QuestionContext, RadioQuestionConfig, TextQuestionConfig } from "./base";

export interface RPC {
	call(method: string, params: unknown): Promise<unknown>;
}

export class FakeRPC implements RPC {
	async call(method: string, params: unknown): Promise<unknown> {
		console.log(method, params);
		throw new Error("Not implemented");
	}
}

const schemas = {
	text: zod.string(),
	password: zod.string(),
	info: zod.void(),
	checkboxes: zod.array(zod.string()),
	radio: zod.string(),
	dropdown: zod.string(),
	markdown: zod.void(),
	group: zod.record(zod.unknown()),
} satisfies {
	[K in QuestionConfig["type"]]: zod.ZodType<AnswerType<Extract<QuestionConfig, { type: K }>>>;
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
		const result = await this.asker.rpc.call("ask", { id: this.id, config: this.config });
		return schemas[this.config.type].parse(result);
	}

	protected async run(): Promise<any> {
		if (this.signal.aborted) {
			throw new Error("Question aborted");
		}
		signalPromise(this.signal).catch(() => {
			this.asker.rpc.call("cancel", { id: this.id });
		});
		await Promise.race([signalPromise(this.signal), this.call()]);
	}

	get signal() {
		if (this.context?.signal) {
			return AbortSignal.any([this.context.signal, this.abortController.signal]);
		}
		return this.abortController.signal;
	}

	async remove() {
		if (this.signal.aborted) {
			return;
		}
		this.abortController?.abort();
		this.asker.rpc.call("remove", { id: this.id }); // don't await
	}
}

export class RPCAsker implements Asker {
	constructor(public readonly rpc: RPC) {}

	info(config: OmitType<InfoQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "info", ...config }, context) as any;
	}

	markdown(config: OmitType<MarkdownQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "markdown", ...config }, context) as any;
	}

	text(config: OmitType<TextQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "text", ...config }, context) as any;
	}

	password(config: OmitType<PasswordQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "password", ...config }, context) as any;
	}

	checkboxes(config: OmitType<CheckboxesQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "checkboxes", ...config }, context) as any;
	}

	radio(config: OmitType<RadioQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "radio", ...config }, context) as any;
	}

	dropdown(config: OmitType<DropdownQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "dropdown", ...config }, context) as any;
	}

	group(config: OmitType<GroupQuestionConfig>, context?: QuestionContext) {
		return new RPCQuestion(this, { type: "group", ...config }, context) as any;
	}
}

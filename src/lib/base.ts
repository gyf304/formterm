import * as zod from "zod";

export type StringOrRichContent = string | {
	mimeType: "text/markdown";
	content: string;
};

export interface BaseQuestionConfig {
	type: string;
	title: string;
	description?: StringOrRichContent;
}

export interface TextQuestionConfig extends BaseQuestionConfig {
	type: "text";
	default?: string;
}

export interface MultilineQuestionConfig extends BaseQuestionConfig {
	type: "multiline";
	default?: string;
}

export interface PasswordQuestionConfig extends BaseQuestionConfig {
	type: "password";
}

export interface InfoQuestionConfig extends BaseQuestionConfig {
	type: "info";
}

export interface ConfirmQuestionConfig extends BaseQuestionConfig {
	type: "confirm";
}

export interface CheckboxesQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "checkboxes";
	choices: O;
}

export interface RadioQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "radio";
	choices: O;
	default?: string & keyof O;
}

export interface DropdownQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "dropdown";
	choices: O;
	default?: string & keyof O;
}

export interface DateQuestionConfig extends BaseQuestionConfig {
	type: "date";
}

export interface TimeQuestionConfig extends BaseQuestionConfig {
	type: "time";
}

export interface GroupQuestionConfig extends BaseQuestionConfig {
	type: "group";
	questions: Record<string, GroupableQuestionConfig>;
}

export type GroupableQuestionConfig =
	CheckboxesQuestionConfig |
	DateQuestionConfig |
	DropdownQuestionConfig |
	GroupQuestionConfig |
	MultilineQuestionConfig |
	PasswordQuestionConfig |
	RadioQuestionConfig |
	TextQuestionConfig |
	TimeQuestionConfig |
	never;

export type QuestionConfig =
	GroupableQuestionConfig |
	InfoQuestionConfig |
	ConfirmQuestionConfig |
	never;

export type AnswerType<C extends QuestionConfig> =
	C extends { type: "confirm" } ? boolean :
	C extends { type: "checkboxes" } ? string[] :
	C extends { type: "date" } ? string :
	C extends { type: "dropdown" } ? string :
	C extends { type: "group" } ? Record<string, unknown> :
	C extends { type: "info" } ? void :
	C extends { type: "multiline" } ? string :
	C extends { type: "password" } ? string :
	C extends { type: "radio" } ? string :
	C extends { type: "text" } ? string :
	C extends { type: "time" } ? string :
	never;

export type OmitType<C extends QuestionConfig> = Omit<C, "type">;

function answerSchema(config: QuestionConfig): zod.ZodType<AnswerType<QuestionConfig>> {
	switch (config.type) {
		case "info":
			return zod.void();
		case "confirm":
			return zod.boolean();
		case "text":
			return zod.string();
		case "multiline":
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
					.map(([key, question]) => [key, answerSchema(question)] as const),
			));
		default:
			throw new Error(`Unknown question type: ${(config as any).type}`);
	}
}

export interface QuestionContext {
	signal?: AbortSignal;
}

export abstract class Question<A extends Asker, const C extends QuestionConfig, O extends AnswerType<C> = AnswerType<C>> implements PromiseLike<O> {
	private _promise?: Promise<O>;

	private resolver?: (value: O) => void;
	private rejector?: (reason: any) => void;

	constructor(
		public readonly asker: A,
		public readonly config: C,
		public context?: QuestionContext,
	) {}

	protected abstract run(): Promise<O>;

	get promise(): Promise<O> {
		if (this._promise === undefined) {
			this._promise = new Promise((resolve, reject) => {
				this.resolver = resolve;
				this.rejector = reject;
				this.run().then(this.resolver, this.rejector);
			});
		}
		return this._promise;
	}

	then<TResult1 = O, TResult2 = never>(
		onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null | undefined,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
	): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected);
	}

	catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<O | TResult> {
		return this.promise.catch(onrejected);
	}

	finally(onfinally?: (() => void) | null | undefined): Promise<O> {
		return this.promise.finally(onfinally);
	}

	toJSON(): QuestionConfig {
		return this.config;
	}

	get answerSchema(): zod.ZodType<AnswerType<QuestionConfig>> {
		return answerSchema(this.config);
	}
}

export abstract class Asker {
	ask<C extends QuestionConfig>(config: C, context?: QuestionContext): Question<this, C, AnswerType<C>> {
		throw new Error(`Config type not implemented: ${config.type}`);
	}

	info(config: OmitType<InfoQuestionConfig>, context?: QuestionContext): Question<this, InfoQuestionConfig, void> {
		return this.ask({ type: "info", ...config }, context);
	}
	confirm(config: OmitType<ConfirmQuestionConfig>, context?: QuestionContext): Question<this, ConfirmQuestionConfig, boolean> {
		return this.ask({ type: "confirm", ...config }, context);
	}

	text(config: OmitType<TextQuestionConfig>, context?: QuestionContext): Question<this, TextQuestionConfig, string> {
		return this.ask({ type: "text", ...config }, context);
	}
	multiline(config: OmitType<MultilineQuestionConfig>, context?: QuestionContext): Question<this, MultilineQuestionConfig, string> {
		return this.ask({ type: "multiline", ...config }, context);
	}
	password(config: OmitType<PasswordQuestionConfig>, context?: QuestionContext): Question<this, PasswordQuestionConfig, string> {
		return this.ask({ type: "password", ...config }, context);
	}
	checkboxes<O extends Record<string, string>>(config: OmitType<CheckboxesQuestionConfig<O>>, context?: QuestionContext): Question<this, CheckboxesQuestionConfig, keyof O extends string ? (keyof O)[] : never> {
		return this.ask({ type: "checkboxes", ...config } as any, context) as any;
	}
	radio<O extends Record<string, string>>(config: OmitType<RadioQuestionConfig<O>>, context?: QuestionContext): Question<this, RadioQuestionConfig, keyof O extends string ? keyof O : never> {
		return this.ask({ type: "radio", ...config } as any, context) as any;
	}
	dropdown<O extends Record<string, string>>(config: OmitType<DropdownQuestionConfig<O>>, context?: QuestionContext): Question<this, DropdownQuestionConfig, keyof O extends string ? keyof O : never> {
		return this.ask({ type: "dropdown", ...config } as any, context) as any;
	}
	date(config: OmitType<DateQuestionConfig>, context?: QuestionContext): Question<this, DateQuestionConfig, string> {
		return this.ask({ type: "date", ...config }, context);
	}
	time(config: OmitType<TimeQuestionConfig>, context?: QuestionContext): Question<this, TimeQuestionConfig, string> {
		return this.ask({ type: "time", ...config }, context);
	}

	group<Q extends Record<string, Question<any, GroupableQuestionConfig, any>>>(
		config: { title: string; questions: Q },
		context?: QuestionContext,
	): Question<this, GroupQuestionConfig, {
		[K in keyof Q]: Q[K] extends Question<any, any, infer O> ? O : never;
	}> {
		return this.ask({
			type: "group",
			...config,
			questions: Object.fromEntries(
				Object.entries(config.questions)
					.map(([key, question]) => [key, question.toJSON()] as const),
			) as any,
		}, context) as any;
	}
}

export interface FormInfo {
	id: string;
	title?: string;
	description?: StringOrRichContent;
}

export class Form implements FormInfo {
	readonly id: string;
	readonly title?: string;
	readonly description: FormInfo["description"];
	constructor(
		info: FormInfo,
		public readonly run: (asker: Asker) => Promise<void>,
	) {
		this.id = info.id;
		this.title = info.title;
		this.description = info.description;
	}
}

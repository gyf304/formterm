interface BaseQuestionConfig {
	type: string;
	title: string;
}

export interface TextQuestionConfig extends BaseQuestionConfig {
	type: "text";
}

export interface PasswordQuestionConfig extends BaseQuestionConfig {
	type: "password";
}

export interface InfoQuestionConfig extends BaseQuestionConfig {
	type: "info";
}

export interface CheckboxesQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "checkboxes";
	choices: O;
}

export interface RadioQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "radio";
	choices: O;
}

export interface DropdownQuestionConfig<O extends Record<string, string> = Record<string, string>> extends BaseQuestionConfig {
	type: "dropdown";
	choices: O;
}

export interface MarkdownQuestionConfig extends BaseQuestionConfig {
	type: "markdown";
	markdown: string;
}

export interface GroupQuestionConfig extends BaseQuestionConfig {
	type: "group";
	questions: Record<string, Question<any, any, any>>;
}

export type QuestionConfig =
	TextQuestionConfig |
	PasswordQuestionConfig |
	InfoQuestionConfig |
	CheckboxesQuestionConfig |
	RadioQuestionConfig |
	DropdownQuestionConfig |
	MarkdownQuestionConfig |
	GroupQuestionConfig |
	never;

export type AnswerType<C extends QuestionConfig> =
	C extends { type: "text" } ? string :
	C extends { type: "password" } ? string :
	C extends { type: "info" } ? void :
	C extends { type: "checkboxes" } ? string[] :
	C extends { type: "radio" } ? string :
	C extends { type: "dropdown" } ? string :
	C extends { type: "markdown" } ? void :
	C extends { type: "group" } ? Record<string, unknown> :
	never;

export type OmitType<C extends QuestionConfig> = Omit<C, "type">;

export interface QuestionContext {
	signal?: AbortSignal;
}

export abstract class Question<A extends Asker, const C extends QuestionConfig, O extends AnswerType<C> = AnswerType<C>> implements PromiseLike<O> {
	private _promise?: Promise<O>;
	private _finished = false;

	private resolver?: (value: O) => void;
	private rejector?: (reason: any) => void;

	constructor(
		public readonly asker: A,
		public readonly config: C,
		public context?: QuestionContext,
	) {}

	protected abstract run(): Promise<O>;

	abstract remove(): Promise<void>;

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
		if (this.config.type === "group") {
			return {
				type: "group",
				title: this.config.title,
				questions: Object.fromEntries(
					Object.entries(this.config.questions)
						.map(([key, question]) => [key, question.toJSON()] as const),
				) as any,
			}
		}
		return this.config;
	}
}

export interface Asker {
	info(config: OmitType<InfoQuestionConfig>, context?: QuestionContext): Question<this, InfoQuestionConfig, void>;
	markdown(config: OmitType<MarkdownQuestionConfig>, context?: QuestionContext): Question<this, MarkdownQuestionConfig, void>;

	text(config: OmitType<TextQuestionConfig>, context?: QuestionContext): Question<this, { type: "text"; title: string }, string>;
	password(config: OmitType<PasswordQuestionConfig>, context?: QuestionContext): Question<this, { type: "password"; title: string }, string>;
	checkboxes<O extends Record<string, string>>(config: OmitType<CheckboxesQuestionConfig<O>>, context?: QuestionContext): Question<this, { type: "checkboxes"; title: string; choices: O }, keyof O extends string ? (keyof O)[] : never>;
	radio<O extends Record<string, string>>(config: OmitType<RadioQuestionConfig<O>>, context?: QuestionContext): Question<this, { type: "radio"; title: string; choices: O }, keyof O extends string ? keyof O : never>;
	dropdown<O extends Record<string, string>>(config: OmitType<DropdownQuestionConfig<O>>, context?: QuestionContext): Question<this, { type: "dropdown"; title: string; choices: O }, keyof O extends string ? keyof O : never>;

	group<Q extends Record<string, Question<any, any, any>>>(config: OmitType<GroupQuestionConfig>, context?: QuestionContext): Question<this, { type: "group"; title: string; questions: Q }, Record<string, AnswerType<Q[keyof Q]["config"]>>>;
}

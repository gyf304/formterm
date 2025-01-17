import * as p from "@inquirer/prompts";
import * as z from "zod";
import chalk from "chalk";

import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

import {
	AnswerType,
	Asker,
	CheckboxesQuestionConfig,
	ConfirmQuestionConfig,
	DateQuestionConfig,
	DropdownQuestionConfig,
	GroupableQuestionConfig,
	GroupQuestionConfig,
	InfoQuestionConfig,
	MultilineQuestionConfig,
	OmitType,
	PasswordQuestionConfig,
	Question,
	QuestionConfig,
	QuestionContext,
	RadioQuestionConfig,
	TextQuestionConfig,
	TimeQuestionConfig,
} from "./base.js";

const marked = new Marked(markedTerminal() as any);

abstract class InquirerQuestion<A extends InquirerAsker, C extends QuestionConfig> extends Question<A, C> {
	protected abortController: AbortController = new AbortController();

	get signal() {
		if (this.context?.signal) {
			return AbortSignal.any([this.context.signal, this.abortController.signal]);
		}
		return this.abortController.signal;
	}

	protected async showInfo(force?: boolean) {
		if (!this.asker.config.showDescription && !force) {
			return;
		}
		console.log(chalk.bold(this.config.title));
		if (this.config.description) {
			if (typeof this.config.description === "string") {
				console.log(this.config.description);
			} else if (this.config.description.mimeType === "text/markdown") {
				console.log(marked.parse(this.config.description.content).toString().trim());
			}
		}
	}
}

class InquirerTextQuestion<A extends InquirerAsker> extends InquirerQuestion<A, TextQuestionConfig> {
	async run() {
		await this.showInfo();
		return p.input(
			{ message: this.config.title, default: this.config.default },
			{ signal: this.signal },
		);
	}
}

class InquirerMultilineQuestion<A extends InquirerAsker> extends InquirerQuestion<A, MultilineQuestionConfig> {
	async run() {
		await this.showInfo();
		return p.editor(
			{ message: this.config.title, default: this.config.default },
			{ signal: this.signal },
		);
	}
}

class InquirerPasswordQuestion<A extends InquirerAsker> extends InquirerQuestion<A, PasswordQuestionConfig> {
	async run() {
		await this.showInfo();
		return p.password(
			{ message: this.config.title },
			{ signal: this.signal },
		);
	}
}

class InquirerDateQuestion<A extends InquirerAsker> extends InquirerQuestion<A, DateQuestionConfig> {
	async run() {
		await this.showInfo();
		const date = await p.input({
			message: this.config.title + " (YYYY-MM-DD)",
			validate: (s) => z.string().date().safeParse(s).success,
		});
		return date;
	}
}

class InquirerTimeQuestion<A extends InquirerAsker> extends InquirerQuestion<A, TimeQuestionConfig> {
	async run() {
		await this.showInfo();
		const time = await p.input({
			message: this.config.title + " (HH:mm...)",
			validate: (s) => z.string().time().safeParse(s).success,
		});
		return time;
	}
}

class InquirerInfoQuestion<A extends InquirerAsker> extends InquirerQuestion<A, InfoQuestionConfig> {
	async run() {
		await this.showInfo(true);
	}
}

class InquirerConfirmQuestion<A extends InquirerAsker> extends InquirerQuestion<A, ConfirmQuestionConfig> {
	async run() {
		await this.showInfo();
		return p.confirm(
			{ message: this.config.title },
			{ signal: this.signal },
		);
	}
}

class InquirerCheckboxesQuestion<A extends InquirerAsker> extends InquirerQuestion<A, CheckboxesQuestionConfig> {
	async run() {
		await this.showInfo();
		return p.checkbox(
			{
				message: this.config.title,
				choices: Object.entries(this.config.choices).map(([value, name]) => ({ name, value })),
			},
			{ signal: this.signal },
		);
	}
}

class InquirerSelectQuestion<A extends InquirerAsker> extends InquirerQuestion<A, QuestionConfig & { type: "radio" | "dropdown" }> {
	async run() {
		await this.showInfo();
		return p.select(
			{
				message: this.config.title,
				choices: Object.entries(this.config.choices).map(([value, name]) => ({ name, value })),
				default: this.config.default,
			},
			{ signal: this.signal },
		);
	}
}

class InquirerGroupQuestion<A extends InquirerAsker> extends InquirerQuestion<A, GroupQuestionConfig> {
	async run() {
		const questions: Map<string, Question<any, any, any>> = new Map();
		for (const [key, question] of Object.entries(this.config.questions)) {
			const cls = questionClasses[question.type];
			if (cls === undefined) {
				throw new Error(`Unknown question type: ${question.type}`);
			}
			questions.set(key, new cls(this.asker, question as any, this.context as any));
		}
		const answers: Map<string, unknown> = new Map();
		const keys = Object.keys(this.config.questions);
		while (answers.size < keys.length) {
			let firstUnanswered: string | undefined;
			for (const [key] of questions) {
				if (!answers.has(key)) {
					firstUnanswered = key;
					break;
				}
			}
			const selectedKey = await p.select(
				{
					message: this.config.title + " (Select an option)",
					choices: Object.entries(this.config.questions)
						.map(([key, question]) => ({
							name: answers.has(key) ? "✓ " + question.title : "  " + question.title,
							value: key
						})),
					default: firstUnanswered,
				},
				{ signal: this.signal },
			);
			const selected = questions.get(selectedKey)
			answers.set(selectedKey, await (selected as any).run());
		}
		return Object.fromEntries(answers);
	}
}

const questionClasses = {
	info: InquirerInfoQuestion,
	confirm: InquirerConfirmQuestion,
	text: InquirerTextQuestion,
	multiline: InquirerMultilineQuestion,
	password: InquirerPasswordQuestion,
	checkboxes: InquirerCheckboxesQuestion,
	radio: InquirerSelectQuestion,
	dropdown: InquirerSelectQuestion,
	group: InquirerGroupQuestion,
	date: InquirerDateQuestion,
	time: InquirerTimeQuestion,
} satisfies Record<QuestionConfig["type"], any>;

interface InquirerAskerConfig {
	showDescription?: boolean;
}

export class InquirerAsker extends Asker {
	constructor(public config: InquirerAskerConfig = {}) {
		super();
	}

	info(config: OmitType<InfoQuestionConfig>, context?: QuestionContext) {
		return new InquirerInfoQuestion(this, { type: "info", ...config }, context);
	}

	confirm(config: OmitType<ConfirmQuestionConfig>, context?: QuestionContext): Question<this, ConfirmQuestionConfig, boolean> {
		return new InquirerConfirmQuestion(this, { type: "confirm", ...config }, context);
	}

	text(config: OmitType<TextQuestionConfig>, context?: QuestionContext) {
		return new InquirerTextQuestion(this, { type: "text", ...config }, context);
	}

	multiline(config: OmitType<MultilineQuestionConfig>, context?: QuestionContext): Question<this, MultilineQuestionConfig, string> {
		return new InquirerMultilineQuestion(this, { type: "multiline", ...config }, context);
	}

	password(config: OmitType<PasswordQuestionConfig>, context?: QuestionContext) {
		return new InquirerPasswordQuestion(this, { type: "password", ...config }, context);
	}

	checkboxes<O extends Record<string, string>>(config: OmitType<CheckboxesQuestionConfig<O>>, context?: QuestionContext) {
		return new InquirerCheckboxesQuestion(this, { type: "checkboxes", ...config }, context) as any;
	}

	radio<O extends Record<string, string>>(config: OmitType<RadioQuestionConfig<O>>, context?: QuestionContext) {
		return new InquirerSelectQuestion(this, { type: "radio", ...config }, context) as any;
	}

	dropdown<O extends Record<string, string>>(config: OmitType<DropdownQuestionConfig<O>>, context?: QuestionContext) {
		return new InquirerSelectQuestion(this, { type: "dropdown", ...config }, context) as any;
	}

	date(config: OmitType<DateQuestionConfig>, context?: QuestionContext) {
		return new InquirerDateQuestion(this, { type: "date", ...config }, context);
	}

	time(config: OmitType<TimeQuestionConfig>, context?: QuestionContext) {
		return new InquirerTimeQuestion(this, { type: "time", ...config }, context);
	}

	group<Q extends Record<string, Question<any, GroupableQuestionConfig, any>>>(
		config: { title: string; questions: Q },
		context?: QuestionContext,
	): Question<this, GroupQuestionConfig, {
		[K in keyof Q]: Q[K] extends Question<any, any, infer O> ? O : never;
	}> {
		return new InquirerGroupQuestion(this, {
			type: "group",
			...config,
			questions: Object.fromEntries(
				Object.entries(config.questions)
					.map(([key, question]) => [key, question.toJSON()] as const),
			) as any,
		}, context) as any;
	}
}

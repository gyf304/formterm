import * as p from "@inquirer/prompts";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

import { Asker, CheckboxesQuestionConfig, DropdownQuestionConfig, GroupQuestionConfig, InfoQuestionConfig, MarkdownQuestionConfig, OmitType, PasswordQuestionConfig, Question, QuestionConfig, QuestionContext, RadioQuestionConfig, TextQuestionConfig } from "./base";

abstract class InquirerQuestion<A extends InquirerAsker, C extends QuestionConfig> extends Question<A, C> {
	protected abortController: AbortController = new AbortController();

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
	}
}

class InquirerTextQuestion<A extends InquirerAsker> extends InquirerQuestion<A, TextQuestionConfig> {
	async run() {
		return p.input(
			{ message: this.config.title },
			{ signal: this.signal },
		);
	}
}

class InquirerPasswordQuestion<A extends InquirerAsker> extends InquirerQuestion<A, PasswordQuestionConfig> {
	async run() {
		return p.password(
			{ message: this.config.title },
			{ signal: this.signal },
		);
	}
}

class InquirerInfoQuestion<A extends InquirerAsker> extends InquirerQuestion<A, InfoQuestionConfig> {
	async run() {
		console.log(this.config.title);
	}
}

class InquirerCheckboxesQuestion<A extends InquirerAsker> extends InquirerQuestion<A, CheckboxesQuestionConfig> {
	async run() {
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
		return p.select(
			{
				message: this.config.title,
				choices: Object.entries(this.config.choices).map(([value, name]) => ({ name, value })),
			},
			{ signal: this.signal },
		);
	}
}

class InquirerMarkdownQuestion<A extends InquirerAsker> extends InquirerQuestion<A, MarkdownQuestionConfig> {
	static marked = new Marked(markedTerminal() as any);
	async run() {
		console.log(InquirerMarkdownQuestion.marked.parse(this.config.markdown));
	}
}

class InquirerGroupQuestion<A extends InquirerAsker> extends InquirerQuestion<A, GroupQuestionConfig> {
	async run() {
		const answers: Map<string, unknown> = new Map();
		const keys = Object.keys(this.config.questions);
		while (answers.size < keys.length) {
			const selectedKey = await p.select(
				{
					message: this.config.title + " (Select an option)",
					choices: Object.entries(this.config.questions)
						.map(([key, question]) => ({
							name: answers.has(key) ? "✓ " + question.config.title : "  " + question.config.title,
							value: key
						})),
				},
				{ signal: this.signal },
			);
			const selected = this.config.questions[selectedKey];
			selected.context = this.context;
			answers.set(selectedKey, await (selected as any).run());
		}
		return Object.fromEntries(answers);
	}
}

class InquirerAsker implements Asker {
	info(config: OmitType<InfoQuestionConfig>, context?: QuestionContext) {
		return new InquirerInfoQuestion(this, { type: "info", ...config }, context);
	}

	markdown(config: OmitType<MarkdownQuestionConfig>, context?: QuestionContext) {
		return new InquirerMarkdownQuestion(this, { type: "markdown", ...config }, context);
	}

	text(config: OmitType<TextQuestionConfig>, context?: QuestionContext) {
		return new InquirerTextQuestion(this, { type: "text", ...config }, context);
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

	group<Q extends Record<string, QuestionConfig>>(config: OmitType<GroupQuestionConfig>, context?: QuestionContext) {
		return new InquirerGroupQuestion(this, { type: "group", ...config }, context) as any;
	}
}

export async function inquirer(form: (asker: InquirerAsker) => Promise<void>) {
	const asker = new InquirerAsker();
	try {
		await form(asker);
	} catch (error) {
		console.error(error);
	}
}

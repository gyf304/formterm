import * as zod from "zod";
import * as path from "node:path";
import { Context, Env, Hono, MiddlewareHandler } from "hono";

import { AnswerType, Asker, Form, FormInfo, Question, QuestionConfig, QuestionContext } from "./base.js";
import { UpgradeWebSocket, WSContext } from "hono/ws";
import { ServeStaticOptions } from "hono/serve-static";

type ServeStatic = (options: ServeStaticOptions<Env>) => MiddlewareHandler;

interface ResolveRejecter<T> {
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}

interface HonoQuestionMessage {
	type: "question";
	id: string;
	config: QuestionConfig;
}

interface HonoCancelMessage {
	type: "cancel";
	id: string;
}

export type HonoServerMessage = HonoQuestionMessage | HonoCancelMessage;

const honoAnswerMessageSchema = zod.object({
	type: zod.literal("answer"),
	id: zod.string(),
	answer: zod.unknown(),
});

export type HonoAnswerMessage = zod.infer<typeof honoAnswerMessageSchema>;

const honoClientMessageSchema = honoAnswerMessageSchema;
export type HonoClientMessage = zod.infer<typeof honoClientMessageSchema>;

interface PendingQuestion {
	question: Question<any, QuestionConfig, any>;
	resolve: (value: unknown) => void;
	reject: (reason: any) => void;
}


function signalPromise(signal: AbortSignal): Promise<Event> {
	return new Promise((_resolve, reject) => {
		signal.addEventListener("abort", reject, { once: true });
	});
}

export class HonoQuestion<A extends HonoAsker> extends Question<A, QuestionConfig, any> {
	public readonly id = Math.random().toString(36).slice(2);
	protected abortController: AbortController = new AbortController();

	protected async run(): Promise<any> {
		if (this.signal.aborted) {
			throw new Error("Question aborted");
		}
		signalPromise(this.signal).catch(() => {
			this.asker.ws?.send(JSON.stringify({
				type: "cancel",
				id: this.id,
			} satisfies HonoCancelMessage));
		});
		const promise = new Promise((resolve, reject) => {
			this.asker.pendingQuestions.set(this.id, {
				question: this,
				resolve,
				reject,
			});
			this.asker.ws?.send(JSON.stringify({
				type: "question",
				id: this.id,
				config: this.config,
			} satisfies HonoQuestionMessage));
		});
		return await Promise.race([signalPromise(this.signal), promise]);
	}

	get signal() {
		if (this.context?.signal) {
			return AbortSignal.any([this.context.signal, this.abortController.signal]);
		}
		return this.abortController.signal;
	}
}

export class HonoAsker extends Asker {
	ws?: WSContext;
	pendingQuestions = new Map<string, PendingQuestion>();

	constructor(
		public readonly context: Context,
		private readonly form: Form,
		private errorHandler: (err: any) => void = () => {},
	) {
		super();
	}

	ask<C extends QuestionConfig>(config: C, context?: QuestionContext): Question<this, C, AnswerType<C>> {
		return new HonoQuestion(this, config, context) as any;
	}

	onOpen(_evt: unknown, ws: WSContext) {
		this.ws = ws;
		this.form.run(this).catch((err) => {
			this.errorHandler(err);
			ws.close(1008, err instanceof Error ? err.message : "Unnknown Error");
		}).then(() => {
			ws.close(1000, "OK");
		});
	}

	onMessage(evt: MessageEvent) {
		const rawMessage = evt.data;
		if (typeof rawMessage !== "string") {
			return;
		}
		const message = honoClientMessageSchema.parse(JSON.parse(rawMessage));
		if (message.type === "answer") {
			const pendingQuestion = this.pendingQuestions.get(message.id);
			if (pendingQuestion === undefined) {
				return;
			}
			this.pendingQuestions.delete(message.id);
			pendingQuestion.resolve(pendingQuestion.question.answerSchema.parse(message.answer));
		}
	}

	onClose() {
		this.pendingQuestions.forEach(({ reject }) => reject(new Error("WebSocket closed")));
	}

	onError(err: Event) {
		this.pendingQuestions.forEach(({ reject }) => reject(new Error("WebSocket error")));
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
	errorHandler?: (err: any) => void;
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
			title: form.title,
			description: form.description,
		} satisfies FormInfo);
	});

	app.get(`${prefix}/:form/ws`, async (c, next) => {
		const form = forms.get(c.req.param("form"));
		if (!form) {
			return c.notFound();
		}
		return upgradeWebSocket((c) => new HonoAsker(c, form, config?.errorHandler))(c, next);
	});

	app.get(`${prefix}/:form/:filename`, serveAssets);
}

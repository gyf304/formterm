import React from "react";

import { Container, CssBaseline, ThemeProvider, createTheme, Box, TextField, Typography, CardActions, Button } from "@mui/material";
import { FormCard } from "./components/FormCard";
import { FormQuestionCard } from "./components/FormInputCard";
import type { AnswerType, FormInfo, QuestionConfig } from "../lib/base";
import type { HonoServerMessage } from "../lib/hono";
import { RichContent } from "./components/RichContent";

const theme = createTheme({
	colorSchemes: {
		dark: true,
	},
});

interface PendingQuestion<C extends QuestionConfig = QuestionConfig> {
	id: string;
	canceled: boolean;
	config: C;
	resolve: (answer: AnswerType<C>) => void;
}

export function AppForm() {
	const [formInfo, setFormInfo] = React.useState<FormInfo | undefined>();
	const [questions, setQuestions] = React.useState<PendingQuestion[]>([]);
	const [started, setStarted] = React.useState(false);
	const [closed, setClosed] = React.useState(false);
	const [error, setError] = React.useState<string | undefined>();
	const prevQuestionsLengthRef = React.useRef(questions.length);

	React.useEffect(() => {
		(async () => {
			const response = await fetch(window.location.pathname + "?type=json", {
				method: "GET",
				headers: {
					"Accept": "application/json"
				}
			});
			const formInfo = await response.json();
			setFormInfo(formInfo);
		})();
	}, []);

	React.useEffect(() => {
		if (!started) {
			return;
		}
		const ws = new WebSocket(
			window.location.origin.replace(/^http/, "ws") +
			window.location.pathname.replace(/\/$/, "") +
			"/ws"
		);
		ws.binaryType = "arraybuffer";
		ws.onmessage = (event) => {
			const req = JSON.parse(event.data) as HonoServerMessage;
			switch (req.type) {
				case "question":
					setQuestions((qs) => [...qs, {
						id: req.id,
						canceled: false,
						config: req.config,
						resolve: (answer) => {
							ws.send(JSON.stringify({
								type: "answer",
								id: req.id,
								answer,
							}));
						},
					}]);
					break;
				case "cancel":
					setQuestions((qs) => qs.map((q) => q.id === req.id ? { ...q, canceled: true } : q));
					break;
			}
		};
		ws.onclose = (ev) => {
			setClosed(true);
			if (ev.code !== 1000) {
				setError(ev.reason ?? "Unknown error");
			}
		};
		ws.onerror = (e) => {
			console.error(e);
			setError("WebSocket error");
			setClosed(true);
		};
		return () => {
			ws.close();
		};
	}, [started]);

	React.useEffect(() => {
		if (prevQuestionsLengthRef.current < questions.length || closed) {
			setTimeout(() => {
				window.scrollTo({
					top: document.body.scrollHeight,
					behavior: "smooth"
				});
			}, 100);
		}
		prevQuestionsLengthRef.current = questions.length;
	}, [questions, closed]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Box
				sx={{
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					bgcolor: "background.default",
					py: 4
				}}
			>
				<Container
					maxWidth="md"
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 2
					}}
				>
					{
						formInfo === undefined ? undefined :
						<FormCard>
							<h1>
								{ formInfo.title ?? formInfo.id }
							</h1>
							{
								formInfo.description === undefined ? undefined :
								<Box>
									<RichContent>
										{ formInfo.description }
									</RichContent>
								</Box>
							}
							<CardActions>
								<Button
									variant="contained"
									onClick={() => setStarted(true)}
									disabled={started}
								>
									Start Form
								</Button>
							</CardActions>
						</FormCard>
					}
					{
						questions.map((q, i) => (
							<FormQuestionCard
								key={q.id}
								disabled={q.canceled}
								config={q.config}
								submit={q.resolve}
								autoFocus={i === questions.length - 1}
							/>
						))
					}
					{
						closed ? <FormCard>
							<Typography variant="h6" gutterBottom>
								Form finished { error ? "with error" : "successfully" }
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{ error ?? "The form has finished." }
							</Typography>
						</FormCard> : undefined
					}
				</Container>
			</Box>
		</ThemeProvider>
	);
}

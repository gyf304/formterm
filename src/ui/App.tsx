import React from "react";
import ReactMarkdown from "react-markdown";

import { Container, CssBaseline, ThemeProvider, createTheme, Box, TextField, Typography, CardActions, Button } from "@mui/material";
import { FormCard } from "./components/FormCard";
import { FormQuestionCard } from "./components/FormInputCard";
import type { FormInfo } from "../lib/base";
import type { JSONRPCRequest } from "../lib/ws";
import type { RPCAskRequest, RPCAskResponse, RPCCancelRequest } from "../lib/rpc";

const theme = createTheme({
	colorSchemes: {
		dark: true,
	},
});

export function App() {
	const [formInfo, setFormInfo] = React.useState<FormInfo | undefined>();
	const [questions, setQuestions] = React.useState<[RPCAskRequest, (answer: RPCAskResponse) => void][]>([]);
	const [started, setStarted] = React.useState(false);
	const [closed, setClosed] = React.useState(false);
	const [error, setError] = React.useState<string | undefined>();
	const prevQuestionsLengthRef = React.useRef(questions.length);

	React.useEffect(() => {
		(async () => {
			const response = await fetch(window.location.pathname.replace(/\/$/, "") + "/info.json");
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
			const req = JSON.parse(event.data) as JSONRPCRequest;
			switch (req.method) {
				case "ask":
					const params = req.params as RPCAskRequest;
					setQuestions((questions) => [
						...questions,
						[
							params,
							(answer: RPCAskResponse) => {
								ws.send(JSON.stringify({
									jsonrpc: "2.0",
									id: req.id,
									result: answer,
								}));
							}
						]
					]);
					// scroll to bottom
					setTimeout(() => {
						window.scrollTo({
							top: document.body.scrollHeight,
							behavior: "smooth"
						});
					}, 100);
					break;
				case "cancel":
					const { id } = req.params as RPCCancelRequest;

				default:
					console.log("Unknown method", req.method);
			}
		};
		ws.onclose = () => {
			setClosed(true);
		};
		ws.onerror = (e) => {
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
							<ReactMarkdown>
								{`# ${formInfo.name}\n\n` + (formInfo.description ?? "")}
							</ReactMarkdown>
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
						questions.map(([req, res], i) => (
							<FormQuestionCard
								key={req.id}
								config={req.config}
								submit={res}
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

export default App;
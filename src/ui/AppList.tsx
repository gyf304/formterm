import React from "react";

import { Container, CssBaseline, ThemeProvider, createTheme, Box, TextField, Typography, CardActions, Button } from "@mui/material";
import { FormCard } from "./components/FormCard";
import { FormQuestionCard } from "./components/FormInputCard";
import type { FormInfo } from "../lib/base";
import type { HonoServerMessage } from "../lib/hono";
import { RichContent } from "./components/RichContent";

export function AppList() {
	const [forms, setForms] = React.useState<FormInfo[]>([]);

	React.useEffect(() => {
		(async () => {
			const url = new URL("./index.json", window.location.href);
			const response = await fetch(url, {
				method: "GET",
				credentials: "same-origin",
			});
			const forms = await response.json();
			setForms(forms);
		})();
	}, []);


	return (
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
					forms.map((form, i) => (
						<FormCard
							key={i}
							onSubmit={() => {
								window.location.href = `./${encodeURIComponent(form.id)}/`;
							}}
							submitLabel="Open"
						>
							<Typography variant="h6" gutterBottom>
								{form.title ?? form.id}
							</Typography>
							{
								form.description === undefined ? undefined :
								<Box>
									<RichContent>
										{form.description}
									</RichContent>
								</Box>
							}
						</FormCard>
					))
				}
			</Container>
		</Box>
	);
}

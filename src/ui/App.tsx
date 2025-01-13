import React from "react";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { AppForm } from "./AppForm";
import { AppList } from "./AppList";

const theme = createTheme({
	colorSchemes: {
		dark: true,
	},
});

export function App() {
	const [mode, setMode] = React.useState<"form" | "list" | null>(null);

	React.useEffect(() => {
		(async () => {
			const url = new URL("./index.json", window.location.href);
			const response = await fetch(url, {
				method: "GET",
				credentials: "same-origin",
			});
			const formInfo = await response.json();
			if (Array.isArray(formInfo)) {
				setMode("list");
			} else {
				setMode("form");
			}
		})();
	}, []);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			{mode === "form" ? <AppForm /> : mode === "list" ? <AppList /> : null}
		</ThemeProvider>
	);
}

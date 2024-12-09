import * as React from "react";
import { useState } from "react";
import { Button, TextField } from "@mui/material";

export function List() {
	const [forms, setForms] = useState<string[]>([]);

	React.useEffect(() => {
		fetch("/forms")
			.then((response) => response.json())
			.then(setForms);
	}, []);

	return (
		<div>
			<TextField label="Name" variant="outlined" />
			<Button variant="contained">Submit</Button>
		</div>
	);
}

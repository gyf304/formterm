import React from "react";
import { Button, Card, CardActions, CardContent, Typography } from "@mui/material";

interface FormCardProps {
	children?: React.ReactNode;
	disabled?: boolean;

	onSubmit?: () => void;
	onCancel?: () => void;

	submitLabel?: string;
	cancelLabel?: string;
}

export const FormCard: React.FC<FormCardProps> = (p) => {
	return (
		<Card
			sx={{
				width: "100%",
				boxShadow: 3,
				transition: "all 0.2s ease-in-out"
			}}
		>
			<CardContent>
				{p.children}
			</CardContent>
			{
				(p.onCancel === undefined && p.onSubmit === undefined) ? undefined :
				<CardActions
					sx={{
						alignSelf: "stretch",
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "flex-start",
					}}
				>
					{
						p.onCancel === undefined ? undefined :
						<Button disabled={p.disabled} onClick={p.onCancel}>
							{ p.cancelLabel ?? "Cancel" }
						</Button>
					}
					{
						p.onSubmit === undefined ? undefined :
						<Button disabled={p.disabled} onClick={p.onSubmit}>
							{ p.submitLabel ?? "Submit" }
						</Button>
					}
				</CardActions>
			}
		</Card>
	);
};

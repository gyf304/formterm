import React from "react";
import ReactMarkdown from "react-markdown";

import type {
	TextQuestionConfig,
	PasswordQuestionConfig,
	InfoQuestionConfig,
	CheckboxesQuestionConfig,
	RadioQuestionConfig,
	DropdownQuestionConfig,
	DateQuestionConfig,
	TimeQuestionConfig,
	GroupQuestionConfig,
	QuestionConfig,
	AnswerType,
} from "../../lib/base";
import { FormCard } from "./FormCard";
import { Box, Checkbox, FormControlLabel, MenuItem, Radio, RadioGroup, Select, TextField, Typography } from "@mui/material";

export interface FormQuestionCardProps<C extends QuestionConfig> {
	config: C;
	autoFocus?: boolean;
	submit?: (answer: AnswerType<C>) => void;
}

interface ValueChange<C extends QuestionConfig> {
	value?: AnswerType<C>;
	error?: string;
}

interface FormQuestionProps<C extends QuestionConfig> {
	config: C;
	disabled?: boolean;
	value?: AnswerType<C>;
	autoFocus?: boolean;
	onChange: (value: ValueChange<C>) => void;
	onSubmit?: () => void;
}

interface FormTextQuestionProps extends FormQuestionProps<TextQuestionConfig> {}

interface BaseFormQuestionProps {
	config: QuestionConfig;
	children?: React.ReactNode;
}

export const BaseFormQuestion: React.FC<BaseFormQuestionProps> = (p) => {
	return (
		<>
			{
				p.config.title === undefined ? undefined :
				<Typography variant="h6" gutterBottom>
					{p.config.title}
				</Typography>
			}
			{
				p.config.description === undefined ? undefined :
				<ReactMarkdown>
					{p.config.description}
				</ReactMarkdown>
			}
			{p.children}
		</>
	);
};

export const FormTextQuestion: React.FC<FormTextQuestionProps> = (p) => {
	return (
		<BaseFormQuestion config={p.config} >
			<TextField
				disabled={p.disabled}
				fullWidth
				placeholder="Your answer"
				value={p.value ?? ""}
				onChange={(e) => p.onChange({
					value: e.target.value,
				})}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						p.onSubmit?.();
					}
				}}
			/>
		</BaseFormQuestion>
	);
};

export const FormPasswordQuestion: React.FC<FormQuestionProps<PasswordQuestionConfig>> = (p) => {
	return (
		<BaseFormQuestion config={p.config} >
			<TextField
				autoFocus={p.autoFocus}
				disabled={p.disabled}
				fullWidth
				placeholder="Your answer"
				type="password"
				value={p.value ?? ""}
				onChange={(e) => p.onChange({
					value: e.target.value,
				})}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						p.onSubmit?.();
					}
				}}
			/>
		</BaseFormQuestion>
	);
};

export const FormInfoQuestion: React.FC<FormQuestionProps<InfoQuestionConfig>> = (p) => {
	React.useEffect(() => {
		p.onChange({
			value: undefined,
			error: undefined,
		});
	});
	return (
		<BaseFormQuestion config={p.config} />
	);
};

export const FormCheckboxesQuestion: React.FC<FormQuestionProps<CheckboxesQuestionConfig>> = (p) => {
	const value = p.value ?? [];
	return (
		<BaseFormQuestion config={p.config}>
			{
				Object.entries(p.config.choices).map(([key, name]) => (
					<FormControlLabel
						autoFocus={p.autoFocus}
						key={key}
						disabled={p.disabled}
						control={
							<Checkbox
								checked={value.includes(key)}
								onChange={(e) => p.onChange({
									value: value.includes(key) ? value.filter((v) => v !== key) : [...value, key],
								})}
							/>
						}
						label={name}
					/>
				))
			}
		</BaseFormQuestion>
	);
};

export const FormRadioQuestion: React.FC<FormQuestionProps<RadioQuestionConfig>> = (p) => {
	return (
		<BaseFormQuestion config={p.config}>
			<RadioGroup
				value={p.value ?? null}
				onChange={(e) => p.onChange({
					value: e.target.value,
				})}
			>
				{
					Object.entries(p.config.choices).map(([key, name]) => (
						<FormControlLabel
							autoFocus={p.autoFocus}
							key={key}
							disabled={p.disabled}
							value={key}
							control={
								<Radio />
							}
							label={name}
						/>
					))
				}
			</RadioGroup>
		</BaseFormQuestion>
	);
};

export const FormDropdownQuestion: React.FC<FormQuestionProps<DropdownQuestionConfig>> = (p) => {
	return (
		<BaseFormQuestion config={p.config}>
			<Select
				autoFocus={p.autoFocus}
				disabled={p.disabled}
				value={p.value}
				onChange={(e) => p.onChange({
					value: e.target.value,
				})}
			>
				{
					Object.entries(p.config.choices).map(([key, name]) => (
						<MenuItem
							key={key}
							value={key}
						>
							{name}
						</MenuItem>
					))
				}
			</Select>
		</BaseFormQuestion>
	);
};

export const FormDateQuestion: React.FC<FormQuestionProps<DateQuestionConfig>> = (p) => {
	return (
		<BaseFormQuestion config={p.config}>
			<TextField
				autoFocus={p.autoFocus}
				fullWidth
				placeholder="Your answer"
				type="date"
				value={p.value ?? ""}
				onChange={(e) => p.onChange({
					value: e.target.value,
					error: e.target.validationMessage === "" ? undefined : e.target.validationMessage,
				})}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						p.onSubmit?.();
					}
				}}
			/>
		</BaseFormQuestion>
	);
};

export const FormTimeQuestion: React.FC<FormQuestionProps<TimeQuestionConfig>> = (p) => {
	return (
		<BaseFormQuestion config={p.config}>
			<TextField
				autoFocus={p.autoFocus}
				fullWidth
				placeholder="Your answer"
				type="time"
				value={p.value}
				onChange={(e) => p.onChange({
					value: e.target.value,
					error: e.target.validationMessage === "" ? undefined : e.target.validationMessage,
				})}
			/>
		</BaseFormQuestion>
	);
};

export const FormGroupQuestion: React.FC<FormQuestionProps<GroupQuestionConfig>> = (p) => {
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	return (
		<BaseFormQuestion config={p.config}>
			{
				Object.entries(p.config.questions)
					.map(([key, q], i) =>
						<Box key={key} sx={{ p: 2 }}>
							<FormQuestion
								autoFocus={p.autoFocus && i === 0}
								config={q}
								value={p.value?.[key] as any}
								onChange={(v) => {
									let newErrors = { ...errors };
									if (v.error) {
										newErrors[key] = v.error;
									} else {
										delete newErrors[key];
									}
									setErrors(newErrors);
									const newValue = { ...p.value, [key]: v.value };
									const childError = Object.keys(newErrors).length > 0 ? Object.values(newErrors)[0] : undefined;
									const incompleteError = Object.keys(newValue).length < Object.keys(p.config.questions).length ? "Please answer all questions" : undefined;
									p.onChange({
										value: newValue,
										error: childError ?? incompleteError,
									});
								}}
							/>
						</Box>
					)
			}
		</BaseFormQuestion>
	);
};

export const FormQuestion: React.FC<FormQuestionProps<QuestionConfig>> = (p) => {
	let Element: React.FC<FormQuestionProps<any>> | undefined;
	switch (p.config.type) {
		case "text":
			Element = FormTextQuestion;
			break;
		case "password":
			Element = FormPasswordQuestion;
			break;
		case "info":
			Element = FormInfoQuestion;
			break;
		case "checkboxes":
			Element = FormCheckboxesQuestion;
			break;
		case "radio":
			Element = FormRadioQuestion;
			break;
		case "dropdown":
			Element = FormDropdownQuestion;
			break;
		case "date":
			Element = FormDateQuestion;
			break;
		case "time":
			Element = FormTimeQuestion;
			break;
		case "group":
			Element = FormGroupQuestion;
			break;
		default:
			throw new Error("Unknown question type");
	}

	return <Element
		config={p.config}
		value={p.value as any}
		onChange={p.onChange}
		onSubmit={p.onSubmit}
		autoFocus={p.autoFocus}
	/>;
};

export const FormQuestionCard: React.FC<FormQuestionCardProps<QuestionConfig>> = (p) => {
	const [value, setValue] = React.useState<AnswerType<QuestionConfig>>();
	const [submitted, setSubmitted] = React.useState(false);
	const [hasError, setHasError] = React.useState(true);

	React.useEffect(() => {
		if (p.config.type === "info") {
			p.submit?.(undefined); // auto submit info questions
		}
	}, []);

	return (
		<FormCard
			onSubmit={p.config.type === "info" ? undefined : () => {
				setSubmitted(true);
				p.submit?.(value);
			}}
			disabled={submitted || hasError}
		>
			<FormQuestion
				config={p.config}
				value={value}
				onChange={(v) => {
					setValue(v.value);
					setHasError(v.error !== undefined);
				}}
				onSubmit={() => {
					if (!submitted) {
						setSubmitted(true);
						p.submit?.(value);
					}
				}}
				autoFocus={p.autoFocus}
			/>
		</FormCard>
	);
};

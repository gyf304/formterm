export function unindent(arr: TemplateStringsArray, ...args: string[]) {
	let s = String.raw(arr, ...args);
	if (s[0] !== "\n") {
		return s;
	}
	s = s.slice(1);
	const indent = s.match(/^([ \t]*)[! \t]/)?.[0] ?? "";
	const parts = s.split("\n");
	const newParts: string[] = [];
	for (let part of parts) {
		let i = 0;
		for (; i < indent.length; i++) {
			if (part[i] !== indent[i]) {
				break;
			}
		}
		newParts.push(part.slice(i));
	}
	return newParts.filter((part, i) => i !== newParts.length - 1 || part !== "").join("\n");
}

function escapeMarkdown(s: string) {
	return s.replaceAll("\\", "\\\\")
		.replaceAll(/[^a-zA-Z0-9]/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function markdown(arr: TemplateStringsArray, ...args: string[]) {
	let s = unindent(arr, ...args.map(escapeMarkdown));
	return {
		mimeType: "text/markdown",
		content: s,
	} as const;
}

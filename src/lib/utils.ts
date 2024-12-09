export function unindent(arr: TemplateStringsArray, ...args: string[]) {
	let s = String.raw(arr, ...args);
	if (s[0] !== "\n") {
		return s;
	}
	s = s.slice(1);
	if (s[s.length - 1] === "\n") {
		s = s.slice(0, s.length - 1);
	}
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
	return newParts.join("\n");
}

export function markdown(arr: TemplateStringsArray, ...args: string[]) {
	let s = unindent(arr, ...args);
	return {
		mimeType: "text/markdown",
		content: s,
	} as const;
}

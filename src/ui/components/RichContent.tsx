import * as React from "react";

import Markdown from "react-markdown";
import type { StringOrRichContent } from "../../lib";

interface RichContentProps {
	children: StringOrRichContent;
}

export const RichContent: React.FC<RichContentProps> = (p) => {
	return (
		<>
			{
				typeof p.children === "string" ? p.children :
				p.children.mimeType === "text/markdown" ? <Markdown>{p.children.content}</Markdown> :
				null
			}
		</>
	);
}

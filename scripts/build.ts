import { $ } from "bun";

await Bun.build({
	entrypoints: ["src/ui/index.tsx"],
	outdir: "dist/ui",
	minify: true,
});

await $`cp src/ui/*.html dist/ui/`;
await $`cp src/ui/*.css dist/ui/`;

await $`bun tsc -p tsconfig.build.json`;

import path from "node:path";

export const repoRoot = process.cwd();

export const generatedDir = "docs/generated";
export const generatedSourceDir = path.join(generatedDir, "source");
export const generatedQualityDir = path.join(generatedDir, "quality");

export const sourceIncludePrefixes = [
	".github/",
	"app/",
	"components/",
	"docs/",
	"lib/",
	"public/",
	"scripts/",
	"supabase/",
];

export const rootSourceFiles = new Set([
	".env.example",
	".gitignore",
	"Linted_Design_Brief.md",
	"README.md",
	"components.json",
	"eslint.config.mjs",
	"instrumentation-client.ts",
	"instrumentation.ts",
	"knip.json",
	"next-env.d.ts",
	"next.config.ts",
	"package-lock.json",
	"package.json",
	"postcss.config.mjs",
	"tailwind.config.ts",
	"tsconfig.json",
	"typedoc.json",
	"vitest.config.ts",
	"vitest.setup.ts",
]);

export const ignoredSourcePrefixes = [
	".git/",
	".next/",
	".vercel/",
	"docs/generated/",
	"node_modules/",
	"out/",
	"supabase/.temp/",
	"vercel/",
];

export const ignoredSourceFiles = new Set(["tsconfig.tsbuildinfo"]);

export function toPosixPath(filePath) {
	return filePath.split(path.sep).join("/");
}

export function isSourceFile(relativePath) {
	const normalized = toPosixPath(relativePath);
	if (ignoredSourceFiles.has(normalized)) {
		return false;
	}
	if (ignoredSourcePrefixes.some((prefix) => normalized.startsWith(prefix))) {
		return false;
	}
	if (rootSourceFiles.has(normalized)) {
		return true;
	}
	return sourceIncludePrefixes.some((prefix) => normalized.startsWith(prefix));
}

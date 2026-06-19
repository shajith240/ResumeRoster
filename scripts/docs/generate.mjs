#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
	generatedDir,
	generatedSourceDir,
	isSourceFile,
	repoRoot,
	toPosixPath,
} from "./docs-config.mjs";
import { Project, SyntaxKind, Node } from "ts-morph";
import { TSDocParser } from "@microsoft/tsdoc";

const checkMode = process.argv.includes("--check");
const sourceRoot = path.join(repoRoot);
const tsdocParser = new TSDocParser();
const generationIssues = [];

function recordGenerationIssue(relativePath, stage, error) {
	const detail =
		error instanceof Error
			? error.stack || error.message
			: typeof error === "string"
				? error
				: JSON.stringify(error);
	generationIssues.push({
		detail,
		relativePath,
		stage,
	});
}

function runGit(args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		maxBuffer: 1024 * 1024 * 20,
	});
}

function listRepoFiles() {
	const output = runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
	return output
		.split("\0")
		.filter(Boolean)
		.map(toPosixPath)
		.filter(isSourceFile)
		.filter((file) => fs.existsSync(path.join(repoRoot, file)))
		.sort((a, b) => a.localeCompare(b));
}

function sha256(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isProbablyText(buffer, ext) {
	if (buffer.includes(0)) return false;
	const textExts = new Set([
		".css",
		".example",
		".html",
		".js",
		".json",
		".md",
		".mjs",
		".sh",
		".sql",
		".svg",
		".toml",
		".ts",
		".tsx",
		".txt",
		".xml",
		".yml",
		".yaml",
	]);
	// Known text extension, or no extension (dotfiles: .gitignore, .gitattributes, etc.)
	return textExts.has(ext) || ext === "";
}

function readFile(relativePath) {
	const absolutePath = path.join(sourceRoot, relativePath);
	const buffer = fs.readFileSync(absolutePath);
	const ext = path.extname(relativePath).toLowerCase();
	const text = isProbablyText(buffer, ext) ? buffer.toString("utf8") : "";
	// Normalise CRLF → LF for text files so hash and size are identical on
	// Windows (CRLF checkout) and Linux CI (LF checkout).
	const canonical = text ? Buffer.from(text.replace(/\r\n/g, "\n")) : buffer;
	return {
		absolutePath,
		buffer,
		ext,
		hash: sha256(canonical),
		lineCount: text ? text.split(/\r\n|\r|\n/).length : 0,
		size: canonical.length,
		text,
	};
}

function classifyFile(relativePath) {
	if (relativePath.startsWith("app/api/") && relativePath.endsWith("/route.ts")) {
		return "Next API route";
	}
	if (relativePath.startsWith("app/") && relativePath.endsWith("/page.tsx")) {
		return "Next page route";
	}
	if (relativePath === "app/layout.tsx") {
		return "Next root layout";
	}
	if (relativePath.startsWith("components/ui/")) {
		return "UI primitive";
	}
	if (relativePath.startsWith("components/")) {
		return "React component";
	}
	if (relativePath.startsWith("lib/__tests__/")) {
		return "Unit test";
	}
	if (relativePath.startsWith("lib/")) {
		return "Application library module";
	}
	if (relativePath.startsWith("supabase/migrations/")) {
		return "Supabase migration";
	}
	if (relativePath === "supabase/seed.sql") {
		return "Supabase seed data";
	}
	if (relativePath.startsWith("supabase/") && relativePath.endsWith(".sql")) {
		return "Supabase SQL file outside migrations";
	}
	if (relativePath.startsWith("docs/")) {
		return "Documentation";
	}
	if (relativePath.startsWith("public/assets/")) {
		return "Public visual asset";
	}
	if (relativePath.startsWith("public/")) {
		return "Public browser asset";
	}
	if (relativePath.startsWith("scripts/")) {
		return "Repository automation";
	}
	if (relativePath.startsWith(".github/")) {
		return "GitHub workflow";
	}
	if ([".json", ".mjs", ".ts", ".toml", ".yml", ".yaml"].includes(path.extname(relativePath))) {
		return "Project configuration";
	}
	if (relativePath.endsWith(".md")) {
		return "Root documentation";
	}
	return "Project file";
}

function humanizeName(name) {
	return name
		.replace(/\.[^.]+$/, "")
		.replace(/[[\]{}()]/g, "")
		.replace(/[-_]/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function describePurpose(relativePath, kind) {
	const fileName = path.basename(relativePath);
	const stem = humanizeName(fileName);
	if (kind === "Next API route") {
		return `Handles server-side requests for the ${relativePath.replace(/^app\/api\//, "/api/").replace(/\/route\.ts$/, "")} API endpoint.`;
	}
	if (kind === "Next page route") {
		const route = relativePath.replace(/^app/, "").replace(/\/page\.tsx$/, "") || "/";
		return `Renders the ${route} page that users or admins see in the browser.`;
	}
	if (kind === "Next root layout") {
		return "Defines the shared application shell, metadata, providers, and global browser structure.";
	}
	if (kind === "React component" || kind === "UI primitive") {
		return `Provides the ${stem} interface component used by pages or other components.`;
	}
	if (kind === "Application library module") {
		return `Contains reusable ${humanizeName(path.basename(relativePath, path.extname(relativePath))).toLowerCase()} logic shared across routes, components, or tests.`;
	}
	if (kind === "Unit test") {
		return `Verifies the behavior of ${fileName.replace(/\.test\.(ts|tsx)$/, "")} with Vitest.`;
	}
	if (kind === "Supabase migration") {
		return `Applies an ordered database change for ${humanizeName(fileName)}.`;
	}
	if (kind === "Supabase seed data") {
		return "Seeds local Supabase data after migrations have built the schema.";
	}
	if (kind === "Supabase SQL file outside migrations") {
		return "Documents a Supabase SQL file that should be reviewed against the migration source-of-truth rule.";
	}
	if (kind === "Public visual asset") {
		return `Stores the ${stem} visual asset served from the public folder.`;
	}
	if (kind === "Repository automation") {
		return `Automates repository maintenance for ${humanizeName(relativePath.split("/").slice(-2).join(" "))}.`;
	}
	if (kind === "GitHub workflow") {
		return "Defines CI automation that checks the repository before merge or push.";
	}
	if (kind.includes("configuration")) {
		return `Configures ${stem} behavior for local development, CI, or production builds.`;
	}
	return `Documents or supports ${stem} in the Linted repository.`;
}

function describeEditReason(relativePath, kind) {
	if (kind === "Next API route") {
		return "Edit this when the endpoint contract, authorization, validation, database calls, or response shape changes.";
	}
	if (kind === "Next page route") {
		return "Edit this when the page-level data loading, route composition, or first-screen experience changes.";
	}
	if (kind === "React component" || kind === "UI primitive") {
		return "Edit this when the UI behavior, component props, accessibility, or visual treatment changes.";
	}
	if (kind === "Application library module") {
		return "Edit this when shared business logic, validation, ranking, privacy, auth, or helper behavior changes.";
	}
	if (kind === "Unit test") {
		return "Edit this when the tested behavior changes or a new edge case needs coverage.";
	}
	if (kind.includes("Supabase")) {
		return "Edit by adding a new migration, not by rewriting production history, unless you are intentionally maintaining legacy reference SQL.";
	}
	if (kind === "Project configuration" || kind === "GitHub workflow") {
		return "Edit this when tooling, dependency behavior, build settings, or CI requirements change.";
	}
	if (kind.includes("asset")) {
		return "Replace or optimize this when the product needs a new image, animation, worker, or browser-served file.";
	}
	return "Edit this when the documented behavior or supporting repository file changes.";
}

function makeProject(tsFiles) {
	const project = new Project({
		tsConfigFilePath: path.join(repoRoot, "tsconfig.json"),
		skipAddingFilesFromTsConfig: true,
	});
	for (const file of tsFiles) {
		project.addSourceFileAtPathIfExists(path.join(repoRoot, file));
	}
	return project;
}

function declarationLine(node) {
	return node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
}

function getExportMap(sourceFile) {
	const exported = new Set();
	for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
		exported.add(name);
		for (const declaration of declarations) {
			if (Node.isFunctionDeclaration(declaration) && declaration.getName()) {
				exported.add(declaration.getName());
			}
			if (Node.isVariableDeclaration(declaration)) {
				exported.add(declaration.getName());
			}
		}
	}
	return exported;
}

function classifyFunction(name, relativePath) {
	if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name) && relativePath.endsWith("/route.ts")) {
		return "API handler";
	}
	if (/^use[A-Z0-9]/.test(name)) {
		return "React hook";
	}
	if (/^[A-Z]/.test(name) && relativePath.endsWith(".tsx")) {
		return "React component";
	}
	if (/validate|parse|normalize|sanitize/i.test(name)) {
		return "Validation or normalization helper";
	}
	if (/fetch|load|submit|send|dispatch|create|update|delete|reset/i.test(name)) {
		return "Action helper";
	}
	return "Function";
}

function collectTsDetails(project, relativePath) {
	const sourceFile = project.getSourceFile(path.join(repoRoot, relativePath));
	if (!sourceFile) {
		recordGenerationIssue(
			relativePath,
			"typescript-load",
			"TypeScript parser could not load this file.",
		);
		return {
			error: "TypeScript parser could not load this file.",
			exports: [],
			functions: [],
			imports: [],
			types: [],
		};
	}
	const exported = getExportMap(sourceFile);
	const imports = sourceFile
		.getImportDeclarations()
		.map((declaration) => declaration.getModuleSpecifierValue())
		.sort((a, b) => a.localeCompare(b));
	const exports = [...exported].sort((a, b) => a.localeCompare(b));
	const types = [
		...sourceFile.getInterfaces().map((item) => ({
			kind: "interface",
			line: declarationLine(item),
			name: item.getName(),
		})),
		...sourceFile.getTypeAliases().map((item) => ({
			kind: "type",
			line: declarationLine(item),
			name: item.getName(),
		})),
	].sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
	const functions = [];
	const seen = new Set();
	for (const declaration of sourceFile.getFunctions()) {
		const name = declaration.getName() || "default";
		const line = declarationLine(declaration);
		const key = `${name}:${line}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		functions.push({
			async: declaration.isAsync(),
			doc: getDocSummary(declaration, relativePath, name),
			exported: exported.has(name) || declaration.isExported(),
			kind: classifyFunction(name, relativePath),
			line,
			name,
			params: declaration.getParameters().map((param) => param.getName()),
			returnType: safeTypeText(declaration, relativePath, name),
			scope: "top-level",
		});
	}
	sourceFile.forEachDescendant((node) => {
		if (!Node.isVariableDeclaration(node)) {
			return;
		}
		const initializer = node.getInitializer();
		if (!initializer) {
			return;
		}
		if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) {
			return;
		}
		const name = node.getName();
		const line = declarationLine(node);
		const key = `${name}:${line}`;
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		functions.push({
			async: initializer.isKind(SyntaxKind.ArrowFunction)
				? initializer.isAsync()
				: initializer.getAsyncKeyword() !== undefined,
			doc: getDocSummary(node, relativePath, name),
			exported: exported.has(name),
			kind: classifyFunction(name, relativePath),
			line,
			name,
			params: initializer.getParameters().map((param) => param.getName()),
			returnType: safeTypeText(initializer, relativePath, name),
			scope: isTopLevelVariable(node) ? "top-level" : "nested",
		});
	});
	return {
		exports,
		functions: functions.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name)),
		imports,
		types,
	};
}

function getDocSummary(node, relativePath, symbolName) {
	const docs = typeof node.getJsDocs === "function" ? node.getJsDocs() : [];
	const docText = docs.at(-1)?.getText();
	if (!docText) {
		const statement = node.getFirstAncestorByKind?.(SyntaxKind.VariableStatement);
		const statementDocs =
			statement && typeof statement.getJsDocs === "function" ? statement.getJsDocs() : [];
		const statementText = statementDocs.at(-1)?.getText();
		if (!statementText) {
			return "";
		}
		return parseDocSummary(statementText, relativePath, symbolName);
	}
	return parseDocSummary(docText, relativePath, symbolName);
}

function parseDocSummary(docText, relativePath, symbolName) {
	try {
		const context = tsdocParser.parseString(docText);
		const summary = context.docComment.summarySection
			.getChildNodes()
			.map((node) => node.getChildNodes().map((child) => child.toString()).join("") || node.toString())
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		return summary;
	} catch (error) {
		recordGenerationIssue(
			relativePath,
			`tsdoc:${symbolName}`,
			error,
		);
		return "";
	}
}

function isTopLevelVariable(node) {
	const statement = node.getFirstAncestorByKind(SyntaxKind.VariableStatement);
	return statement?.getParentIfKind(SyntaxKind.SourceFile) !== undefined;
}

function safeTypeText(node, relativePath, symbolName) {
	try {
		return node.getReturnType().getText(node);
	} catch (error) {
		recordGenerationIssue(
			relativePath,
			`type:${symbolName}`,
			error,
		);
		return "unknown";
	}
}

function collectCssDetails(text) {
	const classes = new Set();
	for (const match of text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
		classes.add(match[1]);
	}
	return {
		classes: [...classes].sort((a, b) => a.localeCompare(b)).slice(0, 40),
	};
}

function collectSqlDetails(text) {
	const patterns = [
		["tables", /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi],
		["policies", /create\s+policy\s+"?([^"\n]+?)"?\s+on\s+([a-zA-Z0-9_.]+)/gi],
		["functions", /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)/gi],
		["triggers", /create\s+trigger\s+([a-zA-Z0-9_]+)/gi],
		["indexes", /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)/gi],
		["views", /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-zA-Z0-9_]+)/gi],
		["types", /create\s+type\s+(?:public\.)?([a-zA-Z0-9_]+)/gi],
	];
	const details = {};
	for (const [key, regex] of patterns) {
		details[key] = [];
		for (const match of text.matchAll(regex)) {
			details[key].push(match[1]);
		}
		details[key] = [...new Set(details[key])].sort((a, b) => a.localeCompare(b));
	}
	return details;
}

function findRelatedTests(relativePath, allFiles) {
	const ext = path.extname(relativePath);
	const baseName = path.basename(relativePath, ext).replace(/\.test$/, "");
	if (!baseName || relativePath.includes("__tests__")) {
		return [];
	}
	return allFiles
		.filter((file) => file.includes("__tests__") && file.includes(`${baseName}.test`))
		.slice(0, 8);
}

function safeDocName(relativePath) {
	return relativePath.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() + ".md";
}

function formatList(items, emptyText = "None detected.") {
	if (!items || items.length === 0) {
		return emptyText;
	}
	return items.map((item) => `- \`${item}\``).join("\n");
}

function formatFunctionTable(functions) {
	if (!functions || functions.length === 0) {
		return "No stable named functions or components detected.";
	}
	const rows = [
		"| Line | Name | Kind | Scope | Exported | Parameters | Return | Doc summary |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
	];
	for (const item of functions) {
		const params = item.params
			.map((param) => `\`${cleanInline(param, 80)}\``)
			.join(", ");
		const summary = item.doc || inferFunctionSummary(item);
		rows.push(
			`| ${item.line} | \`${cleanInline(item.name, 80)}\` | ${item.kind}${item.async ? " async" : ""} | ${item.scope} | ${item.exported ? "yes" : "no"} | ${params || "none"} | \`${cleanInline(item.returnType, 140)}\` | ${cleanInline(summary, 140)} |`,
		);
	}
	return rows.join("\n");
}

function inferFunctionSummary(item) {
	const name = humanizeName(item.name).toLowerCase();
	if (item.kind === "API handler") {
		return `Handles the ${item.name} request for this API route.`;
	}
	if (item.kind === "React hook") {
		return `Provides reusable ${name} state and side effects.`;
	}
	if (item.kind === "React component") {
		return `Renders the ${humanizeName(item.name)} UI component.`;
	}
	if (item.kind === "Validation or normalization helper") {
		return `Validates or normalizes ${name} values for callers.`;
	}
	if (item.kind === "Action helper") {
		return `Runs the ${name} workflow for callers.`;
	}
	return `Implements the ${name} helper.`;
}

function cleanInline(value, maxLength = 120) {
	const cleaned = String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/`/g, "'")
		.replace(/\s+/g, " ")
		.trim();
	if (cleaned.length <= maxLength) {
		return cleaned;
	}
	return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

function formatTypeTable(types) {
	if (!types || types.length === 0) {
		return "No top-level interfaces or type aliases detected.";
	}
	const rows = ["| Line | Name | Kind |", "| --- | --- | --- |"];
	for (const item of types) {
		rows.push(`| ${item.line} | \`${item.name}\` | ${item.kind} |`);
	}
	return rows.join("\n");
}

function formatSqlList(label, items) {
	if (!items || items.length === 0) {
		return `- ${label}: none detected`;
	}
	return `- ${label}: ${items.map((item) => `\`${item}\``).join(", ")}`;
}

function makeFileDoc(file, allFiles) {
	const relatedTests = findRelatedTests(file.relativePath, allFiles);
	const title = file.relativePath;
	const details = file.details ?? {};
	const sections = [
		"<!-- AUTO-GENERATED by scripts/docs/generate.mjs. Do not edit by hand. -->",
		"",
		`# ${title}`,
		"",
		`- Source path: \`${file.relativePath}\``,
		`- Kind: ${file.kind}`,
		`- Size: ${file.size} bytes`,
		`- Lines: ${file.lineCount || "binary or not line-based"}`,
		`- Source hash: \`${file.hash}\``,
		"",
		"## What This File Does",
		"",
		file.purpose,
		"",
		"## When To Edit",
		"",
		file.editReason,
		"",
		"## Exports",
		"",
		formatList(details.exports),
		"",
		"## Imports",
		"",
		formatList(details.imports),
		"",
		"## Functions And Components",
		"",
		formatFunctionTable(details.functions),
		"",
		"## Types",
		"",
		formatTypeTable(details.types),
		"",
		"## Related Tests",
		"",
		formatList(relatedTests, "No direct test file detected by naming convention."),
	];
	if (details.classes?.length) {
		sections.push("", "## CSS Selectors", "", formatList(details.classes));
	}
	if (details.sql) {
		sections.push(
			"",
			"## SQL Objects",
			"",
			formatSqlList("Tables", details.sql.tables),
			formatSqlList("Policies", details.sql.policies),
			formatSqlList("Functions", details.sql.functions),
			formatSqlList("Triggers", details.sql.triggers),
			formatSqlList("Indexes", details.sql.indexes),
			formatSqlList("Views", details.sql.views),
			formatSqlList("Types", details.sql.types),
		);
	}
	sections.push(
		"",
		"## Notes",
		"",
		"- This page is generated from the current source tree.",
		"- Add human explanation in the curated docs, not in this generated file.",
		"",
	);
	return sections.join("\n");
}

function makeAtlas(files, manifestHash) {
	const countsByKind = new Map();
	const countsByFolder = new Map();
	for (const file of files) {
		countsByKind.set(file.kind, (countsByKind.get(file.kind) ?? 0) + 1);
		const folder = file.relativePath.includes("/")
			? file.relativePath.split("/")[0]
			: "(root)";
		countsByFolder.set(folder, (countsByFolder.get(folder) ?? 0) + 1);
	}
	const lines = [
		"<!-- AUTO-GENERATED by scripts/docs/generate.mjs. Do not edit by hand. -->",
		"",
		"# Generated Source Atlas",
		"",
		`Generated from ${files.length} source-controlled files.`,
		`Manifest hash: \`${manifestHash}\``,
		"",
		"## Folder Coverage",
		"",
		"| Folder | Files |",
		"| --- | ---: |",
		...[...countsByFolder.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([folder, count]) => `| \`${folder}\` | ${count} |`),
		"",
		"## File Kinds",
		"",
		"| Kind | Files |",
		"| --- | ---: |",
		...[...countsByKind.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([kind, count]) => `| ${kind} | ${count} |`),
		"",
		"## Files",
		"",
		"| Source | Kind | Generated page |",
		"| --- | --- | --- |",
		...files.map(
			(file) =>
				`| \`${file.relativePath}\` | ${file.kind} | [open](source/${safeDocName(file.relativePath)}) |`,
		),
		"",
	];
	return lines.join("\n");
}

function buildOutputs() {
	const relativePaths = listRepoFiles();
	const tsFiles = relativePaths.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
	const project = makeProject(tsFiles);
	const files = relativePaths.map((relativePath) => {
		const raw = readFile(relativePath);
		const kind = classifyFile(relativePath);
		const details = {};
		if (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")) {
			Object.assign(details, collectTsDetails(project, relativePath));
		}
		if (relativePath.endsWith(".css")) {
			Object.assign(details, collectCssDetails(raw.text));
		}
		if (relativePath.endsWith(".sql")) {
			details.sql = collectSqlDetails(raw.text);
		}
		return {
			details,
			editReason: describeEditReason(relativePath, kind),
			hash: raw.hash,
			kind,
			lineCount: raw.lineCount,
			purpose: describePurpose(relativePath, kind),
			relativePath,
			size: raw.size,
		};
	});
	const manifest = {
		generatedAt: "deterministic",
		generator: "scripts/docs/generate.mjs",
		ignored: [
			".next/",
			"node_modules/",
			"docs/generated/",
			"supabase/.temp/",
			".env",
		],
		files: files.map((file) => ({
			hash: file.hash,
			kind: file.kind,
			lineCount: file.lineCount,
			relativePath: file.relativePath,
			size: file.size,
			functionCount: file.details.functions?.length ?? 0,
			importCount: file.details.imports?.length ?? 0,
			exportCount: file.details.exports?.length ?? 0,
		})),
	};
	const manifestHash = sha256(Buffer.from(JSON.stringify(manifest.files)));
	manifest.manifestHash = manifestHash;
	const outputs = new Map();
	outputs.set(path.join(generatedDir, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
	outputs.set(path.join(generatedDir, "source-atlas.md"), makeAtlas(files, manifestHash));
	for (const file of files) {
		outputs.set(
			path.join(generatedSourceDir, safeDocName(file.relativePath)),
			makeFileDoc(file, relativePaths),
		);
	}
	return outputs;
}

function normalizeContent(content) {
	return content.replace(/\r\n/g, "\n");
}

function writeOutputs(outputs) {
	fs.rmSync(path.join(repoRoot, generatedSourceDir), { recursive: true, force: true });
	for (const [relativePath, content] of outputs.entries()) {
		const absolutePath = path.join(repoRoot, relativePath);
		fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
		fs.writeFileSync(absolutePath, content, "utf8");
	}
}

function checkOutputs(outputs) {
	const failures = [];
	for (const [relativePath, content] of outputs.entries()) {
		const absolutePath = path.join(repoRoot, relativePath);
		if (!fs.existsSync(absolutePath)) {
			failures.push(`${relativePath} is missing`);
			continue;
		}
		const current = fs.readFileSync(absolutePath, "utf8");
		if (normalizeContent(current) !== normalizeContent(content)) {
			failures.push(`${relativePath} is stale`);
		}
	}
	const expected = new Set([...outputs.keys()].map(toPosixPath));
	const sourceDir = path.join(repoRoot, generatedSourceDir);
	if (fs.existsSync(sourceDir)) {
		for (const fileName of fs.readdirSync(sourceDir)) {
			const relativePath = toPosixPath(path.join(generatedSourceDir, fileName));
			if (!expected.has(relativePath)) {
				failures.push(`${relativePath} is stale and should be removed`);
			}
		}
	}
	if (failures.length > 0) {
		console.error("Generated documentation is out of date:");
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		console.error("Run `npm run docs:generate` and commit the result.");
		process.exit(1);
	}
	console.log("Generated documentation is up to date.");
}

function failOnGenerationIssues() {
	if (generationIssues.length === 0) {
		return;
	}
	console.error("Generated documentation extraction failed:");
	for (const issue of generationIssues) {
		console.error(`- ${issue.relativePath} [${issue.stage}]`);
		if (issue.detail) {
			console.error(`  ${String(issue.detail).split("\n")[0]}`);
		}
	}
	process.exit(1);
}

const outputs = buildOutputs();
failOnGenerationIssues();
if (checkMode) {
	checkOutputs(outputs);
} else {
	writeOutputs(outputs);
	console.log(`Generated ${outputs.size} documentation files.`);
}

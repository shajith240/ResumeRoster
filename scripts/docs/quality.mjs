#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generatedQualityDir, repoRoot } from "./docs-config.mjs";

const checkMode = process.argv.includes("--check");

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: repoRoot,
		encoding: "utf8",
	});
	const errorText = result.error ? `\n${result.error.stack ?? result.error.message}` : "";
	return {
		code: result.status ?? 1,
		output: normalizeToolOutput(
			stripAnsi(`${result.stdout ?? ""}${result.stderr ?? ""}${errorText}`),
		).trim(),
	};
}

function stripAnsi(value) {
	const escape = String.fromCharCode(27);
	return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "");
}

function normalizeToolOutput(value) {
	return value.replace(/^time: .+$/gm, "time: deterministic");
}

function makeReport(title, command, result) {
	return [
		`# ${title}`,
		"",
		`Command: \`${command}\``,
		`Exit code: \`${result.code}\``,
		"",
		"```text",
		result.output || "No output.",
		"```",
		"",
	].join("\n");
}

function buildReports() {
	const reports = new Map();
	const toolFailures = [];
	const knipCommand = "npx knip --no-exit-code --no-progress --reporter compact";
	const knip = run(process.execPath, [
	path.join(repoRoot, "node_modules/knip/bin/knip.js"),
	"--no-exit-code",
	"--no-progress",
	"--reporter",
	"compact",
	]);
	reports.set(
		path.join(generatedQualityDir, "knip-report.md"),
		makeReport("Knip Dead-Code Report", knipCommand, knip),
	);
	if (knip.code !== 0) {
		toolFailures.push(`Knip exited with code ${knip.code}`);
	}

	const jscpdCommand =
	"npx jscpd app components lib scripts supabase --gitignore --min-lines 8 --min-tokens 80 --reporters console --exitCode 0 --noTips";
	const jscpd = run(process.execPath, [
	path.join(repoRoot, "node_modules/jscpd/bin/jscpd"),
	"app",
	"components",
	"lib",
	"scripts",
	"supabase",
	"--gitignore",
	"--min-lines",
	"8",
	"--min-tokens",
	"80",
	"--reporters",
	"console",
	"--exitCode",
	"0",
	"--noTips",
	]);
	reports.set(
		path.join(generatedQualityDir, "jscpd-report.md"),
		makeReport("jscpd Duplicate-Code Report", jscpdCommand, jscpd),
	);
	if (jscpd.code !== 0) {
		toolFailures.push(`jscpd exited with code ${jscpd.code}`);
	}

	const summary = [
	"# Code Quality Reports",
	"",
	"These reports are generated artifacts. CI checks that they are fresh so dead-code and duplicate-code findings cannot drift silently.",
	"",
	"- [Knip dead-code report](knip-report.md)",
	"- [jscpd duplicate-code report](jscpd-report.md)",
	"",
	"Use these reports to decide what to clean in a separate maintenance pass.",
	"",
].join("\n");
	reports.set(path.join(generatedQualityDir, "README.md"), summary);
	return { reports, toolFailures };
}

function writeReports(reports) {
	fs.mkdirSync(path.join(repoRoot, generatedQualityDir), { recursive: true });
	for (const [relativePath, content] of reports.entries()) {
		const absolutePath = path.join(repoRoot, relativePath);
		fs.writeFileSync(absolutePath, content, "utf8");
	}
}

function checkReports(reports) {
	const normalize = (content) => content.replace(/\r\n/g, "\n");
	const freshnessFailures = [...reports.entries()].flatMap(
		([relativePath, content]) => {
			const absolutePath = path.join(repoRoot, relativePath);
			if (!fs.existsSync(absolutePath)) {
				return [`${relativePath} is missing`];
			}
			const current = fs.readFileSync(absolutePath, "utf8");
			return normalize(current) === normalize(content)
				? []
				: [`${relativePath} is stale`];
		},
	);
	const expected = new Set(reports.keys());
	const qualityDir = path.join(repoRoot, generatedQualityDir);
	const staleFailures = fs.existsSync(qualityDir)
		? fs.readdirSync(qualityDir).flatMap((fileName) => {
				const relativePath = path.join(generatedQualityDir, fileName);
				return expected.has(relativePath)
					? []
					: [`${relativePath} is stale and should be removed`];
			})
		: [];
	const failures = [...freshnessFailures, ...staleFailures];
	if (failures.length > 0) {
		console.error("Generated quality reports are out of date:");
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		console.error("Run `npm run docs:quality` and commit the result.");
		process.exit(1);
	}
	console.log("Generated quality reports are up to date.");
}

function failOnToolErrors(toolFailures) {
	if (toolFailures.length === 0) {
		return;
	}
	console.error("Quality report generation failed:");
	for (const failure of toolFailures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

const { reports, toolFailures } = buildReports();
failOnToolErrors(toolFailures);
if (checkMode) {
	checkReports(reports);
} else {
	writeReports(reports);
	console.log("Generated documentation quality reports.");
}

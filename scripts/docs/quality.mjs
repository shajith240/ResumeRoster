#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generatedQualityDir, repoRoot } from "./docs-config.mjs";

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: repoRoot,
		encoding: "utf8",
	});
	const errorText = result.error ? `\n${result.error.stack ?? result.error.message}` : "";
	return {
		code: result.status ?? 1,
		output: stripAnsi(`${result.stdout ?? ""}${result.stderr ?? ""}${errorText}`).trim(),
	};
}

function stripAnsi(value) {
	const escape = String.fromCharCode(27);
	return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "");
}

function writeReport(fileName, title, command, result) {
	const body = [
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
	fs.writeFileSync(path.join(repoRoot, generatedQualityDir, fileName), body, "utf8");
}

fs.mkdirSync(path.join(repoRoot, generatedQualityDir), { recursive: true });

const knipCommand = "npx knip --no-exit-code --no-progress --reporter compact";
const knip = run(process.execPath, [
	path.join(repoRoot, "node_modules/knip/bin/knip.js"),
	"--no-exit-code",
	"--no-progress",
	"--reporter",
	"compact",
]);
writeReport("knip-report.md", "Knip Dead-Code Report", knipCommand, knip);

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
writeReport("jscpd-report.md", "jscpd Duplicate-Code Report", jscpdCommand, jscpd);

const summary = [
	"# Code Quality Reports",
	"",
	"These reports are generated for review only. They do not delete files and they do not block CI in V1.",
	"",
	"- [Knip dead-code report](knip-report.md)",
	"- [jscpd duplicate-code report](jscpd-report.md)",
	"",
	"Use these reports to decide what to clean in a separate maintenance pass.",
	"",
].join("\n");

fs.writeFileSync(path.join(repoRoot, generatedQualityDir, "README.md"), summary, "utf8");

console.log("Generated documentation quality reports.");

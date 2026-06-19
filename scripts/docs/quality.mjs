#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { generatedQualityDir, repoRoot } from "./docs-config.mjs";

const checkMode = process.argv.includes("--check");

// Used for knip (console output). jscpd uses runJscpdJson instead.
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

// Run jscpd via its JSON reporter so the output is platform-independent.
//
// The console reporter embeds "token" counts that are actually character-position
// differences (end.position - start.position). Files checked out with CRLF line
// endings have one extra character per line vs LF, so the same clone block
// reports 21 more "tokens" on Windows than on Linux. Switching to JSON avoids
// this: the JSON reporter sets tokens=0 and we format the output ourselves using
// only line numbers, which are identical on both platforms.
function runJscpdJson(args) {
	const tmpDir = path.join(os.tmpdir(), `jscpd-${process.pid}-${Date.now()}`);
	const result = spawnSync(
		process.execPath,
		[
			path.join(repoRoot, "node_modules/jscpd/bin/jscpd"),
			...args,
			"--reporters",
			"json",
			"--output",
			tmpDir,
		],
		{ cwd: repoRoot, encoding: "utf8" },
	);
	const exitCode = result.status ?? 1;
	try {
		const jsonFile = path.join(tmpDir, "jscpd-report.json");
		const json = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
		return { code: exitCode, output: formatJscpdJson(json) };
	} catch {
		const raw = stripAnsi(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
		return { code: exitCode, output: raw || "Failed to parse jscpd JSON output." };
	} finally {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		} catch {}
	}
}

function normalizePath(p) {
	return String(p || "").replace(/\\/g, "/");
}

function formatJscpdJson({ duplicates = [], statistics = {} }) {
	// Sort clones by first-file path then start line so output order is
	// deterministic regardless of OS file-traversal order.
	const sorted = [...duplicates].sort((a, b) => {
		const ka = `${normalizePath(a.firstFile?.name)}:${String(a.firstFile?.start ?? 0).padStart(6, "0")}`;
		const kb = `${normalizePath(b.firstFile?.name)}:${String(b.firstFile?.start ?? 0).padStart(6, "0")}`;
		return ka < kb ? -1 : ka > kb ? 1 : 0;
	});

	const lines = [];

	for (const clone of sorted) {
		const { firstFile: fA, secondFile: fB, format } = clone;
		const lineCount = (fA.end ?? 0) - (fA.start ?? 0);
		lines.push(`Clone found (${format}):`);
		lines.push(
			` - ${normalizePath(fA.name)} [${fA.startLoc?.line ?? fA.start}:${fA.startLoc?.column ?? 0} - ${fA.endLoc?.line ?? fA.end}:${fA.endLoc?.column ?? 0}] (${lineCount} lines)`,
		);
		lines.push(
			`   ${normalizePath(fB.name)} [${fB.startLoc?.line ?? fB.start}:${fB.startLoc?.column ?? 0} - ${fB.endLoc?.line ?? fB.end}:${fB.endLoc?.column ?? 0}]`,
		);
		lines.push("");
	}

	// Statistics sorted by format name. Token columns are omitted — token
	// positions are character-offset-based and differ between CRLF and LF files.
	const formats = Object.entries(statistics.formats ?? {})
		.filter(([, s]) => s?.total?.sources)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

	for (const [fmt, { total: t }] of formats) {
		lines.push(
			`${fmt}: ${t.sources} files, ${t.lines} lines, ${t.clones} clones, ${t.duplicatedLines} duplicated lines (${t.percentage}%)`,
		);
	}

	const tot = statistics.total ?? {};
	lines.push(
		`Total: ${tot.sources} files, ${tot.lines} lines, ${tot.clones} clones, ${tot.duplicatedLines} duplicated lines (${tot.percentage}%)`,
	);
	lines.push(`Found ${duplicates.length} clones.`);

	return lines.join("\n");
}

function stripAnsi(value) {
	const escape = String.fromCharCode(27);
	return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "");
}

function normalizeToolOutput(value) {
	return value
		.replace(/^time: .+$/gm, "time: deterministic")
		.replace(/\\/g, "/")
		.replace(/\r/g, "");
}

function makeReport(title, command, result, notes = []) {
	return [
		`# ${title}`,
		"",
		...notes.flatMap((note) => [note, ""]),
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
		"--no-warnings",
		"--loader",
		pathToFileURL(
			path.join(repoRoot, "scripts/docs/knip-disable-raw-transfer-loader.mjs"),
		).href,
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
		'npx jscpd app components lib scripts supabase --gitignore --ignore "supabase/migrations/**" --min-lines 8 --min-tokens 80 --reporters json --exitCode 0';
	const jscpd = runJscpdJson([
		"app",
		"components",
		"lib",
		"scripts",
		"supabase",
		"--gitignore",
		"--ignore",
		"supabase/migrations/**",
		"--min-lines",
		"8",
		"--min-tokens",
		"80",
		"--exitCode",
		"0",
	]);
	reports.set(
		path.join(generatedQualityDir, "jscpd-report.md"),
		makeReport("jscpd Duplicate-Code Report", jscpdCommand, jscpd, [
			"This actionable duplicate-code report excludes `supabase/migrations/**` because applied migrations are append-only production history.",
			"Historical migration duplication is still captured in `migration-history-jscpd-report.md` for audit and planned squash decisions.",
		]),
	);
	if (jscpd.code !== 0) {
		toolFailures.push(`jscpd exited with code ${jscpd.code}`);
	}

	const migrationJscpdCommand =
		"npx jscpd supabase/migrations --gitignore --min-lines 8 --min-tokens 80 --reporters json --exitCode 0";
	const migrationJscpd = runJscpdJson([
		"supabase/migrations",
		"--gitignore",
		"--min-lines",
		"8",
		"--min-tokens",
		"80",
		"--exitCode",
		"0",
	]);
	reports.set(
		path.join(generatedQualityDir, "migration-history-jscpd-report.md"),
		makeReport(
			"jscpd Migration-History Duplicate-Code Report",
			migrationJscpdCommand,
			migrationJscpd,
			[
				"This informational report tracks duplication inside applied Supabase migrations.",
				"Do not rewrite historical migrations to reduce this metric; use a planned migration squash or bootstrap workflow only after environment coordination.",
			],
		),
	);
	if (migrationJscpd.code !== 0) {
		toolFailures.push(`migration-history jscpd exited with code ${migrationJscpd.code}`);
	}

	const summary = [
		"# Code Quality Reports",
		"",
		"These reports are generated artifacts. CI checks that they are fresh so dead-code and duplicate-code findings cannot drift silently.",
		"",
		"- [Knip dead-code report](knip-report.md)",
		"- [jscpd duplicate-code report](jscpd-report.md) for active app/source drift",
		"- [jscpd migration-history duplicate-code report](migration-history-jscpd-report.md) for informational Supabase migration audits",
		"",
		"Use these reports to decide what to clean in a separate maintenance pass. Do not rewrite applied migrations only to reduce duplicate-code percentages.",
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
			if (normalize(current) === normalize(content)) return [];
			// Emit first differing line so CI logs show exactly what changed.
			const committedLines = normalize(current).split("\n");
			const generatedLines = normalize(content).split("\n");
			const diffIdx = committedLines.findIndex((l, i) => l !== generatedLines[i]);
			const diffHint =
				diffIdx === -1
					? `lengths differ: committed=${committedLines.length} generated=${generatedLines.length}`
					: `first diff at line ${diffIdx + 1}:\n  committed: ${JSON.stringify(committedLines[diffIdx])}\n  generated: ${JSON.stringify(generatedLines[diffIdx])}`;
			return [`${relativePath} is stale\n  ${diffHint}`];
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

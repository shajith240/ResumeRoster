#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function toPosixPath(filePath) {
	return filePath.split(path.sep).join("/");
}

function listSupabaseSqlFiles() {
	const output = execFileSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", "-z", "supabase"],
		{
			cwd: repoRoot,
			encoding: "utf8",
			maxBuffer: 1024 * 1024 * 5,
		},
	);

	return output
		.split("\0")
		.filter(Boolean)
		.map(toPosixPath)
		.filter((file) => file.endsWith(".sql"))
		.filter((file) => fs.existsSync(path.join(repoRoot, file)))
		.sort((a, b) => a.localeCompare(b));
}

function isAllowedSupabaseSql(file) {
	return file.startsWith("supabase/migrations/") || file === "supabase/seed.sql";
}

const invalidFiles = listSupabaseSqlFiles().filter(
	(file) => !isAllowedSupabaseSql(file),
);

if (invalidFiles.length > 0) {
	console.error("Supabase SQL files must be migration history or seed data.");
	console.error("Move schema changes into supabase/migrations/ instead:");
	for (const file of invalidFiles) {
		console.error(`- ${file}`);
	}
	process.exit(1);
}

console.log("Supabase SQL source-of-truth check passed.");

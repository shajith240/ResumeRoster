import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const rootDir = process.cwd();
const configPath = path.join(rootDir, "config", "performance-budgets.json");

function formatBytes(bytes) {
	return `${Math.round(bytes / 1024)} KiB`;
}

async function readJson(filePath) {
	const raw = await readFile(filePath, "utf8");
	return JSON.parse(raw);
}

async function gzipFileSize(filePath) {
	const contents = await readFile(filePath);
	return gzipSync(contents).byteLength;
}

function getRouteFiles(manifest, route) {
	const files = manifest.pages?.[route];

	if (!Array.isArray(files)) {
		throw new Error(
			`No built assets found for route "${route}". Run npm run build and check the route key.`,
		);
	}

	return files.filter((file) => /\.(css|js)$/.test(file));
}

async function measureRoute(route, files) {
	const sizes = await Promise.all(
		files.map(async (file) => {
			const filePath = path.join(rootDir, ".next", file);
			return {
				file,
				gzipBytes: await gzipFileSize(filePath),
			};
		}),
	);

	return {
		files: sizes,
		gzipBytes: sizes.reduce((total, file) => total + file.gzipBytes, 0),
		route,
	};
}

async function main() {
	const config = await readJson(configPath);
	const manifestPath = path.join(rootDir, config.manifestPath);
	const manifest = await readJson(manifestPath).catch((error) => {
		throw new Error(
			`Could not read ${config.manifestPath}. Run npm run build before npm run test:performance. ${error.message}`,
		);
	});
	const routeEntries = Object.entries(config.routes ?? {});

	if (!routeEntries.length) {
		throw new Error("No route performance budgets configured.");
	}

	const results = [];

	for (const [route, budget] of routeEntries) {
		const files = getRouteFiles(manifest, route);
		const measured = await measureRoute(route, files);
		results.push({
			...measured,
			maxGzipBytes: budget.maxGzipBytes,
		});
	}

	const failures = results.filter(
		(result) => result.gzipBytes > result.maxGzipBytes,
	);

	for (const result of results) {
		const status = result.gzipBytes > result.maxGzipBytes ? "FAIL" : "PASS";
		console.log(
			`${status} ${result.route}: ${formatBytes(result.gzipBytes)} / ${formatBytes(
				result.maxGzipBytes,
			)} gzip across ${result.files.length} assets`,
		);
	}

	if (failures.length) {
		console.error("\nPerformance budget failures:");
		for (const failure of failures) {
			console.error(
				`- ${failure.route}: ${formatBytes(failure.gzipBytes)} exceeds ${formatBytes(
					failure.maxGzipBytes,
				)}`,
			);
		}
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});

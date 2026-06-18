import { access, readdir, readFile } from "node:fs/promises";
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

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function toManifestPath(filePath) {
	return filePath.split(path.sep).join("/");
}

async function resolveBuiltFile(file) {
	const absoluteFile = path.join(rootDir, ".next", file);
	const directory = path.dirname(file);
	const absoluteDirectory = path.join(rootDir, ".next", directory);
	const extension = path.extname(file);
	const basename = path.basename(file, extension);
	const entries = await readdir(absoluteDirectory).catch(() => []);
	const hashedMatch = entries
		.filter(
			(entry) =>
				entry.startsWith(`${basename}-`) && entry.endsWith(extension),
		)
		.sort()[0];

	if (hashedMatch) {
		return toManifestPath(path.join(directory, hashedMatch));
	}

	if (await fileExists(absoluteFile)) {
		return toManifestPath(file);
	}

	const match = entries
		.filter((entry) => entry === `${basename}${extension}`)
		.sort()[0];

	if (!match) {
		throw new Error(`Built asset "${file}" was not found in .next output.`);
	}

	return toManifestPath(path.join(directory, match));
}

async function tryResolveBuiltFile(file) {
	try {
		return await resolveBuiltFile(file);
	} catch {
		return null;
	}
}

async function resolveManifestFile(file) {
	const resolved = await tryResolveBuiltFile(file);

	if (resolved) {
		return resolved;
	}

	if (/\.css$/.test(file)) {
		return null;
	}

	throw new Error(`Built asset "${file}" was not found in .next output.`);
}

async function inferRouteFiles(route) {
	const routePath = route.replace(/^\/+/, "");
	const routeAsset = `static/chunks/app/${routePath}.js`;
	const routeCssAsset = `static/css/app/${routePath}.css`;
	const files = await Promise.all(
		[
			"static/chunks/webpack.js",
			"static/chunks/main-app.js",
			routeAsset,
		].map(resolveBuiltFile),
	);
	const routeCss = await tryResolveBuiltFile(routeCssAsset);

	if (routeCss) {
		files.push(routeCss);
	}

	return files;
}

async function getRouteFiles(manifest, route) {
	const manifestFiles = manifest.pages?.[route];
	const files = Array.isArray(manifestFiles)
		? await Promise.all(manifestFiles.map(resolveManifestFile))
		: await inferRouteFiles(route);

	return [
		...new Set(
			files.filter((file) => typeof file === "string" && /\.(css|js)$/.test(file)),
		),
	];
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
		const files = await getRouteFiles(manifest, route);
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

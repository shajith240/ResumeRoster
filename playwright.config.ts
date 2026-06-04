import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const localBaseUrl = `http://127.0.0.1:${port}`;
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? localBaseUrl;
const shouldStartLocalServer = !process.env.PLAYWRIGHT_TEST_BASE_URL;

export default defineConfig({
	expect: {
		timeout: 10_000,
	},
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: true,
	outputDir: "test-results/playwright",
	projects: [
		{
			name: "e2e",
			testMatch: /.*\.e2e\.ts/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { height: 900, width: 1280 },
			},
		},
		{
			name: "a11y",
			testMatch: /.*\.a11y\.ts/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { height: 900, width: 1280 },
			},
		},
		{
			name: "visual-mobile",
			testMatch: /.*\.visual\.ts/,
			use: {
				...devices["Pixel 5"],
				colorScheme: "dark",
			},
		},
		{
			name: "visual-desktop",
			testMatch: /.*\.visual\.ts/,
			use: {
				...devices["Desktop Chrome"],
				colorScheme: "dark",
				viewport: { height: 900, width: 1440 },
			},
		},
	],
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	retries: process.env.CI ? 1 : 0,
	testDir: "./tests/browser",
	timeout: 30_000,
	use: {
		baseURL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	webServer: shouldStartLocalServer
		? {
				command: "npm run start:test",
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
				url: localBaseUrl,
			}
		: undefined,
	workers: process.env.CI ? 2 : undefined,
});

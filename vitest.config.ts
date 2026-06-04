import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL(".", import.meta.url)),
		},
	},
	test: {
		coverage: {
			exclude: [
				"**/*.d.ts",
				"**/*.test.*",
				"**/__tests__/**",
				".next/**",
				"docs/**",
				"lib/supabase/types.ts",
				"node_modules/**",
				"playwright.config.ts",
				"tests/**",
			],
			include: ["app/api/**/*.ts", "lib/**/*.ts"],
			provider: "v8",
			reporter: ["text", "lcov"],
			reportsDirectory: "coverage",
			thresholds: {
				branches: 40,
				functions: 55,
				lines: 55,
				statements: 55,
			},
		},
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
	},
});

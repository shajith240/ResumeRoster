import { describe, expect, it } from "vitest";
import { getPwaInstallPlatform } from "@/lib/pwa-install";

describe("pwa-install", () => {
	it("detects Android browsers for native install prompts", () => {
		expect(
			getPwaInstallPlatform({
				maxTouchPoints: 5,
				platform: "Linux armv8l",
				userAgent:
					"Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36",
			}),
		).toBe("android");
	});

	it("detects iPhone and iPadOS Safari manual install flows", () => {
		expect(
			getPwaInstallPlatform({
				maxTouchPoints: 5,
				platform: "iPhone",
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
			}),
		).toBe("ios");

		expect(
			getPwaInstallPlatform({
				maxTouchPoints: 5,
				platform: "MacIntel",
				userAgent:
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
			}),
		).toBe("ios");
	});

	it("keeps desktop browsers on the desktop install path", () => {
		expect(
			getPwaInstallPlatform({
				maxTouchPoints: 0,
				platform: "Win32",
				userAgent:
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
			}),
		).toBe("desktop");
	});
});

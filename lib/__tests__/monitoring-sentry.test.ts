import { afterEach, describe, expect, it } from "vitest";
import {
	getErrorMonitoringTracesSampleRate,
	scrubErrorMonitoringEvent,
} from "@/lib/monitoring/error-monitoring";

describe("error monitoring helpers", () => {
	afterEach(() => {
		delete process.env.NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE;
		delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
		delete process.env.SENTRY_TRACES_SAMPLE_RATE;
	});

	it("redacts obvious contact details and sensitive keys", () => {
		const event = {
			message: "Contact me at person@example.com or (555) 123-4567",
			request: {
				headers: {
					authorization: "Bearer secret",
					"x-safe-header": "ok",
				},
			},
		};

		expect(scrubErrorMonitoringEvent(event)).toEqual({
			message: "Contact me at [redacted-email] or [redacted-phone]",
			request: {
				headers: {
					authorization: "[redacted]",
					"x-safe-header": "ok",
				},
			},
		});
	});

	it("keeps trace sampling inside Sentry's accepted range", () => {
		process.env.NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE = "4";
		expect(getErrorMonitoringTracesSampleRate()).toBe(1);

		process.env.NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE = "-2";
		expect(getErrorMonitoringTracesSampleRate()).toBe(0);

		process.env.NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE =
			"not-a-number";
		expect(getErrorMonitoringTracesSampleRate(0.2)).toBe(0.2);
	});
});

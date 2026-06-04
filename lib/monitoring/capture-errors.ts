import * as Sentry from "@sentry/nextjs";
import { scrubErrorMonitoringEvent } from "./error-monitoring";

export type PrivateErrorContext = {
	area?: string;
	operation?: string;
	route?: string;
	[key: string]: unknown;
};

function normalizeError(error: unknown) {
	if (error instanceof Error) return error;

	return new Error(
		typeof error === "string" ? error : "Non-Error exception captured.",
	);
}

function stringTag(value: unknown) {
	return typeof value === "string" && value ? value.slice(0, 200) : undefined;
}

export function capturePrivateError(
	error: unknown,
	context: PrivateErrorContext = {},
) {
	const tags: Record<string, string> = {};
	const area = stringTag(context.area);
	const operation = stringTag(context.operation);
	const route = stringTag(context.route);

	if (area) tags.area = area;
	if (operation) tags.operation = operation;
	if (route) tags.route = route;

	Sentry.captureException(normalizeError(error), {
		extra: scrubErrorMonitoringEvent({ ...context }),
		tags,
	});
}

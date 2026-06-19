import * as Sentry from "@sentry/nextjs";
import {
	getErrorMonitoringDsn,
	getErrorMonitoringEnvironment,
	getErrorMonitoringTracesSampleRate,
	scrubErrorMonitoringEvent,
} from "@/lib/monitoring/error-monitoring";

const dsn = getErrorMonitoringDsn();

Sentry.init({
	dsn,
	enabled: Boolean(dsn),
	environment: getErrorMonitoringEnvironment(),
	sendDefaultPii: false,
	tracesSampleRate: getErrorMonitoringTracesSampleRate(),
	beforeSend(event) {
		return scrubErrorMonitoringEvent(event);
	},
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

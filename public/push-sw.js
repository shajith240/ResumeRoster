const DEFAULT_URL = "/feed";
const ICON_URL = "/assets/linted/app-icon-192.png";

function toSafePath(value) {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
		return DEFAULT_URL;
	}

	return value;
}

function readPushPayload(event) {
	if (!event.data) return {};

	try {
		return event.data.json();
	} catch (_error) {
		return {
			body: event.data.text(),
			title: "Linted",
		};
	}
}

self.addEventListener("push", (event) => {
	const payload = readPushPayload(event);
	const title =
		typeof payload.title === "string" && payload.title.trim()
			? payload.title.trim()
			: "Linted";
	const body =
		typeof payload.body === "string" && payload.body.trim()
			? payload.body.trim()
			: "Open Linted to see the update.";

	event.waitUntil(
		self.registration.showNotification(title, {
			badge: ICON_URL,
			body,
			data: {
				notificationId: payload.notificationId,
				url: toSafePath(payload.url),
			},
			icon: ICON_URL,
			requireInteraction: false,
			tag:
				typeof payload.tag === "string" && payload.tag.trim()
					? payload.tag.trim()
					: "linted-notification",
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const targetPath = toSafePath(event.notification.data?.url);
	const targetUrl = new URL(targetPath, self.location.origin).href;

	event.waitUntil(
		self.clients
			.matchAll({ includeUncontrolled: true, type: "window" })
			.then((clients) => {
				for (const client of clients) {
					const clientUrl = new URL(client.url);
					if (clientUrl.origin === self.location.origin) {
						if ("navigate" in client) {
							client.navigate(targetUrl);
						}
						return client.focus();
					}
				}

				return self.clients.openWindow(targetUrl);
			}),
	);
});

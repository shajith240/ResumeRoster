"use client";

import { supabase } from "@/lib/supabase/client";

export type PushCapabilityStatus =
	| "blocked"
	| "disabled"
	| "enabled"
	| "unavailable"
	| "unsupported";

export type PushCapability = {
	permission: NotificationPermission | "unsupported";
	status: PushCapabilityStatus;
};

const PUSH_SERVICE_WORKER_PATH = "/push-sw.js";

function getPublicKey() {
	return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
}

function isPushSupported() {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		window.isSecureContext
	);
}

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = `${base64String}${padding}`
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let index = 0; index < rawData.length; index += 1) {
		outputArray[index] = rawData.charCodeAt(index);
	}

	return outputArray;
}

async function getAuthHeader() {
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session?.access_token) {
		throw new Error("Sign in again before enabling phone alerts.");
	}

	return {
		Authorization: `Bearer ${session.access_token}`,
		"Content-Type": "application/json",
	};
}

async function getServiceWorkerRegistration() {
	const existing = await navigator.serviceWorker.getRegistration("/");
	if (existing) return existing;

	await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH, {
		scope: "/",
		updateViaCache: "none",
	});

	return navigator.serviceWorker.ready;
}

async function saveSubscription(subscription: PushSubscription) {
	const response = await fetch("/api/push/subscriptions", {
		body: JSON.stringify(subscription.toJSON()),
		headers: await getAuthHeader(),
		method: "POST",
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as
			| { message?: string }
			| null;
		throw new Error(payload?.message || "Could not enable phone alerts.");
	}
}

export async function getPushCapability(): Promise<PushCapability> {
	if (!isPushSupported()) {
		return { permission: "unsupported", status: "unsupported" };
	}

	if (!getPublicKey()) {
		return { permission: Notification.permission, status: "unavailable" };
	}

	if (Notification.permission === "denied") {
		return { permission: "denied", status: "blocked" };
	}

	const registration = await navigator.serviceWorker.getRegistration("/");
	const subscription = await registration?.pushManager.getSubscription();

	return {
		permission: Notification.permission,
		status: subscription ? "enabled" : "disabled",
	};
}

export async function enablePushNotifications() {
	if (!isPushSupported()) {
		throw new Error("This browser does not support phone alerts yet.");
	}

	const publicKey = getPublicKey();
	if (!publicKey) {
		throw new Error("Phone alerts are not configured yet.");
	}

	const permission =
		Notification.permission === "default"
			? await Notification.requestPermission()
			: Notification.permission;

	if (permission !== "granted") {
		throw new Error("Notifications are blocked for Linted in this browser.");
	}

	const registration = await getServiceWorkerRegistration();
	const existingSubscription =
		await registration.pushManager.getSubscription();
	const subscription =
		existingSubscription ??
		(await registration.pushManager.subscribe({
			applicationServerKey: urlBase64ToUint8Array(publicKey),
			userVisibleOnly: true,
		}));

	await saveSubscription(subscription);

	return subscription;
}

export async function syncPushSubscription() {
	const capability = await getPushCapability();
	if (capability.status !== "enabled") return capability;

	const registration = await navigator.serviceWorker.getRegistration("/");
	const subscription = await registration?.pushManager.getSubscription();
	if (subscription) {
		await saveSubscription(subscription);
	}

	return capability;
}

export async function disablePushNotifications() {
	if (!isPushSupported()) return;

	const registration = await navigator.serviceWorker.getRegistration("/");
	const subscription = await registration?.pushManager.getSubscription();
	const endpoint = subscription?.endpoint;

	const response = await fetch("/api/push/subscriptions", {
		body: JSON.stringify({ endpoint }),
		headers: await getAuthHeader(),
		method: "DELETE",
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as
			| { message?: string }
			| null;
		throw new Error(payload?.message || "Could not disable phone alerts.");
	}

	await subscription?.unsubscribe();
}

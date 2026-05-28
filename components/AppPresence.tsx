"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
	APP_PRESENCE_CHANNEL,
	APP_PRESENCE_CHANGE_EVENT,
	PROFILE_CHANGE_EVENT,
	isPresenceFeatureError,
	normalizeAppStatus,
	type AppPresencePayload,
} from "@/lib/app-presence";
import { supabase } from "@/lib/supabase/client";
import type { AppStatus } from "@/lib/supabase/types";

type AppPresenceProps = {
	userId: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const PRESENCE_SESSION_KEY = "linted.presence.session";

async function getSavedStatus(userId: string): Promise<AppStatus> {
	const result = await supabase
		.from("profiles")
		.select("app_status")
		.eq("id", userId)
		.maybeSingle();

	if (result.error) return "online";

	return normalizeAppStatus(result.data?.app_status);
}

function getPresenceSessionId(userId: string) {
	if (typeof window === "undefined") return userId;

	const stored = window.sessionStorage.getItem(PRESENCE_SESSION_KEY);
	if (stored?.startsWith(`${userId}:`)) return stored;

	const randomId =
		typeof window.crypto?.randomUUID === "function"
			? window.crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const sessionId = `${userId}:${randomId}`;
	window.sessionStorage.setItem(PRESENCE_SESSION_KEY, sessionId);
	return sessionId;
}

function buildPresencePayload(
	userId: string,
	sessionId: string,
	status: AppStatus,
): AppPresencePayload {
	return {
		user_id: userId,
		session_id: sessionId,
		status,
		online_at: new Date().toISOString(),
	};
}

function announcePresenceChange(payload: AppPresencePayload) {
	window.dispatchEvent(
		new CustomEvent<AppPresencePayload>(APP_PRESENCE_CHANGE_EVENT, {
			detail: payload,
		}),
	);
}

export default function AppPresence({ userId }: AppPresenceProps) {
	const channelRef = useRef<RealtimeChannel | null>(null);
	const realtimeSubscribedRef = useRef(false);
	const sessionIdRef = useRef("");
	const statusRef = useRef<AppStatus>("online");
	const heartbeatTimerRef = useRef<number | null>(null);
	const presenceFeatureReadyRef = useRef(true);

	useEffect(() => {
		let mounted = true;
		sessionIdRef.current = getPresenceSessionId(userId);

		async function trackRealtimePresence(status = statusRef.current) {
			statusRef.current = status;
			const channel = channelRef.current;
			if (!channel || !realtimeSubscribedRef.current) return;

			const payload = buildPresencePayload(
				userId,
				sessionIdRef.current,
				status,
			);
			await channel.track(payload);
			if (mounted) announcePresenceChange(payload);
		}

		async function recordPresence(status = statusRef.current) {
			statusRef.current = status;
			if (!presenceFeatureReadyRef.current) return false;

			const { error } = await supabase.rpc("record_app_presence", {
				app_status: status,
				session_id: sessionIdRef.current,
			});

			if (error) {
				if (isPresenceFeatureError(error)) {
					presenceFeatureReadyRef.current = false;
					if (heartbeatTimerRef.current) {
						window.clearInterval(heartbeatTimerRef.current);
						heartbeatTimerRef.current = null;
					}
				}
				return false;
			}

			if (!error && mounted) {
				announcePresenceChange(
					buildPresencePayload(userId, sessionIdRef.current, status),
				);
			}
			return true;
		}

		function scheduleHeartbeat() {
			if (heartbeatTimerRef.current) {
				window.clearInterval(heartbeatTimerRef.current);
			}

			heartbeatTimerRef.current = window.setInterval(() => {
				void recordPresence();
			}, HEARTBEAT_INTERVAL_MS);
		}

		async function startPresence() {
			const savedStatus = await getSavedStatus(userId);
			if (!mounted) return;
			statusRef.current = savedStatus;

			const channel = supabase.channel(APP_PRESENCE_CHANNEL, {
				config: {
					presence: {
						key: sessionIdRef.current,
					},
				},
			});
			channelRef.current = channel;

			channel.subscribe((subscriptionStatus) => {
				if (subscriptionStatus !== "SUBSCRIBED" || !mounted) return;
				realtimeSubscribedRef.current = true;
				void trackRealtimePresence(statusRef.current);
			});

			const recorded = await recordPresence(savedStatus);
			if (!mounted) return;
			if (recorded) scheduleHeartbeat();
		}

		function handleProfileChange(event: Event) {
			const detail = (event as CustomEvent<{ id?: string; app_status?: string }>)
				.detail;
			if (!detail?.app_status || (detail.id && detail.id !== userId)) return;
			const nextStatus = normalizeAppStatus(detail.app_status);
			void trackRealtimePresence(nextStatus);
			void recordPresence(nextStatus);
		}

		function handleVisibilityChange() {
			if (document.visibilityState === "visible") {
				void trackRealtimePresence();
				void recordPresence();
			}
		}

		function clearPresence() {
			if (!presenceFeatureReadyRef.current || !sessionIdRef.current) return;
			void supabase.rpc("clear_app_presence", {
				session_id: sessionIdRef.current,
			});
		}

		window.addEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pagehide", clearPresence);
		void startPresence();

		return () => {
			mounted = false;
			window.removeEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pagehide", clearPresence);
			if (heartbeatTimerRef.current) {
				window.clearInterval(heartbeatTimerRef.current);
				heartbeatTimerRef.current = null;
			}
			const channel = channelRef.current;
			if (channel) {
				void channel.untrack();
				void supabase.removeChannel(channel);
			}
			channelRef.current = null;
			realtimeSubscribedRef.current = false;
			clearPresence();
		};
	}, [userId]);

	return null;
}

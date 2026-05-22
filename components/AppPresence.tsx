"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
	APP_PRESENCE_CHANNEL,
	PROFILE_CHANGE_EVENT,
	normalizeAppStatus,
	type AppPresencePayload,
} from "@/lib/app-presence";
import { supabase } from "@/lib/supabase/client";
import type { AppStatus } from "@/lib/supabase/types";

type AppPresenceProps = {
	userId: string;
};

async function getSavedStatus(userId: string): Promise<AppStatus> {
	const result = await supabase
		.from("profiles")
		.select("app_status")
		.eq("id", userId)
		.maybeSingle();

	if (result.error) return "online";

	return normalizeAppStatus(result.data?.app_status);
}

function buildPresencePayload(
	userId: string,
	status: AppStatus,
): AppPresencePayload | null {
	if (status === "offline") return null;

	return {
		user_id: userId,
		status,
		online_at: new Date().toISOString(),
	};
}

export default function AppPresence({ userId }: AppPresenceProps) {
	const channelRef = useRef<RealtimeChannel | null>(null);
	const subscribedRef = useRef(false);
	const statusRef = useRef<AppStatus>("online");

	useEffect(() => {
		let mounted = true;

		async function syncPresence(status: AppStatus) {
			statusRef.current = status;
			const channel = channelRef.current;
			if (!channel || !subscribedRef.current) return;

			const payload = buildPresencePayload(userId, status);
			if (!payload) {
				await channel.untrack();
				return;
			}

			await channel.track(payload);
		}

		async function startPresence() {
			const savedStatus = await getSavedStatus(userId);
			if (!mounted) return;

			statusRef.current = savedStatus;
			const channel = supabase.channel(APP_PRESENCE_CHANNEL, {
				config: {
					presence: {
						key: userId,
					},
				},
			});
			channelRef.current = channel;

			channel.subscribe((subscriptionStatus) => {
				if (subscriptionStatus !== "SUBSCRIBED" || !mounted) return;
				subscribedRef.current = true;
				void syncPresence(statusRef.current);
			});
		}

		function handleProfileChange(event: Event) {
			const detail = (event as CustomEvent<{ id?: string; app_status?: string }>)
				.detail;
			if (!detail?.app_status || (detail.id && detail.id !== userId)) return;
			void syncPresence(normalizeAppStatus(detail.app_status));
		}

		window.addEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);
		void startPresence();

		return () => {
			mounted = false;
			window.removeEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);
			const channel = channelRef.current;
			if (channel) {
				void channel.untrack();
				void supabase.removeChannel(channel);
			}
			channelRef.current = null;
			subscribedRef.current = false;
		};
	}, [userId]);

	return null;
}


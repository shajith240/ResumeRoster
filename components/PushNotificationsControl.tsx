"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	disablePushNotifications,
	enablePushNotifications,
	getPushCapability,
	syncPushSubscription,
	type PushCapabilityStatus,
} from "@/lib/push-notifications";

type ControlStatus = PushCapabilityStatus | "checking" | "working";

export default function PushNotificationsControl() {
	const [status, setStatus] = useState<ControlStatus>("checking");

	const refresh = useCallback(async () => {
		try {
			const capability = await getPushCapability();
			setStatus(capability.status);

			if (capability.status === "enabled") {
				void syncPushSubscription();
			}
		} catch {
			setStatus("unavailable");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const enable = useCallback(async () => {
		setStatus("working");
		try {
			await enablePushNotifications();
			setStatus("enabled");
			toast.success("Phone alerts enabled.");
		} catch (error) {
			await refresh();
			toast.error(
				error instanceof Error
					? error.message
					: "Could not enable phone alerts.",
			);
		}
	}, [refresh]);

	const disable = useCallback(async () => {
		setStatus("working");
		try {
			await disablePushNotifications();
			setStatus("disabled");
			toast.success("Phone alerts disabled.");
		} catch (error) {
			await refresh();
			toast.error(
				error instanceof Error
					? error.message
					: "Could not disable phone alerts.",
			);
		}
	}, [refresh]);

	if (
		status === "checking" ||
		status === "unsupported" ||
		status === "unavailable"
	) {
		return null;
	}

	if (status === "blocked") {
		return (
			<Button
				disabled
				size="xs"
				title="Enable notifications from your browser settings."
				type="button"
				variant="outline"
			>
				<BellOff className="size-3" />
				Blocked
			</Button>
		);
	}

	const working = status === "working";
	const enabled = status === "enabled";

	return (
		<Button
			disabled={working}
			onClick={() => void (enabled ? disable() : enable())}
			size="xs"
			type="button"
			variant={enabled ? "secondary" : "outline"}
		>
			{working ? (
				<Loader2 className="size-3 animate-spin" />
			) : (
				<BellRing className="size-3" />
			)}
			{enabled ? "Phone on" : "Phone alerts"}
		</Button>
	);
}

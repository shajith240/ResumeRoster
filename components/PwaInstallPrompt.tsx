"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Menu, Plus, Share2, Smartphone } from "@/components/ui/solar-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	PWA_INSTALL_OPEN_EVENT,
	getPwaInstallPlatform,
	isPwaStandalone,
	type PwaInstallPlatform,
} from "@/lib/pwa-install";

type BeforeInstallPromptChoice = {
	outcome: "accepted" | "dismissed";
	platform: string;
};

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<BeforeInstallPromptChoice>;
};

function getPlatformCopy(platform: PwaInstallPlatform, canPrompt: boolean) {
	if (canPrompt) {
		return {
			body: "Add Linted to your home screen for faster resume checks. No app store, no extra account.",
			steps: [
				"Tap Install.",
				"Confirm in your browser.",
				"Open Linted from your home screen.",
			],
			title: "Install Linted",
		};
	}

	if (platform === "ios") {
		return {
			body: "iPhone uses Safari's Share menu for web app installs.",
			steps: [
				"Open Linted in Safari.",
				"Tap Share.",
				"Choose Add to Home Screen.",
			],
			title: "Add Linted to Home Screen",
		};
	}

	if (platform === "android") {
		return {
			body: "Your browser did not expose the one-tap prompt yet, but you can still add Linted manually.",
			steps: [
				"Open your browser menu.",
				"Tap Install app or Add to Home screen.",
				"Confirm Linted.",
			],
			title: "Add Linted to Home Screen",
		};
	}

	return {
		body: "Install support depends on your browser. Linted is ready to use from the browser menu when available.",
		steps: [
			"Open the browser menu or address-bar install icon.",
			"Choose Install app.",
			"Open Linted from your launcher.",
		],
		title: "Install Linted",
	};
}

function getStepIcon(index: number, platform: PwaInstallPlatform, canPrompt: boolean) {
	if (canPrompt && index === 0) return Download;
	if (platform === "ios" && index === 1) return Share2;
	if (index === 1) return Menu;
	if (index === 2) return CheckCircle2;
	return Plus;
}

export default function PwaInstallPrompt() {
	const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
	const [canPrompt, setCanPrompt] = useState(false);
	const [installing, setInstalling] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);
	const [open, setOpen] = useState(false);
	const [platform, setPlatform] = useState<PwaInstallPlatform>("other");

	useEffect(() => {
		setPlatform(getPwaInstallPlatform(window.navigator));
		setIsInstalled(isPwaStandalone());

		function handleBeforeInstallPrompt(event: Event) {
			event.preventDefault();
			deferredPromptRef.current = event as BeforeInstallPromptEvent;
			setCanPrompt(true);
		}

		function handleInstalled() {
			deferredPromptRef.current = null;
			setCanPrompt(false);
			setInstalling(false);
			setIsInstalled(true);
			setOpen(false);
			toast.success("Linted installed.");
		}

		function handleOpenInstall() {
			if (isPwaStandalone()) {
				setIsInstalled(true);
				toast.success("Linted is already installed.");
				return;
			}

			setPlatform(getPwaInstallPlatform(window.navigator));
			setOpen(true);
		}

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleInstalled);
		window.addEventListener(PWA_INSTALL_OPEN_EVENT, handleOpenInstall);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
			window.removeEventListener("appinstalled", handleInstalled);
			window.removeEventListener(PWA_INSTALL_OPEN_EVENT, handleOpenInstall);
		};
	}, []);

	async function handleNativeInstall() {
		const promptEvent = deferredPromptRef.current;
		if (!promptEvent) return;

		setInstalling(true);
		try {
			await promptEvent.prompt();
			const choice = await promptEvent.userChoice;
			deferredPromptRef.current = null;
			setCanPrompt(false);

			if (choice.outcome === "accepted") {
				toast.success("Install started.");
				setOpen(false);
			}
		} catch {
			toast.error("Could not open the install prompt.");
		} finally {
			setInstalling(false);
		}
	}

	const nativePromptReady = canPrompt && !isInstalled;
	const copy = getPlatformCopy(platform, nativePromptReady);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="pwa-install-dialog">
				<DialogHeader className="pwa-install-header">
					<span className="pwa-install-icon" aria-hidden="true">
						<Smartphone />
					</span>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.body}</DialogDescription>
				</DialogHeader>

				<ol className="pwa-install-steps">
					{copy.steps.map((step, index) => {
						const StepIcon = getStepIcon(index, platform, nativePromptReady);
						return (
							<li key={step}>
								<span aria-hidden="true">
									<StepIcon />
								</span>
								<p>{step}</p>
							</li>
						);
					})}
				</ol>

				<DialogFooter className="pwa-install-actions">
					<DialogClose asChild>
						<Button className="pwa-install-secondary" variant="ghost">
							{nativePromptReady ? "Not now" : "Done"}
						</Button>
					</DialogClose>
					{nativePromptReady ? (
						<Button
							className="pwa-install-primary"
							disabled={installing}
							onClick={() => void handleNativeInstall()}
							variant="brand"
						>
							<Download aria-hidden="true" />
							{installing ? "Opening..." : "Install"}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

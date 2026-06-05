export const PWA_INSTALL_OPEN_EVENT = "linted-pwa-install-open";

export type PwaInstallPlatform = "android" | "desktop" | "ios" | "other";

type NavigatorWithStandalone = Navigator & {
	standalone?: boolean;
};

export function getPwaInstallPlatform(
	navigatorLike: Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent">,
): PwaInstallPlatform {
	const userAgent = navigatorLike.userAgent.toLowerCase();
	const platform = navigatorLike.platform;
	const looksLikeIpadOS =
		platform === "MacIntel" && navigatorLike.maxTouchPoints > 1;

	if (/iphone|ipad|ipod/.test(userAgent) || looksLikeIpadOS) {
		return "ios";
	}

	if (/android/.test(userAgent)) {
		return "android";
	}

	if (/macintosh|windows|linux|cros/.test(userAgent)) {
		return "desktop";
	}

	return "other";
}

export function isPwaStandalone() {
	if (typeof window === "undefined") return false;

	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		(window.navigator as NavigatorWithStandalone).standalone === true
	);
}

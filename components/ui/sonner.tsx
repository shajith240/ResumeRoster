"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

type Theme = NonNullable<ToasterProps["theme"]>;

function getAppToastTheme(): Theme {
	if (typeof document === "undefined") return "system";
	return document.body.classList.contains("main-app-dark") ? "dark" : "light";
}

export function Toaster(props: ToasterProps) {
	const [theme, setTheme] = useState<Theme>("system");

	useEffect(() => {
		const syncTheme = () => setTheme(getAppToastTheme());
		const observer = new MutationObserver(syncTheme);

		syncTheme();
		observer.observe(document.body, {
			attributeFilter: ["class"],
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	return (
		<Sonner
			className="toaster group"
			offset="calc(var(--app-header-height) + 14px)"
			position="top-center"
			theme={theme}
			toastOptions={{
				classNames: {
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
					description: "group-[.toast]:text-muted-foreground",
					toast:
						"group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
				},
				duration: 3600,
			}}
			{...props}
		/>
	);
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/supabase/client";

type LandingCtaProps = {
	children: React.ReactNode;
	className: string;
	href: string;
	isSignedIn: boolean;
};

export default function LandingCta({
	children,
	className,
	href,
	isSignedIn,
}: LandingCtaProps) {
	const [message, setMessage] = useState("");

	if (isSignedIn) {
		return (
			<Link className={className} href={href}>
				{children}
			</Link>
		);
	}

	return (
		<>
			<button
				className={className}
				type="button"
				onClick={() => {
					setMessage("");
					void signInWithGoogle(href).catch((error: Error) => {
						setMessage(error.message || "Google sign-in could not start.");
					});
				}}
			>
				{children}
			</button>
			{message ? <span className="auth-inline-error">{message}</span> : null}
		</>
	);
}

"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
	error: Error & { digest?: string };
	reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
	useEffect(() => {
		let isMounted = true;

		void import("@sentry/react")
			.then(({ captureException }) => {
				if (isMounted) {
					captureException(error);
				}
			})
			.catch(() => {
				// The error UI must remain usable even if monitoring cannot load.
			});

		return () => {
			isMounted = false;
		};
	}, [error]);

	return (
		<html lang="en">
			<body>
				<main
					style={{
						display: "grid",
						minHeight: "100vh",
						placeItems: "center",
						background: "#101112",
						color: "#f7f2ea",
						fontFamily:
							"var(--font-app-body), ui-sans-serif, system-ui, sans-serif",
						padding: 24,
					}}
				>
					<section style={{ maxWidth: 460, textAlign: "center" }}>
						<h1
							style={{
								fontFamily: "var(--font-display), serif",
								fontSize: 48,
								fontWeight: 400,
								lineHeight: 1,
								margin: 0,
							}}
						>
							Something went wrong
						</h1>
						<p style={{ color: "#cfc7bc", fontSize: 16, lineHeight: 1.6 }}>
							We captured the issue. Try again, and if it keeps happening,
							we will have the error details needed to fix it.
						</p>
						<button
							onClick={reset}
							style={{
								background: "#e85d26",
								border: 0,
								borderRadius: 10,
								color: "#fff",
								cursor: "pointer",
								font: "inherit",
								fontWeight: 700,
								minHeight: 44,
								padding: "0 18px",
							}}
							type="button"
						>
							Try again
						</button>
					</section>
				</main>
			</body>
		</html>
	);
}

type ResumeFileUrlResponse = {
	message?: unknown;
	signedUrl?: unknown;
};

export async function fetchResumeFileSignedUrl(
	resumeId: string,
	accessToken: string,
) {
	const response = await fetch(
		`/api/resumes/${encodeURIComponent(resumeId)}/file-url`,
		{
			cache: "no-store",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);
	let body: ResumeFileUrlResponse | null = null;

	try {
		body = (await response.json()) as ResumeFileUrlResponse;
	} catch {
		body = null;
	}

	if (!response.ok) {
		throw new Error(
			typeof body?.message === "string"
				? body.message
				: "We could not open this resume file.",
		);
	}

	if (typeof body?.signedUrl !== "string" || !body.signedUrl) {
		throw new Error("We could not open this resume file.");
	}

	return body.signedUrl;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRUST_APPLICATIONS_CLOSED_MESSAGE =
	"Self-serve trusted reviewer applications are closed. Linted now uses contribution history and admin-controlled trust labels.";

export async function POST() {
	return Response.json(
		{ message: TRUST_APPLICATIONS_CLOSED_MESSAGE },
		{ status: 410 },
	);
}

import { POST } from "@/app/api/reviewer-application/route";
import { describe, expect, it } from "vitest";

describe("reviewer application route", () => {
	it("keeps the legacy self-serve trust application endpoint closed", async () => {
		const response = await POST();

		expect(response.status).toBe(410);
		await expect(response.json()).resolves.toEqual({
			message:
				"Self-serve trusted reviewer applications are closed. Linted now uses contribution history and admin-controlled trust labels.",
		});
	});
});

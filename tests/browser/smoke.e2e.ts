import { expect, test } from "@playwright/test";
import {
	expectNoHorizontalOverflow,
	prepareAuthenticatedPage,
} from "./helpers/supabase";

test("public login renders without layout overflow", async ({ page }) => {
	await page.goto("/login");

	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("unauthenticated community home request redirects to login", async ({ page }) => {
	await page.goto("/community");

	await expect(page).toHaveURL(/\/login\?next=%2Fcommunity$/);
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("authenticated user can load the community home", async ({ page }) => {
	await prepareAuthenticatedPage(page);

	await page.goto("/community");

	await expect(page.getByRole("heading", { name: "Community" })).toHaveCount(1);
	await expect(
		page.getByRole("link", { exact: true, name: "ygjfjyfjhfgjhflkhjghmhn" }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("authenticated user can load the resume feed", async ({ page }) => {
	await prepareAuthenticatedPage(page);

	await page.goto("/feed");

	await expect(page.getByRole("heading", { name: "Resume Feed" })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Data Scientist or Analyst" }),
	).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Feed sort" })).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

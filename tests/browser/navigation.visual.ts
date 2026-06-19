import { expect, test, type Locator, type Page } from "@playwright/test";
import {
	expectNoHorizontalOverflow,
	prepareAuthenticatedPage,
} from "./helpers/supabase";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

async function expectMobileThreadTreeLayout(panel: Locator) {
	await expect(panel).toBeVisible();
	await expect(
		panel.locator('.thread-roast-node[data-thread-depth="3"]'),
	).toHaveCount(1);

	const mobileCommentTreeMetrics = await panel.evaluate((element) => {
		const list = element.querySelector(".roast-list");
		const rootNodes = list
			? Array.from(list.querySelectorAll(":scope > .thread-roast-node"))
			: [];
		const firstRoot = rootNodes[0];
		const secondRoot = rootNodes[1];
		const firstChildren = firstRoot?.querySelector(".thread-children");
		const deepNode = element.querySelector(
			'.thread-roast-node[data-thread-depth="3"]',
		);
		const deepBody = deepNode?.querySelector(".thread-roast-body");
		const actionNode = element.querySelector(
			'.thread-roast-node[data-thread-depth="2"]',
		);
		const actionFooter = actionNode?.querySelector(".thread-roast-body footer");
		const replyButton = actionFooter?.querySelector(
			'.comment-action-button[aria-label^="Reply"]',
		);
		const reactions = actionFooter?.querySelector(".comment-reactions");
		const curve = deepNode?.querySelector(".thread-branch-curve");
		const panelRect = element.getBoundingClientRect();
		const deepBodyRect = deepBody?.getBoundingClientRect();
		const firstChildrenStyle = firstChildren
			? window.getComputedStyle(firstChildren)
			: null;
		const firstRootAfter = firstRoot
			? window.getComputedStyle(firstRoot, "::after")
			: null;
		const secondRootStyle = secondRoot
			? window.getComputedStyle(secondRoot)
			: null;
		const replyButtonStyle = replyButton
			? window.getComputedStyle(replyButton)
			: null;
		const reactionsStyle = reactions ? window.getComputedStyle(reactions) : null;
		const curveStyle = curve ? window.getComputedStyle(curve) : null;

		return {
			childBorderLeftWidth: Number.parseFloat(
				firstChildrenStyle?.borderLeftWidth ?? "0",
			),
			deepBodyLeft: deepBodyRect ? deepBodyRect.left - panelRect.left : 0,
			deepBodyWidth: deepBodyRect?.width ?? 0,
			oldCurveDisplay: curveStyle?.display ?? "",
			oldPseudoRailDisplay: firstRootAfter?.display ?? "",
			reactionsOrder: reactionsStyle?.order ?? "",
			replyOrder: replyButtonStyle?.order ?? "",
			secondRootBorderTopWidth: Number.parseFloat(
				secondRootStyle?.borderTopWidth ?? "0",
			),
			topSectionCount: rootNodes.length,
		};
	});

	expect(mobileCommentTreeMetrics.topSectionCount).toBeGreaterThanOrEqual(2);
	expect(
		mobileCommentTreeMetrics.secondRootBorderTopWidth,
	).toBeGreaterThanOrEqual(8);
	expect(mobileCommentTreeMetrics.childBorderLeftWidth).toBe(1);
	expect(mobileCommentTreeMetrics.deepBodyLeft).toBeLessThan(100);
	expect(mobileCommentTreeMetrics.deepBodyWidth).toBeGreaterThan(220);
	expect(mobileCommentTreeMetrics.oldCurveDisplay).toBe("none");
	expect(mobileCommentTreeMetrics.oldPseudoRailDisplay).toBe("none");
	expect(mobileCommentTreeMetrics.replyOrder).toBe("3");
	expect(mobileCommentTreeMetrics.reactionsOrder).toBe("5");
}

async function expectResumeDetailPostSurface(page: Page) {
	await expect(page.locator(".resume-preview-pane")).toBeVisible();
	await expect(page.locator(".resume-preview-pane .post-author-avatar")).toBeVisible();
	await expect(page.locator(".resume-preview-pane .secure-resume-preview")).toBeVisible();

	const surfaceMetrics = await page.locator(".resume-preview-pane").evaluate(
		(element) => {
			const style = window.getComputedStyle(element);
			const title = element.querySelector(".resume-detail-title");
			const titleStyle = title ? window.getComputedStyle(title) : null;
			const preview = element.querySelector(".secure-resume-preview");
			const previewStyle = preview ? window.getComputedStyle(preview) : null;

			return {
				background: style.backgroundColor,
				borderTopWidth: Number.parseFloat(style.borderTopWidth),
				boxShadow: style.boxShadow,
				previewBorderTopWidth: Number.parseFloat(
					previewStyle?.borderTopWidth ?? "0",
				),
				titleFontFamily: titleStyle?.fontFamily ?? "",
				titleFontWeight: Number.parseFloat(titleStyle?.fontWeight ?? "0"),
			};
		},
	);

	expect(surfaceMetrics.background).toBe("rgba(0, 0, 0, 0)");
	expect(surfaceMetrics.borderTopWidth).toBe(0);
	expect(surfaceMetrics.boxShadow).toBe("none");
	expect(surfaceMetrics.previewBorderTopWidth).toBeGreaterThanOrEqual(1);
	expect(surfaceMetrics.titleFontFamily).toContain("Reddit Sans");
	expect(surfaceMetrics.titleFontWeight).toBeLessThanOrEqual(500);
}

async function expectCommentComposerMentionAutocomplete({
	composer,
	expectedMention,
	query,
}: {
	composer: Locator;
	expectedMention: string;
	query: string;
}) {
	const input = composer.locator(".comment-composer-input");
	await input.fill(query);

	const listbox = composer.getByRole("listbox", { name: "Mention people" });
	await expect(listbox).toBeVisible();
	await expect(
		listbox.locator(".mention-suggestion-button").first(),
	).toContainText(expectedMention.trim());

	await input.press("Enter");
	await expect(input).toHaveValue(expectedMention);
	await expect(composer.getByRole("listbox", { name: "Mention people" })).toHaveCount(
		0,
	);
}

async function expectResumeCommentComposerPill(page: Page) {
	const joinPill = page.locator(".resume-comment-join-pill");
	await expect(joinPill).toBeVisible();
	await expect(joinPill).toContainText("Join the conversation");
	await joinPill.click();

	const composer = page.locator(".resume-root-comment-composer");
	await expect(composer).toBeVisible();
	await expect(composer.locator(".comment-composer-input")).toHaveAttribute(
		"placeholder",
		"Join the conversation",
	);

	const composerMetrics = await composer.evaluate((element) => {
		const style = window.getComputedStyle(element);
		const footer = element.querySelector(".comment-composer-footer");
		const footerStyle = footer ? window.getComputedStyle(footer) : null;
		const rect = element.getBoundingClientRect();

		return {
			borderTopWidth: Number.parseFloat(style.borderTopWidth),
			footerDisplay: footerStyle?.display ?? "",
			height: rect.height,
		};
	});

	expect(composerMetrics.borderTopWidth).toBeGreaterThanOrEqual(1);
	expect(composerMetrics.footerDisplay).toBe("flex");
	expect(composerMetrics.height).toBeLessThanOrEqual(130);
	await expectCommentComposerMentionAutocomplete({
		composer,
		expectedMention: "@neatcoach ",
		query: "@ne",
	});
}

test("community loading states use branded feed surfaces", async ({
	page,
}) => {
	await prepareAuthenticatedPage(page, { delayCommunityPostsMs: 900 });
	await page.goto("/community", { waitUntil: "domcontentloaded" });

	const skeletonRows = page.locator(".community-feed-loading .skeleton-card");
	await expect(skeletonRows.first()).toBeVisible();
	const skeletonMetrics = await skeletonRows.first().evaluate((element) => {
		const style = window.getComputedStyle(element);
		const separatorStyle = window.getComputedStyle(element, "::after");
		const preview = element.querySelector(".skeleton-line.preview");
		const previewRect = preview?.getBoundingClientRect();

		return {
			actionCount: element.querySelectorAll(".skeleton-line.actions").length,
			background: style.backgroundColor,
			borderTopWidth: Number.parseFloat(style.borderTopWidth),
			lineCount: element.querySelectorAll(".skeleton-line").length,
			previewHeight: previewRect?.height ?? 0,
			separatorHeight: Number.parseFloat(separatorStyle.height),
		};
	});

	expect(skeletonMetrics.background).toBe("rgba(0, 0, 0, 0)");
	expect(skeletonMetrics.borderTopWidth).toBe(0);
	expect(skeletonMetrics.lineCount).toBe(6);
	expect(skeletonMetrics.actionCount).toBe(1);
	expect(skeletonMetrics.previewHeight).toBeGreaterThan(180);
	expect(skeletonMetrics.separatorHeight).toBe(1);
	await expect(page.locator(".community-feed-skeleton-row")).toHaveCount(0);

	await page.goto("/community/99999999-9999-4999-8999-000000000001", {
		waitUntil: "domcontentloaded",
	});
	await expect(
		page.locator(".community-post-detail.is-loading .loading-screen"),
	).toBeVisible();
	await expect(page.getByText("Loading post")).toHaveCount(0);
});

test("primary navigation exposes app sections without account utilities", async ({
	page,
}, testInfo) => {
	await prepareAuthenticatedPage(page);
	await page.goto("/feed", { waitUntil: "domcontentloaded" });
	await expectNoHorizontalOverflow(page);

	if (testInfo.project.name === "visual-mobile") {
		const mobileNav = page.getByRole("navigation", {
			name: "Mobile navigation",
		});

		await expect(mobileNav).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Community" }),
		).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Resume Feed" }),
		).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Post resume" }),
		).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Write post" }),
		).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Leaderboard" }),
		).toBeVisible();
		await expect(
			mobileNav.getByRole("link", { name: "Saved" }),
		).toHaveCount(0);
		await expect(
			mobileNav.getByRole("link", { name: "Profile" }),
		).toHaveCount(0);

		// On mobile the app-header (logo+auth chrome) is always visible;
		// the feed-route-header is hidden by feed.css at max-width:760px.
		await expect(page.locator(".app-header")).toBeVisible();
		await expect(page.locator(".feed-route-header")).toBeHidden();

		// Scrolling past the threshold hides both the app-header and the mobile nav.
		await page.evaluate(() => window.scrollTo(0, 520));
		await expect(page.locator(".app-header")).toHaveClass(/is-mobile-hidden/);
		await expect(mobileNav).toHaveClass(/is-mobile-hidden/);

		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(page.locator(".app-header")).not.toHaveClass(/is-mobile-hidden/);
		await expect(mobileNav).not.toHaveClass(/is-mobile-hidden/);

		await page.goto("/community", { waitUntil: "domcontentloaded" });
		const communityNav = page.getByRole("navigation", {
			name: "Mobile navigation",
		});
		await expect(
			communityNav.getByRole("link", { name: "Community" }),
		).toHaveAttribute("aria-current", "page");
		await expect(page.locator(".app-header")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Community" }),
		).toHaveCount(1);
		const mobileCommunityIntroMetrics = await page
			.locator(".community-feed-intro")
			.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);

				return {
					height: rect.height,
					position: style.position,
					width: rect.width,
				};
			});

		expect(mobileCommunityIntroMetrics.position).toBe("absolute");
		expect(mobileCommunityIntroMetrics.height).toBeLessThanOrEqual(1);
		expect(mobileCommunityIntroMetrics.width).toBeLessThanOrEqual(1);
		await expect(page.locator(".feed-route-header")).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Create community post" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: /save post/i }),
		).toHaveCount(0);

		const feedListMetrics = await page.locator(".community-feed-list").evaluate(
			(element) => {
				const feedListStyle = window.getComputedStyle(element);

				return {
					feedListBorderTopWidth: Number.parseFloat(
						feedListStyle.borderTopWidth,
					),
				};
			},
		);

		expect(feedListMetrics.feedListBorderTopWidth).toBe(0);
		await expect(page.locator(".community-feed-toolbar")).toBeVisible();
		await expect(page.locator(".community-feed-sort-indicator")).toContainText(
			"Best",
		);
		await page
			.getByRole("button", { name: "Sort community posts by Best" })
			.click();
		await page.getByRole("menuitem", { name: "New" }).click();
		await expect(
			page.getByRole("button", { name: "Sort community posts by New" }),
		).toBeVisible();
		await expect(page.locator(".community-feed-loading")).toHaveCount(0);
		await expect(
			page.locator(".community-media-gallery-feed figcaption"),
		).toHaveCount(0);
		const feedPreviewMetrics = await page
			.locator(".community-feed-list")
			.evaluate((element) => {
				const rows = Array.from(
					element.querySelectorAll(".community-feed-row"),
				);
				const imageRow = rows.find((row) =>
					row.querySelector(".community-media-gallery-feed"),
				);
				const textOnlyRow = rows.find(
					(row) =>
						!row.querySelector(".community-media-gallery-feed") &&
						row.querySelector(".community-feed-excerpt"),
				);
				const excerpt = textOnlyRow?.querySelector(".community-feed-excerpt");
				const excerptStyle = excerpt ? window.getComputedStyle(excerpt) : null;

				return {
					imageRowExcerptCount:
						imageRow?.querySelectorAll(".community-feed-excerpt").length ?? -1,
					textOnlyExcerptClamp: excerptStyle?.webkitLineClamp ?? "",
					textOnlyExcerptText: excerpt?.textContent?.trim() ?? "",
				};
			});

		expect(feedPreviewMetrics.imageRowExcerptCount).toBe(0);
		expect(feedPreviewMetrics.textOnlyExcerptText).toContain(
			"A focused community post body",
		);
		expect(feedPreviewMetrics.textOnlyExcerptClamp).toBe("2");
		const ownFeedRow = page.locator(
			`.community-feed-row[data-author-id="${TEST_USER_ID}"]`,
		);
		await expect(ownFeedRow).toBeVisible();
		await expect(ownFeedRow.locator(".community-reactions")).toHaveCount(0);
		await ownFeedRow.getByRole("button", { name: /More actions/i }).click();
		const mobileOwnerEditAction = page.getByRole("menuitem", { name: "Edit" });
		await expect(mobileOwnerEditAction).toBeVisible();
		await expect(mobileOwnerEditAction).toHaveAttribute("href", /edit=1/);
		await expect(
			page.getByRole("menuitem", { name: "Delete" }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitem", { name: /hide/i }),
		).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(page.locator(".community-media-gallery-count")).toHaveCount(0);
		await expect(page.locator(".community-media-gallery-dots")).toBeVisible();
		await expect(page.locator(".community-media-gallery-dot")).toHaveCount(3);
		await page.locator(".community-media-gallery-arrow.is-next").first().click();
		await expect(
			page.locator('.community-media-gallery-dot[aria-current="true"]'),
		).toHaveCount(1);
		await page.waitForTimeout(220);

		const titleMetrics = await page
			.locator(".community-feed-title")
			.first()
			.evaluate((element) => {
				const style = window.getComputedStyle(element);

				return {
					fontFamily: style.fontFamily,
					fontSize: Number.parseFloat(style.fontSize),
					fontWeight: style.fontWeight,
				};
			});

		expect(titleMetrics.fontFamily).toContain("Reddit Sans");
		expect(titleMetrics.fontSize).toBeLessThanOrEqual(19);
		expect(Number(titleMetrics.fontWeight)).toBeLessThanOrEqual(500);

		const mobileCarouselMetrics = await page
			.locator(".community-media-gallery-feed")
			.evaluate((element) => {
				const arrow = element.querySelector(".community-media-gallery-arrow");
				const dots = Array.from(
					element.querySelectorAll(".community-media-gallery-dot"),
				);
				const activeDot = element.querySelector(
					".community-media-gallery-dot.is-active",
				);
				const inactiveDot = element.querySelector(
					".community-media-gallery-dot:not(.is-active)",
				);
				const arrowStyle = arrow ? window.getComputedStyle(arrow) : null;
				const arrowRect = arrow?.getBoundingClientRect();
				const activeDotRect = activeDot?.getBoundingClientRect();
				const inactiveDotRect = inactiveDot?.getBoundingClientRect();
				const dotRects = dots.map((dot) => dot.getBoundingClientRect());
				const row = element.closest(".community-feed-row");
				const rowStyle = row ? window.getComputedStyle(row) : null;
				const rowSeparatorStyle = row
					? window.getComputedStyle(row, "::after")
					: null;

				return {
					activeDotWidth: activeDotRect?.width ?? 0,
					arrowBorderRadius: arrowStyle?.borderRadius ?? "",
					arrowOutlineStyle: arrowStyle?.outlineStyle ?? "",
					arrowWidth: arrowRect?.width ?? 0,
					dotCount: dotRects.length,
					restDotWidth: inactiveDotRect?.width ?? 0,
					rowBackground: rowStyle?.backgroundColor ?? "",
					rowBorderBottomWidth: Number.parseFloat(
						rowStyle?.borderBottomWidth ?? "0",
					),
					rowBorderLeftWidth: Number.parseFloat(
						rowStyle?.borderLeftWidth ?? "0",
					),
					rowBorderTopWidth: Number.parseFloat(
						rowStyle?.borderTopWidth ?? "0",
					),
					rowBoxShadow: rowStyle?.boxShadow ?? "",
					rowSeparatorBackground:
						rowSeparatorStyle?.backgroundColor ?? "",
					rowSeparatorHeight: Number.parseFloat(
						rowSeparatorStyle?.height ?? "0",
					),
				};
			});

		expect(mobileCarouselMetrics.arrowWidth).toBeLessThanOrEqual(36);
		expect(mobileCarouselMetrics.arrowBorderRadius).not.toBe("0px");
		expect(mobileCarouselMetrics.arrowOutlineStyle).toBe("none");
		expect(mobileCarouselMetrics.dotCount).toBe(3);
		expect(mobileCarouselMetrics.activeDotWidth).toBeGreaterThan(
			mobileCarouselMetrics.restDotWidth,
		);
		expect(mobileCarouselMetrics.rowBorderBottomWidth).toBe(0);
		expect(mobileCarouselMetrics.rowBorderLeftWidth).toBe(0);
		expect(mobileCarouselMetrics.rowBorderTopWidth).toBe(0);
		expect(mobileCarouselMetrics.rowBackground).toBe("rgba(0, 0, 0, 0)");
		expect(mobileCarouselMetrics.rowBoxShadow).toBe("none");
		expect(mobileCarouselMetrics.rowSeparatorHeight).toBe(1);
		expect(mobileCarouselMetrics.rowSeparatorBackground).not.toBe(
			"rgba(0, 0, 0, 0)",
		);

		const actionMetrics = await page
			.locator(".community-feed-row-footer.post-actions")
			.first()
			.evaluate((element) => {
				const votePill = element.querySelector(".community-reactions");
				const commentButton = element.querySelector(
					".post-action-button:not(.community-share-action)",
				);
				const voteIcon = element.querySelector(".reaction-icon");
				const shareButton = element.querySelector(".community-share-action");
				const shareLabel = element.querySelector(".community-share-label");
				const shareLabelStyle = shareLabel
					? window.getComputedStyle(shareLabel)
					: null;
				const commentButtonRect = commentButton?.getBoundingClientRect();
				const shareButtonRect = shareButton?.getBoundingClientRect();
				const votePillRect = votePill?.getBoundingClientRect();
				const voteIconRect = voteIcon?.getBoundingClientRect();

				return {
					commentButtonHeight: commentButtonRect?.height ?? 0,
					shareButtonHeight: shareButtonRect?.height ?? 0,
					shareButtonWidth: shareButtonRect?.width ?? 0,
					shareLabelDisplay: shareLabelStyle?.display ?? "",
					voteIconHeight: voteIconRect?.height ?? 0,
					votePillHeight: votePillRect?.height ?? 0,
				};
			});

		expect(actionMetrics.votePillHeight).toBeGreaterThanOrEqual(30);
		expect(actionMetrics.votePillHeight).toBeLessThanOrEqual(34);
		expect(actionMetrics.commentButtonHeight).toBeGreaterThanOrEqual(30);
		expect(actionMetrics.commentButtonHeight).toBeLessThanOrEqual(34);
		expect(actionMetrics.shareButtonHeight).toBeGreaterThanOrEqual(30);
		expect(actionMetrics.shareButtonHeight).toBeLessThanOrEqual(34);
		expect(actionMetrics.shareButtonWidth).toBeGreaterThanOrEqual(64);
		expect(actionMetrics.voteIconHeight).toBeGreaterThanOrEqual(18);
		expect(actionMetrics.shareLabelDisplay).not.toBe("none");

		await page.evaluate(() => {
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
			window.scrollTo(0, 0);
		});
		await expect(communityNav).not.toHaveClass(/is-mobile-scrolled/);
		await expect(communityNav).not.toHaveClass(/is-mobile-hidden/);

		await page.evaluate(() => window.scrollTo(0, 520));
		await expect(communityNav).toHaveClass(/is-mobile-hidden/);
		await expect(page.locator(".app-header")).toHaveClass(/is-mobile-hidden/);

		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(communityNav).not.toHaveClass(/is-mobile-hidden/);
		await expect(page.locator(".app-header")).not.toHaveClass(
			/is-mobile-hidden/,
		);

		await page.goto(
			"/community/99999999-9999-4999-8999-000000000001#comments",
			{ waitUntil: "domcontentloaded" },
		);
		const mobileCommentsPanel = page.locator(".community-comments-panel");
		await expectMobileThreadTreeLayout(mobileCommentsPanel);
		const mobileOwnComment = mobileCommentsPanel.locator(
			`.thread-roast-node[data-author-id="${TEST_USER_ID}"]`,
		);
		await expect(mobileOwnComment).toHaveCount(1);
		await expect(
			mobileOwnComment.getByRole("button", { name: "Upvote comment" }),
		).toHaveCount(0);
		await expect(
			mobileOwnComment.getByRole("button", { name: /Reply to/i }),
		).toHaveCount(0);
		await expect(
			mobileOwnComment.getByRole("button", { name: "Edit" }),
		).toHaveCount(1);
		// The mobile community comment flow replaced the embedded form with a
		// portaled full-screen overlay. Tap the join pill (fixed to the viewport,
		// outside the comments panel) to open the overlay, exercise the mention
		// autocomplete there, then dismiss.
		const mobileCommunityJoinPill = page.locator(".community-mobile-join-pill");
		await expect(mobileCommunityJoinPill).toBeVisible();
		await mobileCommunityJoinPill.click();
		const mobileComposerOverlay = page.locator(".community-mobile-composer-overlay");
		await expect(mobileComposerOverlay).toBeVisible();
		await expectCommentComposerMentionAutocomplete({
			composer: mobileComposerOverlay.locator(
				".community-mobile-composer-input-area",
			),
			expectedMention: "@community_member ",
			query: "@comm",
		});
		await mobileComposerOverlay.getByRole("button", { name: "Cancel" }).click();
		await expect(mobileComposerOverlay).toHaveCount(0);
		const communityThreadScrollMetrics = await mobileCommentsPanel
			.locator(".roast-list")
			.evaluate((element) => {
				const style = window.getComputedStyle(element);

				return {
					overflowY: style.overflowY,
					overscrollBehaviorY: style.overscrollBehaviorY,
				};
			});

		// The new mobile page-scroll layout puts the comment list in normal
		// document flow rather than a fixed-height scroll container.
		// CSS: .community-thread-body > .community-comments-panel .roast-list
		// explicitly sets overflow:visible / overscroll-behavior:auto (feed.css).
		expect(communityThreadScrollMetrics.overflowY).toBe("visible");
		expect(communityThreadScrollMetrics.overscrollBehaviorY).toBe("auto");

		await page.goto(
			"/resume/22222222-2222-4222-8222-222222222222#comments",
			{ waitUntil: "domcontentloaded" },
		);
		await expectResumeDetailPostSurface(page);
		await expectResumeCommentComposerPill(page);
		const mobileResumeCommentsPanel = page.locator(".resume-comments-panel");
		await expectMobileThreadTreeLayout(mobileResumeCommentsPanel);
		const resumeThreadScrollMetrics = await mobileResumeCommentsPanel
			.locator(".roast-list")
			.evaluate((element) => {
				const style = window.getComputedStyle(element);

				return {
					overflowY: style.overflowY,
					overscrollBehaviorY: style.overscrollBehaviorY,
				};
			});

		expect(resumeThreadScrollMetrics.overflowY).toBe("visible");
		expect(resumeThreadScrollMetrics.overscrollBehaviorY).toBe("auto");
		return;
	}

	await expect(page.locator(".bottom-nav")).toBeHidden();
	const sidebar = page.getByRole("navigation", { name: "Primary navigation" });
	await expect(sidebar).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Community" })).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Resume Feed" })).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Write post" })).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Resume Feed" })).toHaveClass(
		/is-active/,
	);
	const activeSidebarMetrics = await sidebar
		.getByRole("link", { name: "Resume Feed" })
		.evaluate((element) => {
			const iconSlot = element.querySelector(".session-sidebar-icon-slot");
			const iconSlotStyle = iconSlot ? window.getComputedStyle(iconSlot) : null;
			const indicatorStyle = iconSlot
				? window.getComputedStyle(iconSlot, "::after")
				: null;

			return {
				indicatorBackground: indicatorStyle?.backgroundColor ?? "",
				iconSlotBackground: iconSlotStyle?.backgroundColor ?? "",
			};
		});

	expect(activeSidebarMetrics.iconSlotBackground).toBe("rgba(0, 0, 0, 0)");
	expect(activeSidebarMetrics.indicatorBackground).not.toBe(
		"rgba(0, 0, 0, 0)",
	);
	expect(activeSidebarMetrics.indicatorBackground).not.toBe(
		"rgb(255, 255, 255)",
	);

	await page.goto("/resume/22222222-2222-4222-8222-222222222222#comments", {
		waitUntil: "domcontentloaded",
	});
	await expectResumeDetailPostSurface(page);
	await expectResumeCommentComposerPill(page);

	// Collapse the sidebar before the community layout checks so
	// .community-feed-center starts near the left edge (< 220px).
	// The nav link assertions above run with the sidebar expanded, so
	// the links are visible; this localStorage write only takes effect
	// on the next page navigation.
	await page.evaluate(() =>
		window.localStorage.setItem("linted.session-sidebar.collapsed", "1"),
	);
	await page.goto("/community", { waitUntil: "domcontentloaded" });
	await expect(page.locator(".community-feed-intro")).toBeVisible();
	await expect(
		page.locator(".community-feed-intro h1"),
	).toHaveText("Community");
	await expect(page.locator(".community-feed-intro p")).toContainText(
		"career",
	);
	await expect(page.locator(".community-feed-toolbar")).toBeVisible();
	await expect(page.locator(".community-feed-sort-indicator")).toContainText(
		"Best",
	);
	await page
		.getByRole("button", { name: "Sort community posts by Best" })
		.click();
	await page.getByRole("menuitem", { name: "New" }).click();
	await expect(
		page.getByRole("button", { name: "Sort community posts by New" }),
	).toBeVisible();
	await expect(page.locator(".community-feed-loading")).toHaveCount(0);
	await expect(
		page.locator(".community-media-gallery-feed figcaption"),
	).toHaveCount(0);
	const desktopFeedPreviewMetrics = await page
		.locator(".community-feed-list")
		.evaluate((element) => {
			const rows = Array.from(element.querySelectorAll(".community-feed-row"));
			const imageRow = rows.find((row) =>
				row.querySelector(".community-media-gallery-feed"),
			);
			const textOnlyRow = rows.find(
				(row) =>
					!row.querySelector(".community-media-gallery-feed") &&
					row.querySelector(".community-feed-excerpt"),
			);
			const excerpt = textOnlyRow?.querySelector(".community-feed-excerpt");
			const excerptStyle = excerpt ? window.getComputedStyle(excerpt) : null;

			return {
				imageRowExcerptCount:
					imageRow?.querySelectorAll(".community-feed-excerpt").length ?? -1,
				textOnlyExcerptClamp: excerptStyle?.webkitLineClamp ?? "",
				textOnlyExcerptText: excerpt?.textContent?.trim() ?? "",
			};
		});

	expect(desktopFeedPreviewMetrics.imageRowExcerptCount).toBe(0);
	expect(desktopFeedPreviewMetrics.textOnlyExcerptText).toContain(
		"A focused community post body",
	);
	expect(desktopFeedPreviewMetrics.textOnlyExcerptClamp).toBe("2");
	const desktopOwnFeedRow = page.locator(
		`.community-feed-row[data-author-id="${TEST_USER_ID}"]`,
	);
	await expect(desktopOwnFeedRow).toBeVisible();
	await expect(desktopOwnFeedRow.locator(".community-reactions")).toHaveCount(0);
	await desktopOwnFeedRow.getByRole("button", { name: /More actions/i }).click();
	const desktopOwnerEditAction = page.getByRole("menuitem", { name: "Edit" });
	await expect(desktopOwnerEditAction).toBeVisible();
	await expect(desktopOwnerEditAction).toHaveAttribute("href", /edit=1/);
	await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: /hide/i })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.mouse.move(8, 8);
	await page.evaluate(() => {
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement) activeElement.blur();
	});
	await page.waitForTimeout(220);
	const desktopRowDividerMetrics = await page
		.locator(".community-feed-row")
		.first()
		.evaluate((element) => {
			const rowStyle = window.getComputedStyle(element);
			const separatorStyle = window.getComputedStyle(element, "::after");

			return {
				background: rowStyle.backgroundColor,
				borderBottomWidth: Number.parseFloat(rowStyle.borderBottomWidth),
				borderLeftWidth: Number.parseFloat(rowStyle.borderLeftWidth),
				borderRadius: rowStyle.borderRadius,
				borderTopWidth: Number.parseFloat(rowStyle.borderTopWidth),
				separatorBackground: separatorStyle.backgroundColor,
				separatorHeight: Number.parseFloat(separatorStyle.height),
			};
		});

	expect(desktopRowDividerMetrics.background).toBe("rgba(0, 0, 0, 0)");
	expect(desktopRowDividerMetrics.borderBottomWidth).toBe(0);
	expect(desktopRowDividerMetrics.borderLeftWidth).toBe(0);
	expect(desktopRowDividerMetrics.borderTopWidth).toBe(0);
	expect(desktopRowDividerMetrics.borderRadius).toBe("0px");
	expect(desktopRowDividerMetrics.separatorHeight).toBe(1);
	expect(desktopRowDividerMetrics.separatorBackground).not.toBe(
		"rgba(0, 0, 0, 0)",
	);
	const desktopPollRow = page
		.locator('.community-feed-row[data-post-kind="poll"]')
		.first();
	await expect(desktopPollRow).toBeVisible();
	await desktopPollRow.hover();
	const desktopPollRowHoverMetrics = await desktopPollRow.evaluate((element) => {
		const style = window.getComputedStyle(element);

		return {
			background: style.backgroundColor,
			borderRadius: style.borderRadius,
		};
	});

	expect(desktopPollRowHoverMetrics.background).toBe("rgba(0, 0, 0, 0)");
	expect(desktopPollRowHoverMetrics.borderRadius).toBe("0px");
	const desktopPollOption = desktopPollRow
		.locator(".community-poll-options button")
		.last();
	await expect(desktopPollOption).not.toBeDisabled();
	const desktopPollOptionBackgroundBefore = await desktopPollOption.evaluate(
		(element) => window.getComputedStyle(element).backgroundColor,
	);
	await desktopPollOption.hover();
	const desktopPollOptionBackgroundAfter = await desktopPollOption.evaluate(
		(element) => window.getComputedStyle(element).backgroundColor,
	);
	expect(desktopPollOptionBackgroundAfter).not.toBe(
		desktopPollOptionBackgroundBefore,
	);
	if ((await desktopPollOption.getAttribute("aria-disabled")) === "true") {
		await desktopPollOption.click();
		await expect(page.getByText("This poll is closed.")).toBeVisible();
	}
	await expect(page.locator(".community-media-gallery-count")).toHaveCount(0);
	await expect(page.locator(".community-media-gallery-dots")).toBeVisible();
	await expect(page.locator(".community-media-gallery-dot")).toHaveCount(3);
	await page.locator(".community-media-gallery-arrow.is-next").first().click();
	await expect(
		page.locator('.community-media-gallery-dot[aria-current="true"]'),
	).toHaveCount(1);
	await page.waitForTimeout(220);
	const desktopCommunityLayoutMetrics = await page
		.locator(".community-feed-center")
		.evaluate((element) => {
			const rect = element.getBoundingClientRect();

			return {
				left: rect.left,
				width: rect.width,
			};
		});

	expect(desktopCommunityLayoutMetrics.left).toBeLessThan(220);
	expect(desktopCommunityLayoutMetrics.width).toBeGreaterThanOrEqual(740);
	const desktopCarouselMetrics = await page
		.locator(".community-media-gallery-feed")
		.evaluate((element) => {
			const arrow = element.querySelector(".community-media-gallery-arrow");
			const dots = Array.from(
				element.querySelectorAll(".community-media-gallery-dot"),
			);
			const activeDot = element.querySelector(
				".community-media-gallery-dot.is-active",
			);
			const inactiveDot = element.querySelector(
				".community-media-gallery-dot:not(.is-active)",
			);
			const arrowStyle = arrow ? window.getComputedStyle(arrow) : null;
			const arrowRect = arrow?.getBoundingClientRect();
			const activeDotRect = activeDot?.getBoundingClientRect();
			const inactiveDotRect = inactiveDot?.getBoundingClientRect();
			const dotRects = dots.map((dot) => dot.getBoundingClientRect());

			return {
				activeDotWidth: activeDotRect?.width ?? 0,
				arrowBorderRadius: arrowStyle?.borderRadius ?? "",
				arrowOutlineStyle: arrowStyle?.outlineStyle ?? "",
				arrowWidth: arrowRect?.width ?? 0,
				dotCount: dotRects.length,
				restDotWidth: inactiveDotRect?.width ?? 0,
			};
		});

	expect(desktopCarouselMetrics.arrowWidth).toBeLessThanOrEqual(34);
	expect(desktopCarouselMetrics.arrowBorderRadius).not.toBe("0px");
	expect(desktopCarouselMetrics.arrowOutlineStyle).toBe("none");
	expect(desktopCarouselMetrics.dotCount).toBe(3);
	expect(desktopCarouselMetrics.activeDotWidth).toBeGreaterThan(
		desktopCarouselMetrics.restDotWidth,
	);
	const desktopActionMetrics = await page
		.locator(".community-feed-row-footer.post-actions")
		.first()
		.evaluate((element) => {
			const votePill = element.querySelector(".community-reactions");
			const commentButton = element.querySelector(
				".post-action-button:not(.community-share-action)",
			);
			const voteIcon = element.querySelector(".reaction-icon");
			const shareButton = element.querySelector(".community-share-action");
			const shareLabel = element.querySelector(".community-share-label");
			const shareLabelStyle = shareLabel
				? window.getComputedStyle(shareLabel)
				: null;
			const commentButtonRect = commentButton?.getBoundingClientRect();
			const shareButtonRect = shareButton?.getBoundingClientRect();
			const votePillRect = votePill?.getBoundingClientRect();
			const voteIconRect = voteIcon?.getBoundingClientRect();

			return {
				commentButtonHeight: commentButtonRect?.height ?? 0,
				shareButtonHeight: shareButtonRect?.height ?? 0,
				shareButtonWidth: shareButtonRect?.width ?? 0,
				shareLabelDisplay: shareLabelStyle?.display ?? "",
				voteIconHeight: voteIconRect?.height ?? 0,
				votePillHeight: votePillRect?.height ?? 0,
			};
		});

	expect(desktopActionMetrics.votePillHeight).toBeGreaterThanOrEqual(30);
	expect(desktopActionMetrics.votePillHeight).toBeLessThanOrEqual(36);
	expect(desktopActionMetrics.commentButtonHeight).toBeGreaterThanOrEqual(30);
	expect(desktopActionMetrics.commentButtonHeight).toBeLessThanOrEqual(36);
	expect(desktopActionMetrics.shareButtonHeight).toBeGreaterThanOrEqual(30);
	expect(desktopActionMetrics.shareButtonHeight).toBeLessThanOrEqual(36);
	expect(desktopActionMetrics.shareButtonWidth).toBeGreaterThanOrEqual(68);
	expect(desktopActionMetrics.voteIconHeight).toBeGreaterThanOrEqual(18);
	expect(desktopActionMetrics.shareLabelDisplay).not.toBe("none");

	await page.goto("/community/99999999-9999-4999-8999-000000000001", {
		waitUntil: "domcontentloaded",
	});
	await expect(page.locator(".community-post-detail h1")).toHaveText(
		"ygjfjyfjhfgjhflkhjghmhn",
	);
	const detailHeaderMetrics = await page.locator(".app-header").evaluate(
		(element) => {
			const headerRect = element.getBoundingClientRect();
			const logoRect = element
				.querySelector(".app-logo")
				?.getBoundingClientRect();

			return {
				headerLeft: headerRect.left,
				headerRight: headerRect.right,
				logoLeft: logoRect?.left ?? 0,
				viewportWidth: window.innerWidth,
			};
		},
	);

	expect(detailHeaderMetrics.headerLeft).toBeLessThanOrEqual(1);
	expect(detailHeaderMetrics.headerRight).toBeGreaterThanOrEqual(
		detailHeaderMetrics.viewportWidth - 1,
	);
	expect(detailHeaderMetrics.logoLeft).toBeGreaterThanOrEqual(16);
	expect(detailHeaderMetrics.logoLeft).toBeLessThanOrEqual(40);
	await expect(page.locator(".community-post-actions.post-actions")).toBeVisible();

	const detailActionMetrics = await page
		.locator(".community-post-actions.post-actions")
		.evaluate((element) => {
			const votePill = element.querySelector(".community-reactions");
			const voteScore = element.querySelector(".community-vote-score");
			const reactionCounts = element.querySelectorAll(".reaction-count");
			const commentButton = element.querySelector(".post-comments-link");
			const shareButton = element.querySelector(".community-share-action");
			const reportButton = element.querySelector(
				".post-action-button:not(.post-comments-link):not(.community-share-action):not(.community-static-action)",
			);
			const votePillStyle = votePill ? window.getComputedStyle(votePill) : null;
			const commentButtonStyle = commentButton
				? window.getComputedStyle(commentButton)
				: null;
			const votePillRect = votePill?.getBoundingClientRect();
			const commentButtonRect = commentButton?.getBoundingClientRect();
			const shareButtonRect = shareButton?.getBoundingClientRect();
			const reportButtonRect = reportButton?.getBoundingClientRect();

			return {
				commentButtonBackground: commentButtonStyle?.backgroundColor ?? "",
				commentButtonHeight: commentButtonRect?.height ?? 0,
				reactionCountCount: reactionCounts.length,
				reportButtonHeight: reportButtonRect?.height ?? 0,
				shareButtonHeight: shareButtonRect?.height ?? 0,
				votePillBackground: votePillStyle?.backgroundColor ?? "",
				votePillHeight: votePillRect?.height ?? 0,
				voteScoreText: voteScore?.textContent?.trim() ?? "",
			};
		});

	expect(detailActionMetrics.votePillHeight).toBeGreaterThanOrEqual(30);
	expect(detailActionMetrics.votePillHeight).toBeLessThanOrEqual(36);
	expect(detailActionMetrics.commentButtonHeight).toBeGreaterThanOrEqual(30);
	expect(detailActionMetrics.commentButtonHeight).toBeLessThanOrEqual(36);
	expect(detailActionMetrics.shareButtonHeight).toBeGreaterThanOrEqual(30);
	expect(detailActionMetrics.shareButtonHeight).toBeLessThanOrEqual(36);
	expect(detailActionMetrics.reportButtonHeight).toBeGreaterThanOrEqual(30);
	expect(detailActionMetrics.reportButtonHeight).toBeLessThanOrEqual(36);
	expect(detailActionMetrics.reactionCountCount).toBe(0);
	expect(detailActionMetrics.voteScoreText).toBe("2");
	expect(detailActionMetrics.votePillBackground).not.toBe("rgba(0, 0, 0, 0)");
	expect(detailActionMetrics.commentButtonBackground).not.toBe(
		"rgba(0, 0, 0, 0)",
	);

	const commentsPanel = page.locator(".community-comments-panel");
	await expect(commentsPanel).toBeVisible();
	const desktopOwnComment = commentsPanel.locator(
		`.thread-roast-node[data-author-id="${TEST_USER_ID}"]`,
	);
	await expect(desktopOwnComment).toHaveCount(1);
	await expect(
		desktopOwnComment.getByRole("button", { name: "Upvote comment" }),
	).toHaveCount(0);
	await expect(
		desktopOwnComment.getByRole("button", { name: /Reply to/i }),
	).toHaveCount(0);
	await expect(
		desktopOwnComment.getByRole("button", { name: "Edit" }),
	).toHaveCount(1);
	await expect(commentsPanel.locator("> header")).toHaveCount(0);
	await expect(page.getByText("Start the discussion")).toHaveCount(0);
	const joinPill = commentsPanel.getByRole("button", {
		name: "Join the conversation",
	});
	await expect(joinPill).toBeVisible();
	const joinPillMetrics = await joinPill.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const style = window.getComputedStyle(element);

		return {
			borderRadius: style.borderRadius,
			height: rect.height,
		};
	});

	expect(joinPillMetrics.height).toBeGreaterThanOrEqual(38);
	expect(joinPillMetrics.height).toBeLessThanOrEqual(46);
	expect(joinPillMetrics.borderRadius).not.toBe("0px");
	await joinPill.click();
	await expect(
		commentsPanel.locator(".community-root-comment-form-desktop textarea"),
	).toBeFocused();
	await expect(commentsPanel.getByRole("button", { name: "Cancel" })).toBeVisible();
	await expect(
		commentsPanel.getByRole("button", { exact: true, name: "Comment" }),
	).toBeVisible();
	await expectCommentComposerMentionAutocomplete({
		composer: commentsPanel.locator(
			".community-root-comment-form-desktop .community-root-comment-composer",
		),
		expectedMention: "@community_member ",
		query: "@comm",
	});
	const activeComposerMetrics = await commentsPanel
		.locator(
			".community-root-comment-form-desktop .community-root-comment-composer",
		)
		.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);

			return {
				borderRadius: style.borderRadius,
				height: rect.height,
			};
		});

	expect(activeComposerMetrics.height).toBeLessThanOrEqual(120);
	expect(activeComposerMetrics.borderRadius).not.toBe("0px");
	await commentsPanel.getByRole("button", { name: "Cancel" }).click();
	await expect(joinPill).toBeVisible();
});

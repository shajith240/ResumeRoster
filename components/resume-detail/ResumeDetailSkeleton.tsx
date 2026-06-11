import styles from "./ResumeDetailSkeleton.module.css";

const contextCards = Array.from({ length: 2 }, (_, index) => index);
const feedbackRows = Array.from({ length: 3 }, (_, index) => index);

function ContextCardSkeleton() {
	return (
		<section className={styles.contextCard}>
			<span className={styles.eyebrow} />
			<span className={styles.contextTitle} />
			<div className={styles.contextCopy}>
				<span />
				<span />
				<span />
				<span />
			</div>
		</section>
	);
}

function FeedbackRowSkeleton() {
	return (
		<article className={styles.feedbackRow}>
			<span className={styles.feedbackAvatar} />
			<div className={styles.feedbackBody}>
				<div className={styles.feedbackHeader}>
					<span />
					<span />
				</div>
				<div className={styles.feedbackCopy}>
					<span />
					<span />
				</div>
				<div className={styles.feedbackActions}>
					<span />
					<span />
					<span />
				</div>
			</div>
		</article>
	);
}

export function ResumeDetailSkeleton() {
	return (
		<section
			className={styles.thread}
			aria-busy="true"
			aria-label="Loading resume detail"
		>
			<div className={styles.mainScroll}>
				<article className={styles.previewPane}>
					<header className={styles.header}>
						<div className={styles.authorCluster}>
							<span className={styles.authorAvatar} />
							<div className={styles.authorCopy}>
								<span />
								<span />
							</div>
						</div>
						<div className={styles.headerActions}>
							<span className={styles.statusPill} />
							<span className={styles.ownerButton} />
						</div>
					</header>

					<span className={styles.titleLine} />
					<div className={styles.tags}>
						<span />
						<span />
					</div>

					<div className={styles.previewShell}>
						<div className={styles.previewToolbar}>
							<span />
							<span />
						</div>
						<div className={styles.previewPage}>
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
						</div>
					</div>
				</article>

				<aside className={styles.contextPanel}>
					<div className={styles.contextGrid}>
						{contextCards.map((card) => (
							<ContextCardSkeleton key={card} />
						))}
					</div>
				</aside>

				<section className={styles.discussionPanel}>
					<span className={styles.joinPill} />
					<header className={styles.threadListHeader}>
						<span />
						<span />
					</header>
					<div className={styles.feedbackList}>
						{feedbackRows.map((row) => (
							<FeedbackRowSkeleton key={row} />
						))}
					</div>
				</section>
			</div>
		</section>
	);
}

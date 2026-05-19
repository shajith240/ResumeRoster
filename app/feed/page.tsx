import AuthGate from "@/components/AuthGate";
import ResumeFeed from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import Link from "next/link";

export default function FeedPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="feed-app-shell page-enter">
        <section className="feed-center">
          <div className="feed-community-header">
            <div>
              <span>r/resumeroast</span>
              <h1>Community Roast Feed</h1>
              <p>
                Anonymous resumes. Public feedback. Sharpest roasts voted to the top.
              </p>
            </div>
            <Link className="btn-primary" href="/submit">
              Post resume
            </Link>
          </div>
          <ResumeFeed />
        </section>

        <aside className="feed-right-rail" aria-label="Community context">
          <section>
            <h2>About r/resumeroast</h2>
            <p>
              Post a redacted resume, get specific feedback, and vote for the roast
              that actually helps someone improve.
            </p>
            <div className="rail-meta">Created May 2026</div>
          </section>

          <section>
            <h2>Community rules</h2>
            <ol>
              <li>Roast the resume, not the person.</li>
              <li>Give fixes, not just insults.</li>
              <li>Never post personal details.</li>
            </ol>
          </section>

          <section>
            <h2>Quick actions</h2>
            <div className="quick-actions">
              <Link className="btn-primary" href="/submit">Submit anonymously</Link>
              <Link className="btn-primary btn-ghost" href="/leaderboard">View leaderboard</Link>
            </div>
          </section>
        </aside>
      </main>
    </AuthGate>
  );
}

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
            <h2>About the feed</h2>
            <p>
              Post a redacted resume, get specific feedback, and vote for the roast
              that actually helps someone improve.
            </p>
            <div className="rail-meta">Created May 2026</div>
          </section>

          <section className="feed-stats-panel">
            <h2>Community stats</h2>
            <div className="feed-stats-grid">
              <div>
                <span>Resumes roasted this week</span>
                <strong>42</strong>
              </div>
              <div>
                <span>Active roasters</span>
                <strong>18</strong>
              </div>
            </div>
          </section>

          <section>
            <h2>Community rules</h2>
            <ol>
              <li>Roast the resume, not the person.</li>
              <li>Give fixes, not just insults.</li>
              <li>Never post personal details.</li>
            </ol>
          </section>
        </aside>
      </main>
    </AuthGate>
  );
}

import AuthGate from "@/components/AuthGate";
import ResumeFeed from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import Link from "next/link";

export default function FeedPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="feed-app-shell">
        <aside className="feed-sidebar" aria-label="Primary feed navigation">
          <nav>
            <Link className="active" href="/feed">
              <span>⌂</span>
              Home
            </Link>
            <Link href="/submit">
              <span>+</span>
              Post resume
            </Link>
            <Link href="/leaderboard">
              <span>↟</span>
              Leaderboard
            </Link>
            <Link href="/profile/me">
              <span>◉</span>
              My profile
            </Link>
          </nav>

          <div className="feed-sidebar-group">
            <p>COMMUNITIES</p>
            <Link href="/feed">r/resumeroast</Link>
            <Link href="/leaderboard">Top roasters</Link>
            <Link href="/submit">Anonymous uploads</Link>
          </div>
        </aside>

        <section className="feed-center">
          <div className="feed-community-header">
            <div>
              <span>r/resumeroast</span>
              <h1>Community Roast Feed</h1>
              <p>
                Anonymous resumes, public feedback, and the sharpest roasts voted to
                the top.
              </p>
            </div>
            <Link className="app-button" href="/submit">
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
              <Link href="/submit">Submit anonymously</Link>
              <Link href="/leaderboard">View leaderboard</Link>
              <Link href="/profile/me">Edit profile</Link>
            </div>
          </section>
        </aside>
      </main>
    </AuthGate>
  );
}

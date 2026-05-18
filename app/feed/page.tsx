import AuthGate from "@/components/AuthGate";
import ResumeFeed from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";

export default function FeedPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="route-shell wide-route">
        <div className="route-intro">
          <h1>Community Roast Feed</h1>
          <p>
            Anonymous resumes people are brave enough to put in public. Read,
            roast, and vote for the feedback that actually helps.
          </p>
        </div>
        <ResumeFeed />
      </main>
    </AuthGate>
  );
}

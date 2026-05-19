import AuthGate from "@/components/AuthGate";
import Leaderboard from "@/components/Leaderboard";
import RouteHeader from "@/components/RouteHeader";

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="leaderboard-route page-enter">
        <div className="leaderboard-header">
          <h1>Leaderboard</h1>
          <p className="week-stat">
            <span className="big-number">247</span> helpful votes given this week
          </p>
          <p className="subtitle">The people writing the most useful feedback.</p>
        </div>
        <Leaderboard />
      </main>
    </AuthGate>
  );
}

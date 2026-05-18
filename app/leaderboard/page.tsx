import AuthGate from "@/components/AuthGate";
import Leaderboard from "@/components/Leaderboard";
import RouteHeader from "@/components/RouteHeader";

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="route-shell wide-route">
        <div className="route-intro">
          <h1>Leaderboard</h1>
          <p>
            The people writing the most useful feedback and the resume threads getting
            the most attention from the community.
          </p>
        </div>
        <Leaderboard />
      </main>
    </AuthGate>
  );
}

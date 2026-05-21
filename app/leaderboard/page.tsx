import AuthGate from "@/components/AuthGate";
import Leaderboard from "@/components/Leaderboard";
import RouteHeader from "@/components/RouteHeader";

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="page-enter">
        <Leaderboard />
      </main>
    </AuthGate>
  );
}

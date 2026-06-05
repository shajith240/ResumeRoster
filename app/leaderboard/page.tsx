import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import LeaderboardLazy from "@/components/route-lazy/LeaderboardLazy";

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="page-enter">
        <LeaderboardLazy />
      </main>
    </AuthGate>
  );
}

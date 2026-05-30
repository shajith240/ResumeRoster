import AdminDashboard from "@/components/AdminDashboard";
import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";

export default function AdminPage() {
	return (
		<AuthGate>
			<RouteHeader />
			<AdminDashboard view="overview" />
		</AuthGate>
	);
}

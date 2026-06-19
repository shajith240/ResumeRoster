import { notFound } from "next/navigation";
import AdminDashboard, {
	type AdminDashboardView,
} from "@/components/AdminDashboard";
import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";

const adminViews = new Set<AdminDashboardView>([
	"audit",
	"content",
	"data",
	"feedback",
	"people",
	"premium",
	"reports",
	"reviewers",
]);

type AdminSectionPageProps = {
	params: Promise<{ section: string }>;
};

export default async function AdminSectionPage({
	params,
}: AdminSectionPageProps) {
	const { section } = await params;

	if (!adminViews.has(section as AdminDashboardView)) {
		notFound();
	}

	return (
		<AuthGate>
			<RouteHeader />
			<AdminDashboard view={section as AdminDashboardView} />
		</AuthGate>
	);
}

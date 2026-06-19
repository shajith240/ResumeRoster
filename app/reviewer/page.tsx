import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import { ReviewerHub } from "@/components/reviewer-hub/ReviewerHub";

export const metadata = {
	title: "Reviewer queue — Linted",
};

export default function ReviewerPage() {
	return (
		<AuthGate>
			<RouteHeader />
			<main>
				<ReviewerHub />
			</main>
		</AuthGate>
	);
}

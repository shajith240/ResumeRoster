import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import SubmitResumeForm from "@/components/SubmitResumeForm";

export default function SubmitPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="submit-route page-enter">
        <div className="submit-header">
          <h1>Submit Anonymously</h1>
        </div>
        <SubmitResumeForm />
      </main>
    </AuthGate>
  );
}

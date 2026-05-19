import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import SubmitResumeForm from "@/components/SubmitResumeForm";

export default function SubmitPage() {
  return (
    <AuthGate>
      <RouteHeader />
      <main className="submit-route page-enter">
        <div className="submit-header">
          <div className="submit-icon" aria-hidden="true" />
          <h1>Submit Anonymously</h1>
          <p>
            Upload a PDF, give context, and let the community find the weak spots
            before recruiters do.
          </p>
        </div>
        <SubmitResumeForm />
      </main>
    </AuthGate>
  );
}

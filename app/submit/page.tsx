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
          <p>
            Upload a PDF, paste the JD, and tell roasters exactly what kind of
            feedback will help before recruiters see it.
          </p>
        </div>
        <SubmitResumeForm />
      </main>
    </AuthGate>
  );
}

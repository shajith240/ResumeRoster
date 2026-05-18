import RouteHeader from "@/components/RouteHeader";
import SubmitResumeForm from "@/components/SubmitResumeForm";

export default function SubmitPage() {
  return (
    <>
      <RouteHeader />
      <main className="route-shell compact-route">
        <div className="route-intro">
          <h1>Submit Anonymously</h1>
          <p>
            Upload a PDF, give people context, and let the community roast the weak
            spots before recruiters do.
          </p>
        </div>
        <SubmitResumeForm />
      </main>
    </>
  );
}

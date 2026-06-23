import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import SubmitResumeForm from "@/components/SubmitResumeForm";

export default function SubmitPage() {
  return (
    <>
      <link rel="preload" as="image" href="/assets/step1.png" />
      <link rel="preload" as="image" href="/assets/step2.png" />
      <link rel="preload" as="image" href="/assets/step3.png" />
      <link rel="preload" as="image" href="/assets/step4.png" />
      <link rel="preload" as="image" href="/assets/step5.png" />
      <AuthGate>
        <RouteHeader />
        <main className="submit-route page-enter">
          <div className="submit-header">
            <h1>Submit Anonymously</h1>
          </div>
          <SubmitResumeForm />
        </main>
      </AuthGate>
    </>
  );
}

import AuthGate from "@/components/AuthGate";
import ResumeDetail from "@/components/ResumeDetail";
import RouteHeader from "@/components/RouteHeader";

type ResumePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumePage({ params }: ResumePageProps) {
  const { id } = await params;

  return (
    <AuthGate>
      <RouteHeader />
      <main className="resume-detail-route page-enter">
        <ResumeDetail resumeId={id} />
      </main>
    </AuthGate>
  );
}

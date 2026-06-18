import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import ResumeDetailLazy from "@/components/route-lazy/ResumeDetailLazy";

type ResumePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumePage({ params }: ResumePageProps) {
  const { id } = await params;

  return (
    <AuthGate>
      <RouteHeader />
      <main className="resume-detail-route page-enter">
        <ResumeDetailLazy resumeId={id} />
      </main>
    </AuthGate>
  );
}

import ResumeDetail from "@/components/ResumeDetail";
import RouteHeader from "@/components/RouteHeader";

type ResumePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumePage({ params }: ResumePageProps) {
  const { id } = await params;

  return (
    <>
      <RouteHeader />
      <main className="route-shell detail-route">
        <ResumeDetail resumeId={id} />
      </main>
    </>
  );
}

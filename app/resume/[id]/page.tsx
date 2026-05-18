type ResumePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumePage({ params }: ResumePageProps) {
  const { id } = await params;

  return (
    <main className="route-shell">
      <h1>Resume Roast Thread</h1>
      <p>Phase 1 will show resume {id} and its public roast thread here.</p>
    </main>
  );
}

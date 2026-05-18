type ProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <main className="route-shell">
      <h1>Roaster Profile</h1>
      <p>Phase 2 will show public roaster reputation for profile {id} here.</p>
    </main>
  );
}

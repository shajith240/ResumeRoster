import AuthGate from "@/components/AuthGate";
import ProfileDetail from "@/components/ProfileDetail";
import RouteHeader from "@/components/RouteHeader";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <AuthGate>
      <RouteHeader />
      <main>
        <ProfileDetail profileId={id} />
      </main>
    </AuthGate>
  );
}

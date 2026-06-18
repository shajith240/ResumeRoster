import AuthGate from "@/components/AuthGate";
import RouteHeader from "@/components/RouteHeader";
import ProfileDetailLazy from "@/components/route-lazy/ProfileDetailLazy";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <AuthGate>
      <RouteHeader />
      <main>
        <ProfileDetailLazy profileId={id} />
      </main>
    </AuthGate>
  );
}

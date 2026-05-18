import ProfileDetail from "@/components/ProfileDetail";
import RouteHeader from "@/components/RouteHeader";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;

  return (
    <>
      <RouteHeader />
      <main className="route-shell wide-route">
        <ProfileDetail profileId={id} />
      </main>
    </>
  );
}

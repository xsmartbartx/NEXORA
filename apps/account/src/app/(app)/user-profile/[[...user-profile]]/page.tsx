import { UserProfile } from "@nexora/auth/client";
import { requireAuth } from "@nexora/auth/server";

export default async function UserProfilePage() {
  await requireAuth();
  return (
    <div className="flex flex-1 justify-center px-6 py-12">
      <UserProfile />
    </div>
  );
}

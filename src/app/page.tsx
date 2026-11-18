import { redirect } from "next/navigation";
import { getSessionUser, homeOf } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Root() {
  const u = await getSessionUser();
  redirect(u ? homeOf(u.role) : "/login");
}

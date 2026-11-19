import { actor } from "@/lib/session";
import { getInstitution, getMaxStudents } from "@/lib/q";
import { buildTemplate } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user;
  try {
    user = await actor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const asked = Number(new URL(req.url).searchParams.get("institution"));
  const instId = user.role === "guru" ? user.institution_id : Number.isInteger(asked) && asked > 0 ? asked : null;
  const inst = instId ? await getInstitution(instId) : null;
  const buf = await buildTemplate(inst?.name ?? "", await getMaxStudents());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Template_Murid_BukuFlow.xlsx"`,
    },
  });
}

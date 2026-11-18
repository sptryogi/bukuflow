import type { Metadata } from "next";
import { listGurus, listInstitutionOptions } from "@/lib/q";
import GuruTable from "@/components/GuruTable";

export const metadata: Metadata = { title: "Guru" };

export default async function GuruAdminPage() {
  const [gurus, options] = await Promise.all([listGurus(), listInstitutionOptions()]);
  return (
    <>
      <h1>Guru / Pengguna</h1>
      <p className="sub">Semua guru yang mendaftar, dari institusi mana pun. Setujui yang masih menunggu.</p>
      <GuruTable gurus={gurus} institutions={options} />
    </>
  );
}

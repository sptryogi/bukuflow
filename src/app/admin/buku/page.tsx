import type { Metadata } from "next";
import { allBooks } from "@/lib/q";
import BukuClient from "./BukuClient";
import TemplateStock from "@/components/TemplateStock";
import { templateStatus } from "@/lib/asesmen";

export const metadata: Metadata = { title: "Buku" };

export default async function BukuPage() {
  const [books, stock] = await Promise.all([allBooks(), templateStatus().catch(() => [])]);
  return (
    <>
      <BukuClient books={books} />
      <div style={{ marginTop: 18 }}><TemplateStock items={stock} /></div>
    </>
  );
}

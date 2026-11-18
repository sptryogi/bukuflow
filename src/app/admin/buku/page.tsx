import type { Metadata } from "next";
import { allBooks } from "@/lib/q";
import BukuClient from "./BukuClient";

export const metadata: Metadata = { title: "Buku" };

export default async function BukuPage() {
  return <BukuClient books={await allBooks()} />;
}

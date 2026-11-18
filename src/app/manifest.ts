import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NusaLiterasi · Alokasi Buku",
    short_name: "NusaLiterasi",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f8",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

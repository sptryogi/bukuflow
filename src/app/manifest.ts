import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BukuFlow · Alokasi Buku Literasi",
    short_name: "BukuFlow",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8ff",
    theme_color: "#4361ee",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

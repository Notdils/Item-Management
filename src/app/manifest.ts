import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bengkel Anargya",
    short_name: "Bengkel",
    description: "Catat posisi alat dan stok bahan bengkel Anargya ITS EV Team.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e3e4df",
    theme_color: "#e3e4df",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Foto barang", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cari barang", url: "/cari", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

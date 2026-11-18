// Kompres foto kamera di HP sebelum diunggah: sisi terpanjang 1280 px, WebP (fallback JPEG).
// Foto kamera HP 3-8 MB menjadi sekitar 150-300 KB.
const MAX_SIDE = 1280;

export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak bisa memproses foto");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  // Safari lama mengembalikan PNG kalau WebP tidak didukung, jadi cek tipe hasilnya.
  const webp = await toBlob("image/webp", 0.8);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", 0.82);
  if (!jpeg) throw new Error("Gagal mengompres foto");
  return jpeg;
}

export function photoExt(blob: Blob) {
  return blob.type === "image/webp" ? "webp" : "jpg";
}

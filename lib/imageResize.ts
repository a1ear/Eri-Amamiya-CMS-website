export type ResizedImage = { blob: Blob; width: number; height: number };

/**
 * Shrinks a photo in the browser before upload so phone pictures (often
 * 5–15 MB) upload quickly on mobile data. Output is WebP, longest side
 * `maxSide`. The server still verifies the bytes; this is only for speed.
 */
export async function resizeImage(
  file: File,
  maxSide = 1024,
  quality = 0.86,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    // Older Safari cannot encode WebP and returns PNG or null; fall back to JPEG.
    if (blob && blob.type === "image/webp") return { blob, width, height };
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!jpeg) throw new Error("Could not process this image");
    return { blob: jpeg, width, height };
  } finally {
    bitmap.close();
  }
}

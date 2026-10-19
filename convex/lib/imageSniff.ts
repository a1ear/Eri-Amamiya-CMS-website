/**
 * Identifies an image by its leading bytes rather than the Content-Type the
 * browser claimed at upload. Returns null for anything that is not JPEG, PNG
 * or WebP.
 */
export function sniffImageType(head: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const at = (i: number, bytes: number[]) => bytes.every((b, j) => head[i + j] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" .... "WEBP"
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

import type { PublicPhoto } from "@/lib/public-data";

/** Alt text: caption → "{tag} cosplay" → "Cosplay photo", plus the creator. */
export function photoAlt(photo: PublicPhoto, creator: string) {
  const subject = photo.caption || (photo.tag ? `${photo.tag} cosplay` : "Cosplay photo");
  return creator ? `${subject} by ${creator}` : subject;
}

import type { MediaItem } from "@/lib/admin/media-service";

export type { MediaItem };

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/tiff";

export async function uploadImages(files: File[] | FileList, alt = ""): Promise<{ items: MediaItem[]; errors: { filename: string; error: string }[] }> {
  const form = new FormData();
  for (const f of Array.from(files)) form.append("file", f);
  if (alt) form.set("alt", alt);
  const res = await fetch("/api/admin/media", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { items?: MediaItem[]; errors?: { filename: string; error: string }[]; error?: string };
  if (!res.ok && !data.items?.length) throw new Error(data.error ?? "Upload failed");
  return { items: data.items ?? [], errors: data.errors ?? [] };
}

export function isImageFile(f: File) {
  return f.type.startsWith("image/") && f.type !== "image/svg+xml";
}

/** Opens the OS file picker and resolves with the chosen files. */
export function pickFiles(accept = IMAGE_ACCEPT, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

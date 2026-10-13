import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp, { type Metadata as SharpMetadata } from "sharp";
import { IMAGE_WIDTHS, nearestWidth } from "./image-widths";

export const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);
export const MAX_DIMENSION = 2400;

export function uploadDir(): string {
  // turbopackIgnore: the folder is runtime data; don't let output tracing copy the project into the build.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || "./uploads");
}

export function maxUploadBytes(): number {
  return (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024;
}

export class MediaError extends Error {}

export type StoredImage = { path: string; width: number; height: number; mimeType: string; size: number };

/**
 * Validates an image by its content (not its name), strips metadata, fixes orientation,
 * downsizes to MAX_DIMENSION and re-encodes to WebP. Nothing user-supplied is written to disk as-is.
 */
export async function storeImage(input: Buffer): Promise<StoredImage> {
  if (input.byteLength === 0) throw new MediaError("Empty file");
  if (input.byteLength > maxUploadBytes()) throw new MediaError(`File is larger than ${process.env.MAX_UPLOAD_MB || 15} MB`);
  let meta: SharpMetadata;
  try {
    meta = await sharp(input, { limitInputPixels: 100_000_000 }).metadata();
  } catch {
    throw new MediaError("Not a supported image");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new MediaError("Unsupported image type");
  const animated = (meta.pages ?? 1) > 1 && (meta.format === "gif" || meta.format === "webp");

  const { data, info } = await sharp(input, { animated, limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const now = new Date();
  const rel = path.posix.join(
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomBytes(9).toString("base64url")}.webp`,
  );
  const abs = path.join(uploadDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  const height = animated && info.pageHeight ? info.pageHeight : info.height;
  return { path: rel, width: info.width, height, mimeType: "image/webp", size: data.byteLength };
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** Resolve a public media path to an absolute file path, rejecting traversal. */
export function resolveMediaPath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => !SAFE_SEGMENT.test(s) || s.startsWith(".") || s.includes(".."))) return null;
  const root = uploadDir();
  const abs = path.join(root, ...segments);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

/** Returns the bytes for a stored image at a whitelisted width (generated and cached on first request). */
export async function readVariant(abs: string, requestedWidth: number | null): Promise<Buffer> {
  if (!requestedWidth) return readFile(abs);
  const width = nearestWidth(requestedWidth);
  const rel = path.relative(uploadDir(), abs);
  const cached = path.join(uploadDir(), ".cache", `w${width}`, rel);
  try {
    return await readFile(cached);
  } catch {
    // generate below
  }
  const original = await readFile(abs);
  const meta = await sharp(original).metadata();
  const out =
    meta.width && meta.width <= width
      ? original
      : await sharp(original, { animated: (meta.pages ?? 1) > 1 }).resize({ width }).webp({ quality: 80 }).toBuffer();
  await mkdir(path.dirname(cached), { recursive: true });
  await writeFile(cached, out);
  return out;
}

export async function deleteStoredImage(rel: string) {
  const abs = resolveMediaPath(rel.split("/"));
  if (!abs) return;
  await unlink(abs).catch(() => {});
  // Remove generated width variants of this file.
  await Promise.all(IMAGE_WIDTHS.map((w) => unlink(path.join(uploadDir(), ".cache", `w${w}`, rel)).catch(() => {})));
}

export async function fileExists(abs: string) {
  try {
    return (await stat(abs)).isFile();
  } catch {
    return false;
  }
}

export function mediaUrl(rel: string) {
  return `/media/${rel}`;
}

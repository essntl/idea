/** next/image loader: our media route serves pre-sized WebP variants via ?w=. */
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/media/")) return `${src}?w=${width}`;
  return src;
}

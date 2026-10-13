/** Widths the media route will generate. Shared by next/image loader, content srcsets and the media route. */
export const IMAGE_WIDTHS = [320, 480, 640, 768, 960, 1200, 1600, 2000] as const;

export function nearestWidth(requested: number): number {
  return IMAGE_WIDTHS.find((w) => w >= requested) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!;
}

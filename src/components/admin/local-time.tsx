"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Formats in the viewer's timezone after hydration (the server renders a neutral UTC date first). */
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const d = new Date(iso);
  const text = !isClient
    ? iso.slice(0, dateOnly ? 10 : 16).replace("T", " ")
    : dateOnly
      ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return <time dateTime={iso}>{text}</time>;
}

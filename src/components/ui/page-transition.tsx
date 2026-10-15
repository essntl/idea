"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/**
 * Cross-fades between pages (old page exits, new page enters) but not when the same page re-renders,
 * e.g. router.refresh() after saving in the admin.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} update="none">
      {children}
    </ViewTransition>
  );
}

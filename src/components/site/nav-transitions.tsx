"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Enables the page fade only after the first client-side navigation, so the initial paint (LCP) isn't delayed. */
export function NavTransitions() {
  const pathname = usePathname();
  const initial = useRef(pathname);
  useEffect(() => {
    if (pathname !== initial.current) document.documentElement.classList.add("nav-ready");
  }, [pathname]);
  return null;
}

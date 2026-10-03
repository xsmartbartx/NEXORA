"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-runs the page's server render on an interval — only while the tab is visible, so a forgotten background tab doesn't keep probing production. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}

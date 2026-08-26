"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({
  fallbackHref,
  label,
}: {
  /** Where to go if there's no in-app history to go back to (e.g. the page
   * was opened directly from a shared link). */
  fallbackHref: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label={label}
      className="rounded-md p-1 transition-colors hover:bg-muted"
    >
      <ArrowLeft className="size-5 text-muted-foreground" />
    </button>
  );
}

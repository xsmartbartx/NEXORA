import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@nexora/ui";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-28 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404</span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        This page doesn&rsquo;t exist.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The route may have moved, or the product it pointed to hasn&rsquo;t been promoted to a
        public release yet.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-8" })}>
        Back home
      </Link>
    </div>
  );
}

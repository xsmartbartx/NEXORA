import { Button } from "@nexora/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Technology · AI · Security
        </span>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Build What&rsquo;s Next.
        </h1>

        <p className="text-lg text-pretty text-muted-foreground sm:text-xl">
          NEXORA is a technology platform. Its products are intelligent software,
          AI systems and secure digital products that share one account, one
          console, one API surface and one operational backbone.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button size="lg">Explore the platform</Button>
          <Button size="lg" variant="outline">
            Read the architecture
          </Button>
        </div>
      </div>
    </main>
  );
}

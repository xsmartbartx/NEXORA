/**
 * Renders a single `application/ld+json` block. `data` is JSON-serializable
 * structured data we construct ourselves (never raw user input), so
 * `JSON.stringify` is safe here — there's no untrusted string being
 * interpolated into the script body.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

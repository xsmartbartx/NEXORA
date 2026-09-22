import { Badge } from "@nexora/ui";

/**
 * §8.4 requires an environment badge in the shell. `NEXT_PUBLIC_NEXORA_ENV`
 * is set per deploy target (local/preview/staging/production, §11.1);
 * omitted in production so the badge simply doesn't render there.
 */
export function EnvironmentBadge() {
  const env = process.env.NEXT_PUBLIC_NEXORA_ENV;
  if (!env || env === "production") return null;
  return <Badge variant="warning">{env}</Badge>;
}

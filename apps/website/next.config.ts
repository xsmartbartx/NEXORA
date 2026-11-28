import path from "node:path";
import type { NextConfig } from "next";

// Vigilo and NeuraWall are products with their own sites; their pages here are redirects to
// them, as a company site links out to a product's own site. Temporary (307) so the
// destinations can be changed freely.
const VIGILO_URL = (process.env.NEXT_PUBLIC_VIGILO_URL || "https://vigilo.onenexora.com").replace(
  /\/$/,
  "",
);
const NEURAWALL_URL = (
  process.env.NEXT_PUBLIC_NEURAWALL_URL || "https://neurawall.onenexora.com"
).replace(/\/$/, "");

// docs/NEXORA-PLATFORM-ARCHITECTURE.md §8.1 lists /status as a redirect to
// status.onenexora.com and /developers in the apex IA; both live on their own hosts.
// §8.1 doesn't say permanent, so these are temporary (307) like the two above.
const STATUS_URL = (process.env.NEXT_PUBLIC_STATUS_URL || "https://status.onenexora.com").replace(
  /\/$/,
  "",
);
const DEVELOPERS_URL = (
  process.env.NEXT_PUBLIC_DEVELOPERS_URL || "https://developers.onenexora.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      { source: "/products/vigilo", destination: VIGILO_URL, permanent: false },
      { source: "/products/neurawall", destination: NEURAWALL_URL, permanent: false },
      { source: "/status", destination: STATUS_URL, permanent: false },
      { source: "/developers", destination: DEVELOPERS_URL, permanent: false },
    ];
  },
  // Docker (infrastructure/docker): a self-contained server.js plus only
  // the node_modules this app actually needs, traced from the monorepo
  // root rather than this app's own directory so workspace packages
  // resolve correctly. See infrastructure/docker/README.md.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;

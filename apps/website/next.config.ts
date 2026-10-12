import path from "node:path";
import type { NextConfig } from "next";

// Vigilo is a product with its own site; its page here is a redirect to it, as a company
// site links out to a product's own site. Temporary (307) so it can be changed freely.
const VIGILO_URL = (process.env.NEXT_PUBLIC_VIGILO_URL ?? "https://vigilo.onenexora.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [{ source: "/products/vigilo", destination: VIGILO_URL, permanent: false }];
  },
  // Docker (infrastructure/docker): a self-contained server.js plus only
  // the node_modules this app actually needs, traced from the monorepo
  // root rather than this app's own directory so workspace packages
  // resolve correctly. See infrastructure/docker/README.md.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;

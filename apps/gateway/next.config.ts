import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Docker (infrastructure/docker): a self-contained server.js plus only
  // the node_modules this app actually needs, traced from the monorepo
  // root rather than this app's own directory so workspace packages
  // resolve correctly. See infrastructure/docker/README.md.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds .next/standalone: a small self-contained server (node server.js)
  // for the Docker image (Dockerfile, docs/deploy/vps-setup.md).
  output: "standalone",
};

export default nextConfig;

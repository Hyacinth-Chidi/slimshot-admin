import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds .next/standalone: a small self-contained server (node server.js)
  // for the Docker image (Dockerfile, docs/deploy/vps-setup.md).
  output: "standalone",

  // Where pages lived before the navigation was grouped into Library, People
  // and System. Bookmarks and old links keep working; query strings carry over.
  async redirects() {
    return [
      { source: "/assets", destination: "/audio", permanent: false },
      { source: "/assets/:id", destination: "/audio/:id", permanent: false },
      { source: "/categories", destination: "/audio/categories", permanent: false },
      { source: "/settings", destination: "/system/providers", permanent: false },
      { source: "/audit", destination: "/system/audit", permanent: false },
    ];
  },
};

export default nextConfig;

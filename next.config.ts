import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone はOpenNextのcloudflareビルド時のみ必要。Vercelでは不要
  output: process.env.CLOUDFLARE_DEPLOY === "true" ? "standalone" : undefined,
  // Turbopack config (local dev) — no webpack needed here
  turbopack: {},
  webpack(config, { nextRuntime }) {
    // Edge runtime (Cloudflare Workers) cannot use native Node.js modules.
    // Alias them to false so the bundler excludes them from edge builds.
    if (nextRuntime === "edge") {
      config.resolve.alias = {
        ...config.resolve.alias,
        "better-sqlite3": false,
        "drizzle-orm/better-sqlite3": false,
      };
    }
    return config;
  },
};

export default nextConfig;

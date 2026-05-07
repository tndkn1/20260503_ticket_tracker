import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack(config, { nextRuntime }) {
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

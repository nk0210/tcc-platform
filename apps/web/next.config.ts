import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */

  // Pin Turbopack's root explicitly instead of letting it infer one from
  // lockfile locations (which is what triggered the "Detected additional
  // lockfiles" warning and made it scan upward through the monorepo).
  //
  // This must point at the MONOREPO root, not apps/web itself: pnpm hoists
  // packages into a shared <repo>/node_modules/.pnpm store, and
  // apps/web/node_modules/next is a symlink resolving out to it. Turbopack's
  // `root` is a resolution boundary — "only files at or above this
  // directory can be resolved" — so setting it to apps/web cuts off access
  // to that symlinked store and breaks resolving `next` itself. Pointing it
  // at the repo root keeps the boundary at the actual top of the workspace
  // while still fixing the mis-detection that caused the original warning.
  //
  // Built from process.cwd() rather than __dirname: next.config.ts runs
  // through a build step before execution and __dirname resolved one
  // directory too deep (into app/) under that transform, but `next dev` is
  // always run from apps/web (see package.json's "dev" script / the
  // documented workflow of cd'ing into apps/web first), so process.cwd()
  // reliably lands on apps/web here.
  turbopack: {
    root: path.resolve(process.cwd(), "..", ".."),
  },

  // Reduce logging noise in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // Compress responses
  compress: true,

  // Minimize image optimization work in dev
  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

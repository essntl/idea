import type { NextConfig } from "next";
import { IMAGE_WIDTHS } from "./src/lib/image-widths";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Dev-only badge; keep it away from the admin sidebar.
  devIndicators: { position: "bottom-right" },
  // Old Ghost URLs end with "/"; proxy.ts handles trailing slashes so legacy links redirect in one hop.
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["sharp", "@node-rs/argon2", "happy-dom", "pg"],
  // Runtime data must never end up in the build output.
  outputFileTracingExcludes: { "*": ["uploads/**"] },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [...IMAGE_WIDTHS],
    imageSizes: [64, 128, 256],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

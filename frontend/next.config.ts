import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler: true,
  trailingSlash: false,
  allowedDevOrigins: ["192.168.104.44"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://192.168.104.44:8001/api/:path*",
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Kalendář byl nahrazen Plánem směn — staré deeplinky bezpečně přesměrovat
      { source: '/calendar', destination: '/shifts', permanent: false },
    ]
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/ticket-pdf": ["./assets/ticket-font.ttf"],
    "/api/admin/test-confirmation-email": ["./assets/ticket-font.ttf"],
  },
};

export default nextConfig;

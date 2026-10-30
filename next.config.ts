import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "pdfkit", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;

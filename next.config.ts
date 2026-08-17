import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AppFolio credentials are read on the server only; never expose them to the bundle.
  serverExternalPackages: ["@prisma/client"],

  // /setup reads the table-creation SQL at runtime. Next's tracing can't see a
  // path built at runtime, so the file has to be included explicitly or it is
  // simply absent in the deployed bundle.
  outputFileTracingIncludes: {
    "/setup": ["./prisma/init.sql"],
  },
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AppFolio credentials are read on the server only; never expose them to the bundle.
  serverExternalPackages: ["@prisma/client"],

  // This app is nested inside the Sentri repo, which has its own lockfile. Pin
  // the workspace root so Next doesn't infer the parent directory.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;

import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  typescript: { tsconfigPath: 'tsconfig.vercel.json' },
  poweredByHeader: false,
};
export default nextConfig;

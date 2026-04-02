import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 这里的配置是关键 */
  output: 'standalone',
  typescript: {
    // 即使有 TypeScript 错误也允许生产构建通过
    ignoreBuildErrors: true,
  },
  eslint: {
    // 在生产构建期间禁用 ESLint 检查
    ignoreDuringBuilds: true,
  },
  // 如果你用到了 Cloudflare 的边缘运行时，保留这个
  // experimental: { runtime: 'edge' } 
};

export default nextConfig;
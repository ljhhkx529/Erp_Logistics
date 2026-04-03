// next.config.mjs
import { withCloudflare } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 忽略构建期间的 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 2. 忽略构建期间的 TypeScript 类型错误
  typescript: {
    ignoreBuildErrors: true,
  },
  // 3. 其他 Next.js 配置可以继续往这里加
  /* images: { unoptimized: true },
  */
};

// 🚀 核心：使用 withCloudflare 包装配置
// 这一步会激活 getRequestContext 注入，解决 "is not a function" 报错
export default withCloudflare(nextConfig);
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// 🚀 开发环境下运行
if (process.env.NODE_ENV === 'development') {
  setupDevPlatform();
}

const nextConfig = {
  // 1. 忽略 ESLint 检查
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 2. 忽略 TypeScript 类型错误
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
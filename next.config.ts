import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// 🚀 开发环境下运行
if (process.env.NODE_ENV === 'development') {
  setupDevPlatform();
}

const nextConfig = {
  /* config options here */
};

export default nextConfig;
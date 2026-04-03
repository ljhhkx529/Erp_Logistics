/** @type {import('next').NextConfig} */
const nextConfig = {
  // 官方标准：Next.js 15 无需额外包装，OpenNext 命令行工具会自动处理转换
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
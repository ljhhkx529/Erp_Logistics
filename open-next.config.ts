import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    runtime: "node",
  },
  // 如果你有特定的缓存规则或路由需求，可以在这里添加
};

export default config;
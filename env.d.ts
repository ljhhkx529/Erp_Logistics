interface CloudflareEnv {
  logistics_db: D1Database;
  API_KEY: string;
}

// 这里的声明非常重要，它告诉编译器 getRequestContext 会返回什么
declare module "@opennextjs/cloudflare" {
  import { RequestContext } from "@cloudflare/workers-types";
  export function getRequestContext(): {
    env: CloudflareEnv;
    cf: any;
    ctx: RequestContext;
  };
}
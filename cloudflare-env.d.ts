declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DASHBOARD_OWNER_EMAIL?: string;
  }
}

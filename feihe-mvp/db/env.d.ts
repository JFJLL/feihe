declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    SITE_ORIGIN?: string;
    XHS_BASE_URL?: string;
    XHS_COMMENT_L1_PAGE_SIZE?: string;
    XHS_COMMENT_L2_PAGE_SIZE?: string;
    XHS_SEARCH_PAGE_SIZE?: string;
    XHS_REQUEST_TIMEOUT_SECONDS?: string;
    OSS_ACCESS_KEY_ID?: string;
    OSS_ACCESS_KEY_SECRET?: string;
    OSS_ENDPOINT?: string;
    OSS_BUCKET?: string;
    OSS_COOKIE_OBJECT?: string;
    FEISHU_APP_ID?: string;
    FEISHU_APP_SECRET?: string;
    KEYSTONE_API_KEY?: string;
    KEYSTONE_BASE_URL?: string;
    KEYSTONE_MODEL?: string;
    KEYSTONE_IMAGE_MODEL?: string;
    PUBLIC_SITE_ACCESS?: string;
  }
}

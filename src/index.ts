import { handleApi } from "./api.ts";

export function auditDataPoint(url: URL, status: number): AnalyticsEngineDataPoint {
  return {
    indexes: ["shufl"],
    blobs: [url.hostname, url.pathname, String(status)],
    doubles: [status],
  };
}

function recordAuditHit(env: Env, url: URL, status: number): void {
  try {
    env.AUDIT_HITS.writeDataPoint(auditDataPoint(url, status));
  } catch {
    // Fleet audit must not break the scorekeeper.
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === "/api/games" ||
      url.pathname.startsWith("/api/games/") ||
      url.pathname === "/api/leaderboard"
    ) {
      const response = await handleApi(request, env, url);
      recordAuditHit(env, url, response.status);
      return response;
    }
    const response = await env.ASSETS.fetch(request);
    recordAuditHit(env, url, response.status);
    return response;
  },
} satisfies ExportedHandler<Env>;

import { handleApi } from "./api.ts";
import { BUILT, SHA } from "./version.generated.ts";

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

export function versionPayload(cfVersionId: string | null | undefined): {
  app: string;
  sha: string;
  built: string;
  cf_version_id: string | null;
} {
  return {
    app: "shufl",
    sha: SHA,
    built: BUILT,
    cf_version_id: cfVersionId ?? null,
  };
}

/** Clone headers so asset responses (immutable) can carry the fleet version. */
export function withCybushVersion(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Cybush-Version", SHA);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;
    if (request.method === "GET" && url.pathname === "/__version") {
      response = new Response(JSON.stringify(versionPayload(env.CF_VERSION?.id)), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } else if (
      url.pathname === "/api/games" ||
      url.pathname.startsWith("/api/games/") ||
      url.pathname === "/api/leaderboard"
    ) {
      response = await handleApi(request, env, url);
    } else {
      response = await env.ASSETS.fetch(request);
    }
    recordAuditHit(env, url, response.status);
    return withCybushVersion(response);
  },
} satisfies ExportedHandler<Env>;

interface Env {
  ASSETS: Fetcher;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "dashboard-bnba-odhiv-sumut", mode: "starter" });
    }

    // Fail closed: no respondent or health data is served until authentication
    // and the Google API adapter have been configured and security-reviewed.
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Belum dikonfigurasi. Akses data memerlukan autentikasi admin." }, 503);
    }

    return env.ASSETS.fetch(request);
  }
};

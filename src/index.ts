import { json, Router } from 'itty-router';

interface Env {
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_TAB?: string;
}

const router = Router();

router.get('/api/health', () => Response.json({ ok: true, service: 'dashboard-bnba-odhiv-sumut', mode: 'starter' }, {
  headers: { 'Cache-Control': 'no-store' }
}));

// Deliberately fail closed until admin authentication and Google API adapter are
// fully configured and security-reviewed. Never expose respondent data publicly.
router.all('/api/*', () => Response.json({ error: 'Not configured. Admin authentication is required before data access.' }, {
  status: 503,
  headers: { 'Cache-Control': 'no-store' }
}));

router.all('*', async (request: Request, env: Env) => {
  const assetResponse = await env.ASSETS.fetch(request);
  return assetResponse;
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  }
};

# Apache Junction Epoxy Flooring

Marketing site for Apache Junction Epoxy Flooring. Plain HTML, CSS and JavaScript in `public/`, deployed to Cloudflare Workers as static assets (`wrangler.jsonc`).

## Deploying on Cloudflare
Workers & Pages → Create → Import a repository → pick this repo.
- Project / Worker name: `apachejunctionepoxy` (must match `name` in `wrangler.jsonc`)
- Build command: leave empty
- Deploy command: `npx wrangler deploy`

Every push to `main` redeploys automatically.

## Placeholders to replace
- Phone `(520) 593-5152` and email `hello@apachejunctionepoxy.com` (search `public/` for both)
- Logo files live in `public/images/` (logo.webp for light backgrounds, logo-light.webp for dark ones, icon-*.png for browser tabs)
- Estimate form: posts to `/api/estimate` (src/worker.js), which emails each request through Resend. Set RESEND_API_KEY (secret), LEADS_TO_EMAIL and optionally LEADS_FROM_EMAIL under the Worker's Settings → Variables and Secrets in Cloudflare.

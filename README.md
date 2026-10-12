# Apache Junction Epoxy

Marketing site for Apache Junction Epoxy. Plain HTML, CSS and JavaScript in `public/`, deployed to Cloudflare Workers as static assets (`wrangler.jsonc`).

## Deploying on Cloudflare
Workers & Pages → Create → Import a repository → pick this repo.
- Project / Worker name: `apachejunctionepoxy` (must match `name` in `wrangler.jsonc`)
- Build command: leave empty
- Deploy command: `npx wrangler deploy`

Every push to `main` redeploys automatically.

## Placeholders to replace
- Phone `(480) 555-0142` and email `hello@apachejunctionepoxy.com` (search `public/` for both)
- Logo: the triangle mark in `index.html` header and `public/favicon.svg`
- The estimate form currently opens the visitor's email app; connect it to a form service or a Worker to receive submissions directly.

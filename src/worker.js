/**
 * Apache Junction Epoxy Flooring — Cloudflare Worker
 *
 * Serves the static site from ./public and handles the estimate form at
 * POST /api/estimate, emailing each request with Cloudflare Email Service.
 *
 * Configuration (wrangler.jsonc):
 *   EMAIL            send_email binding (Cloudflare Email Service)
 *   LEADS_TO_EMAIL   where estimate requests go (a verified address on this account)
 *   LEADS_FROM_EMAIL sender, e.g. "Apache Junction Epoxy Flooring <info@apachejunctionepoxy.com>"
 */

const DEFAULT_FROM = "Apache Junction Epoxy Flooring <info@apachejunctionepoxy.com>";
const LIMITS = { name: 100, phone: 40, email: 200, service: 80, city: 80, message: 3000, page: 200 };
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Read a setting by name, ignoring case and stray spaces in the name or value. */
function setting(env, name) {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(env)) {
    if (k.trim().toLowerCase() === want && typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // One address for search engines: www.apachejunctionepoxy.com -> apachejunctionepoxy.com
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/estimate") return handleEstimate(request, env);
    if (url.pathname === "/api/estimate/status") return status(env);
    return env.ASSETS.fetch(request);
  },
};

/** Setup check: says what the Worker can see, never any values. */
function status(env) {
  const to = setting(env, "LEADS_TO_EMAIL");
  const cf = Boolean(env.EMAIL && typeof env.EMAIL.send === "function");
  return json({
    ready: Boolean(to && cf),
    sends_with: "Cloudflare Email",
    CLOUDFLARE_EMAIL: cf ? "connected" : "missing",
    LEADS_TO_EMAIL: to ? (to.split(",").every((a) => EMAIL_RE.test(a.trim())) ? "found" : "found, but it isn't a valid email address") : "missing",
    LEADS_FROM_EMAIL: setting(env, "LEADS_FROM_EMAIL") ? "found" : "not set (using the default sender)",
  });
}

/** "Name <addr@x.com>" -> { name, email } */
function parseAddress(s) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  return m ? { name: m[1].replace(/^"|"$/g, ""), email: m[2].trim() } : { email: s.trim() };
}

async function sendWithCloudflare(env, msg) {
  await env.EMAIL.send({
    to: msg.to,
    from: parseAddress(msg.from),
    replyTo: msg.replyTo,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

async function handleEstimate(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST to send an estimate request." }, 405, { Allow: "POST" });
  }

  // Only accept submissions from this site.
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: "Requests from other sites aren't accepted." }, 403);
  }

  const type = request.headers.get("Content-Type") || "";
  const wantsJson = type.includes("application/json");
  let data = {};
  try {
    if (wantsJson) data = await request.json();
    else data = Object.fromEntries(await request.formData());
  } catch {
    return reply(wantsJson, false, "We couldn't read the form. Please try again.", 400);
  }

  // Honeypot: real visitors never fill this hidden field. Pretend success so bots move on.
  if (String(data.company_website || "").trim()) return reply(wantsJson, true, "", 200);

  const f = {};
  for (const [k, max] of Object.entries(LIMITS)) f[k] = String(data[k] ?? "").trim().slice(0, max);

  if (!f.name || !f.phone || !f.email) return reply(wantsJson, false, "Add your name, phone number and email so we can reach you.", 422);
  if (!EMAIL_RE.test(f.email)) return reply(wantsJson, false, "Check the email address. It should look like name@example.com.", 422);

  const leadsTo = setting(env, "LEADS_TO_EMAIL");
  if (!leadsTo || !(env.EMAIL && typeof env.EMAIL.send === "function")) {
    console.error("Estimate form setup incomplete:", { CLOUDFLARE_EMAIL: Boolean(env.EMAIL), LEADS_TO_EMAIL: Boolean(leadsTo) });
    return reply(wantsJson, false, "The form isn't set up yet. Please call us instead.", 503);
  }

  const msg = {
    from: setting(env, "LEADS_FROM_EMAIL") || DEFAULT_FROM,
    to: leadsTo.split(",").map((s) => s.trim()).filter(Boolean),
    replyTo: f.email,
    subject: `New estimate request: ${f.service || "Floor coating"} – ${f.name}`,
    html: emailHtml(f),
    text: emailText(f),
  };

  try {
    await sendWithCloudflare(env, msg);
    console.log("Estimate request sent with Cloudflare Email");
    return reply(wantsJson, true, "", 200);
  } catch (err) {
    console.error("Cloudflare Email failed:", err && (err.code || ""), err && err.message);
    return reply(wantsJson, false, "We couldn't send your request. Please call us or try again.", 502);
  }
}

function reply(wantsJson, ok, error, status) {
  if (wantsJson) return json(ok ? { ok: true } : { ok: false, error }, status);
  // Plain form post (JavaScript off): send the visitor back to the form with the result.
  const target = ok ? "/?estimate=sent#estimate" : "/?estimate=error#estimate";
  return new Response(null, { status: 303, headers: { Location: target } });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function rows(f) {
  return [
    ["Name", f.name],
    ["Phone", f.phone],
    ["Email", f.email],
    ["Service", f.service || "Not given"],
    ["City", f.city || "Not given"],
    ["Sent from", f.page || "Website"],
  ];
}

function emailHtml(f) {
  const tr = rows(f)
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#53627d;white-space:nowrap">${k}</td><td style="padding:6px 0;color:#071a3d;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  const msg = f.message ? `<p style="margin:20px 0 6px;color:#53627d">About the floor</p><p style="margin:0;color:#071a3d;white-space:pre-wrap">${esc(f.message)}</p>` : "";
  const tel = f.phone.replace(/[^\d+]/g, "");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;max-width:560px">
<h2 style="margin:0 0 16px;color:#0a2a6b">New estimate request</h2>
<table style="border-collapse:collapse">${tr}</table>${msg}
<p style="margin:24px 0 0"><a href="tel:${esc(tel)}" style="background:#1f63e0;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Call ${esc(f.name)}</a></p>
</div>`;
}

function emailText(f) {
  const lines = rows(f).map(([k, v]) => `${k}: ${v}`);
  if (f.message) lines.push("", "About the floor:", f.message);
  return lines.join("\n");
}

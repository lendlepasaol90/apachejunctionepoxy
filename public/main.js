(() => {
  "use strict";
  const doc = document.documentElement;
  doc.classList.add("js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
   * Hero: live metallic-epoxy pour (WebGL fragment shader)
   * ------------------------------------------------------------------ */
  function startPour(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) return false;

    const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const frag = `
      precision highp float;
      uniform vec2 r; uniform float t; uniform vec2 m;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float v = 0., a = .5;
        mat2 rot = mat2(.8,-.6,.6,.8);
        for (int k = 0; k < 5; k++){ v += a * n(p); p = rot * p * 2.03; a *= .5; }
        return v;
      }
      float field(vec2 p){
        vec2 q = vec2(fbm(p + vec2(0., t*.05)), fbm(p + vec2(5.2, 1.3) - t*.04));
        vec2 w = vec2(fbm(p + 3.5*q + vec2(1.7, 9.2) + t*.03), fbm(p + 3.5*q + vec2(8.3, 2.8)));
        return fbm(p + 3.2*w);
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / r;
        vec2 p = uv * vec2(r.x / r.y, 1.) * 1.05 + m * .15;
        float e = 1.5 / r.y;
        float f  = field(p);
        float fx = field(p + vec2(e, 0.));
        float fy = field(p + vec2(0., e));
        vec3 nrm = normalize(vec3((f - fx) * 9., (f - fy) * 9., e * 6.));
        vec3 L = normalize(vec3(-.4 + m.x * .3, .6 + m.y * .2, .8));
        float diff = clamp(dot(nrm, L), 0., 1.);
        float spec = pow(clamp(dot(reflect(-L, nrm), vec3(0,0,1)), 0., 1.), 28.);
        vec3 deep  = vec3(.024, .078, .2);
        vec3 cob   = vec3(.04, .17, .45);
        vec3 blue  = vec3(.16, .44, .98);
        vec3 pearl = vec3(.86, .92, 1.);
        vec3 col = mix(deep, cob, smoothstep(.25, .55, f));
        col = mix(col, blue, smoothstep(.5, .78, f) * .85);
        col = mix(col, pearl, smoothstep(.72, .9, f) * .55);
        col *= .55 + .65 * diff;
        col += spec * .55 * vec3(.85, .92, 1.);
        col += .06 * smoothstep(.6, 1., uv.y);
        gl_FragColor = vec4(col, 1.);
      }`;

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    const vs = sh(gl.VERTEX_SHADER, vert), fs = sh(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t"), uM = gl.getUniformLocation(prog, "m");

    // Render below native resolution: the surface is soft, and this keeps phones cool.
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const hgt = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
    }

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener("pointermove", (e) => {
      mouse.tx = e.clientX / window.innerWidth - .5;
      mouse.ty = .5 - e.clientY / window.innerHeight;
    }, { passive: true });

    let visible = true, raf = 0;
    const start = performance.now() - 20000 * Math.random();
    function frame(now) {
      resize();
      mouse.x += (mouse.tx - mouse.x) * .04;
      mouse.y += (mouse.ty - mouse.y) * .04;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, (now - start) / 1000);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduceMotion && visible) raf = requestAnimationFrame(frame);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !reduceMotion) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
      }).observe(canvas);
    }
    window.addEventListener("resize", () => { if (reduceMotion) frame(performance.now()); });
    raf = requestAnimationFrame(frame);
    return true;
  }

  const pour = document.getElementById("pour");
  if (pour) startPour(pour);
  requestAnimationFrame(() => requestAnimationFrame(() => doc.classList.add("ready")));

  /* ------------------------------------------------------------------
   * Finish swatches, drawn procedurally for each service
   * ------------------------------------------------------------------ */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeNoise(seed) {
    const rand = rng(seed), perm = new Uint8Array(512), vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y); let xf = x - xi, yf = y - yi;
      xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    return (x, y, oct = 5) => { let s = 0, a = .5; for (let o = 0; o < oct; o++) { s += a * noise(x, y); x *= 2.03; y *= 2.03; a *= .5; } return s; };
  }
  const fbm = makeNoise(7);
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function pixelField(ctx, w, h, res, fn) {
    const lw = Math.max(1, Math.round(w / res)), lh = Math.max(1, Math.round(h / res));
    const off = document.createElement("canvas"); off.width = lw; off.height = lh;
    const octx = off.getContext("2d"), img = octx.createImageData(lw, lh), d = img.data;
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const c = fn(x / lh, y / lh), i = (y * lw + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, w, h);
  }
  function concreteBase(ctx, w, h, tone, spread) {
    pixelField(ctx, w, h, 2, (x, y) => {
      const g = fbm(x * 9, y * 9, 4) * spread + (Math.random() - .5) * 14;
      return [tone[0] + g, tone[1] + g, tone[2] + g];
    });
  }
  function gloss(ctx, w, h, strength = .35) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `rgba(255,255,255,${strength})`);
    g.addColorStop(.35, "rgba(255,255,255,0)");
    g.addColorStop(.62, "rgba(255,255,255,0)");
    g.addColorStop(.7, `rgba(255,255,255,${strength * .6})`);
    g.addColorStop(.78, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function flakes(ctx, w, h, count, size, palette, base, seed) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, s = size * (.5 + r()), a = r() * Math.PI * 2, sides = 4 + ((r() * 3) | 0);
      ctx.fillStyle = palette[(r() * palette.length) | 0];
      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        const ang = a + (k / sides) * Math.PI * 2, rad = s * (.55 + r() * .45);
        k ? ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad) : ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  const finishes = {
    flake(ctx, w, h, k) { flakes(ctx, w, h, (w * h) / (60 * k * k), 7 * k, ["#0a2a6b", "#1f63e0", "#eef4ff", "#ffffff", "#53627d", "#9fb3d4", "#cdd8ea"], "#b9c6dc", 11); gloss(ctx, w, h, .3); },
    "flake-dense"(ctx, w, h, k) { flakes(ctx, w, h, (w * h) / (26 * k * k), 6 * k, ["#071a3d", "#0a2a6b", "#1f63e0", "#6fa8ff", "#ffffff", "#ffffff"], "#0a2a6b", 23); gloss(ctx, w, h, .32); },
    "flake-fine"(ctx, w, h, k) { flakes(ctx, w, h, (w * h) / (14 * k * k), 3 * k, ["#6b7890", "#9aa6b8", "#d7dee9", "#ffffff", "#2f3b52", "#1f63e0"], "#8d99ad", 37); gloss(ctx, w, h, .28); },
    metallic(ctx, w, h) {
      pixelField(ctx, w, h, 3, (x, y) => {
        const qx = fbm(x * 1.6, y * 1.6), qy = fbm(x * 1.6 + 5.2, y * 1.6 + 1.3);
        const f = fbm(x * 1.6 + 3.4 * qx, y * 1.6 + 3.4 * qy);
        const c1 = [6, 20, 52], c2 = [10, 43, 115], c3 = [41, 112, 250], c4 = [220, 235, 255];
        let c = c1.map((v, i) => mix(v, c2[i], sstep(.3, .52, f)));
        c = c.map((v, i) => mix(v, c3[i], sstep(.5, .72, f) * .9));
        c = c.map((v, i) => mix(v, c4[i], sstep(.68, .82, f) * .7));
        return c;
      });
      gloss(ctx, w, h, .22);
    },
    clear(ctx, w, h) { concreteBase(ctx, w, h, [150, 152, 156], 60); gloss(ctx, w, h, .5); },
    "solid-light"(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#dfe7f4"); g.addColorStop(1, "#c4d1e6");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); gloss(ctx, w, h, .55);
    },
    solid(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#5d6f8f"); g.addColorStop(1, "#43546f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); gloss(ctx, w, h, .4);
    },
    patio(ctx, w, h) {
      pixelField(ctx, w, h, 1.5, (x, y) => {
        const s = fbm(x * 30, y * 30, 3), m = fbm(x * 3, y * 3, 3);
        const v = 205 + (s - .5) * 60 + (m - .5) * 30;
        return [v - 4, v + 2, v + 10];
      });
    },
    warehouse(ctx, w, h, k) {
      finishes.solid(ctx, w, h);
      ctx.fillStyle = "#f2c230";
      const lw = 14 * k, y1 = h * .38, y2 = h * .74;
      ctx.fillRect(0, y1, w, lw); ctx.fillRect(0, y2, w, lw);
      ctx.save(); ctx.beginPath(); ctx.rect(w * .62, y1 + lw, w * .3, y2 - y1 - lw); ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 6 * k;
      for (let x = w * .5; x < w; x += 28 * k) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x + (y2 - y1), y2 + lw); ctx.stroke(); }
      ctx.restore();
      gloss(ctx, w, h, .25);
    },
    concrete(ctx, w, h, k) {
      concreteBase(ctx, w, h, [168, 168, 166], 70);
      const r = rng(5);
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1 * k;
      for (let i = 0; i < 60; i++) { // grinder swirl marks
        const cx = r() * w, cy = r() * h, rad = (40 + r() * 120) * k, a = r() * 6.28;
        ctx.beginPath(); ctx.arc(cx, cy, rad, a, a + 1 + r() * 1.5); ctx.stroke();
      }
      ctx.strokeStyle = "#3c4a63"; ctx.lineWidth = 3 * k; ctx.lineCap = "round";
      ctx.beginPath(); let x = w * .1, y = h * .2; ctx.moveTo(x, y);
      while (x < w * .9) { x += (20 + r() * 40) * k; y += (r() - .4) * 30 * k; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  };

  const swA = document.getElementById("swatch-a"), swB = document.getElementById("swatch-b");
  let front = swA, back = swB, current = null;

  function paint(canvas, name) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    (finishes[name] || finishes.solid)(ctx, w, h, w / 900);
  }

  function showFinish(name, instant) {
    if (!swA || name === current) return;
    current = name;
    const next = back;
    next.style.transition = "none";
    next.style.clipPath = instant || reduceMotion ? "inset(0 0 0 0)" : "inset(0 100% 0 0)";
    next.className = "over"; front.className = "under";
    paint(next, name);
    next.getBoundingClientRect(); // commit start state
    next.style.transition = "";
    next.style.clipPath = "inset(0 0 0 0)"; // squeegee pull, left to right
    back = front; front = next;
  }

  /* Tabs */
  const tabs = Array.from(document.querySelectorAll('.svc-list [role="tab"]'));
  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    showFinish(tab.dataset.finish);
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (e.key in keys) { e.preventDefault(); select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true); }
      else if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
      else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
  if (tabs.length) {
    // paint the first swatch once it's near the viewport, so the hero gets the CPU first
    const first = () => showFinish(tabs.find((t) => t.getAttribute("aria-selected") === "true").dataset.finish, true);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { first(); io.disconnect(); } }, { rootMargin: "400px" });
      io.observe(swA);
    } else first();
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (current) { paint(front, current); } }, 200);
    });
  }


  /* ------------------------------------------------------------------
   * Service pages: hero finish pulled across on load, related thumbnails,
   * and "On this page" highlighting
   * ------------------------------------------------------------------ */
  const pageHero = document.querySelector("canvas[data-hero]");
  if (pageHero) {
    const fin = pageHero.dataset.finish;
    if (fin === "metallic") { if (!startPour(pageHero)) paint(pageHero, fin); }
    else paint(pageHero, fin);
    requestAnimationFrame(() => requestAnimationFrame(() => pageHero.classList.add("in")));
    if (fin !== "metallic") {
      let ht;
      window.addEventListener("resize", () => { clearTimeout(ht); ht = setTimeout(() => paint(pageHero, fin), 200); });
    }
  }

  const thumbs = Array.from(document.querySelectorAll("canvas[data-finish]:not([data-hero])"));
  if (thumbs.length) {
    const draw = (c) => { if (!c.dataset.painted) { paint(c, c.dataset.finish); c.dataset.painted = "1"; } };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { draw(en.target); io.unobserve(en.target); } }), { rootMargin: "300px" });
      thumbs.forEach((c) => io.observe(c));
    } else thumbs.forEach(draw);
  }

  const tocLinks = Array.from(document.querySelectorAll(".toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    const targets = tocLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const seen = new Set();
    const spy = new IntersectionObserver((ents) => {
      ents.forEach((en) => { en.isIntersecting ? seen.add(en.target.id) : seen.delete(en.target.id); });
      const firstVisible = targets.find((t) => seen.has(t.id));
      if (firstVisible) tocLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + firstVisible.id));
    }, { rootMargin: "-90px 0px -55% 0px" });
    targets.forEach((t) => spy.observe(t));
  }

  /* ------------------------------------------------------------------
   * Header, mobile menu, call bar
   * ------------------------------------------------------------------ */
  const header = document.querySelector(".site-header");
  const callBar = document.querySelector(".call-bar");
  const hero = document.querySelector(".hero, .page-hero");
  function onScroll() {
    const past = window.scrollY > (hero ? hero.offsetHeight - 80 : 40);
    header.classList.toggle("scrolled", past);
    if (callBar) callBar.classList.toggle("show", window.scrollY > window.innerHeight * .6);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.querySelector(".nav-toggle"), list = document.getElementById("nav-list");
  if (toggle && list) {
    const set = (open) => {
      list.classList.toggle("open", open);
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    };
    toggle.addEventListener("click", () => set(!list.classList.contains("open")));
    list.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  }


  /* Services dropdown: click/tap or keyboard; hover handled in CSS on desktop */
  document.querySelectorAll(".has-sub").forEach((item) => {
    const btn = item.querySelector(".sub-toggle");
    const setSub = (open) => { item.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); setSub(!item.classList.contains("open")); });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && item.classList.contains("open")) { e.stopPropagation(); setSub(false); btn.focus(); }
    });
    item.addEventListener("focusout", (e) => {
      if (window.matchMedia("(min-width: 761px)").matches && !item.contains(e.relatedTarget)) setSub(false);
    });
    document.addEventListener("click", (e) => {
      if (!item.contains(e.target) && window.matchMedia("(min-width: 761px)").matches) setSub(false);
    });
  });

  /* ------------------------------------------------------------------
   * Estimate form. No backend yet: it opens the visitor's email app
   * with the details filled in. Swap for a real endpoint later.
   * ------------------------------------------------------------------ */
  const form = document.getElementById("estimate-form");
  const status = document.getElementById("form-status");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.elements.name, phone = form.elements.phone;
      let bad = null;
      [name, phone].forEach((f) => {
        const empty = !f.value.trim();
        f.setAttribute("aria-invalid", String(empty));
        if (empty && !bad) bad = f;
      });
      if (bad) {
        status.className = "form-status error";
        status.textContent = "Add your name and phone number so we can reach you.";
        bad.focus();
        return;
      }
      const v = (n) => (form.elements[n].value || "").trim();
      const body = `Name: ${v("name")}\nPhone: ${v("phone")}\nEmail: ${v("email")}\nService: ${v("service")}\nCity: ${v("city")}\n\n${v("message")}`;
      window.location.href = `mailto:hello@apachejunctionepoxy.com?subject=${encodeURIComponent("Estimate request: " + v("service"))}&body=${encodeURIComponent(body)}`;
      status.className = "form-status";
      status.textContent = "Your email app should open with your request filled in. Send it and we'll be in touch within one business day.";
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();

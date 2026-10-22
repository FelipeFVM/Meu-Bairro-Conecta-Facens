/* Meu Bairro Conecta — Campus Facens (protótipo MVP)
 * Mapa interativo + cadastro de ocorrências/sugestões + confirmação social (curtida)
 * + painel de status + rota/alertas. Dados salvos no navegador (localStorage).
 */
(() => {
  "use strict";

  const DIA = 86400000;
  const DIAS_PARA_RECONFIRMAR = 30;
  const RAIO_ROTA_M = 40;
  const RAIO_ALERTA_M = 150;
  const RAIO_DUPLICADA_M = 30;
  const STORE = "mbc-facens-v2";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------------- estado
  const defaults = () => ({
    ocorrencias: seed(),
    me: { x: 59.1, y: 85.4 },
    confirmadas: [],
    rota: null,
    alertas: [],
    onboardingVisto: false,
    gpsLigado: false,
    calibracao: [],
    proximoId: 100,
  });

  function seed() {
    const agora = Date.now();
    return SEED.map((o, i) => {
      const criadoEm = agora - o.diasAtras * DIA;
      const ultimaConfirmacao = agora - o.confirmadoHa * DIA;
      const historico = [{ data: criadoEm, texto: "Registrada pela comunidade" }];
      if (o.status === "analise") historico.push({ data: criadoEm + DIA, texto: "Gestão do campus: em análise" });
      if (o.status === "resolvido") historico.push({ data: ultimaConfirmacao, texto: "Gestão do campus: resolvido" });
      return {
        id: "s" + (i + 1), tipo: o.tipo, cat: o.cat, titulo: o.titulo, desc: o.desc, x: o.x, y: o.y,
        status: o.status, criadoEm, ultimaConfirmacao, confirmacoes: o.confirmacoes,
        autor: "Comunidade Facens", foto: null, historico,
      };
    });
  }

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) return Object.assign(defaults(), JSON.parse(raw));
    } catch (_) { /* armazenamento indisponível: segue com dados padrão */ }
    return defaults();
  }
  function save() {
    const json = JSON.stringify(state);
    Plataforma.persistir(STORE, json);
    try { localStorage.setItem(STORE, json); }
    catch (_) { if (!Plataforma.nativo) toast("Não foi possível salvar no navegador (armazenamento cheio ou bloqueado)."); }
  }

  const ui = {
    tab: "mapa", tipo: "todos", cat: "", status: "ativos", raio: "", ordem: "confirmacoes",
    role: "comunidade", mode: null, selecionada: null, verLocais: true, verResolvidas: false, heat: false,
    form: { x: 0, y: 0, tipo: "problema", cat: "buraco", foto: null },
  };

  // ---------------------------------------------------------------- utilidades
  const toPx = (p) => ({ x: (p.x / 100) * MAPA.largura, y: (p.y / 100) * MAPA.altura });

  // Orientação do mapa: horizontal (desktop/tablet) ou vertical (celular em pé, imagem girada 90°).
  // Os dados ficam sempre em coordenadas do mapa horizontal; pos()/unpos() convertem para a tela.
  let orient = "land";
  const SW = () => (orient === "land" ? MAPA.largura : MAPA.altura);
  const SH = () => (orient === "land" ? MAPA.altura : MAPA.largura);
  const pos = (p) => (orient === "land" ? { l: p.x, t: p.y } : { l: 100 - p.y, t: p.x });
  const unpos = (l, t) => (orient === "land" ? { x: l, y: t } : { x: t, y: 100 - l });
  const css = (p) => { const q = pos(p); return `left:${q.l}%;top:${q.t}%`; };
  const stagePx = (p) => { const q = pos(p); return { x: (q.l / 100) * SW(), y: (q.t / 100) * SH() }; };
  function distM(a, b) {
    const pa = toPx(a), pb = toPx(b);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) * MAPA.metrosPorPixel;
  }
  function distSegM(p, a, b) {
    const P = toPx(p), A = toPx(a), B = toPx(b);
    const dx = B.x - A.x, dy = B.y - A.y;
    const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy)) * MAPA.metrosPorPixel;
  }
  const localPorId = (id) => LOCAIS.find((l) => l.id === id);
  function localMaisProximo(p) {
    let best = LOCAIS[0], bd = Infinity;
    for (const l of LOCAIS) { const d = distM(p, l); if (d < bd) { bd = d; best = l; } }
    return { local: best, dist: bd };
  }
  const descreverLocal = (p) => {
    const { local, dist } = localMaisProximo(p);
    return dist < 25 ? local.nome : `Próximo a: ${local.nome} (~${Math.round(dist)} m)`;
  };
  const ativa = (o) => o.status !== "resolvido";
  const precisaReconfirmar = (o) => ativa(o) && Date.now() - o.ultimaConfirmacao > DIAS_PARA_RECONFIRMAR * DIA;
  const confirmei = (o) => state.confirmadas.includes(o.id);
  const byId = (id) => state.ocorrencias.find((o) => o.id === id);

  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  function quando(ts) {
    const diff = ts - Date.now();
    const min = Math.round(diff / 60000);
    if (Math.abs(min) < 60) return rtf.format(min, "minute");
    const h = Math.round(min / 60);
    if (Math.abs(h) < 24) return rtf.format(h, "hour");
    return rtf.format(Math.round(h / 24), "day");
  }
  const dataCurta = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // ---------------------------------------------------------------- filtros
  function filtradas() {
    let list = state.ocorrencias.filter((o) => {
      if (ui.tipo !== "todos" && o.tipo !== ui.tipo) return false;
      if (ui.cat && o.cat !== ui.cat) return false;
      if (ui.status === "ativos" && !ativa(o)) return false;
      if (ui.status && ui.status !== "ativos" && o.status !== ui.status) return false;
      if (ui.raio && distM(o, state.me) > Number(ui.raio)) return false;
      return true;
    });
    const ord = {
      confirmacoes: (a, b) => b.confirmacoes - a.confirmacoes,
      recentes: (a, b) => b.criadoEm - a.criadoEm,
      distancia: (a, b) => distM(a, state.me) - distM(b, state.me),
    }[ui.ordem];
    return list.sort(ord);
  }
  // No mapa, resolvidas só aparecem com a camada "Resolvidas" ligada.
  const visiveisNoMapa = () => filtradas().concat(
    ui.verResolvidas && ui.status === "ativos" ? state.ocorrencias.filter((o) => !ativa(o) && passaFiltroBasico(o)) : []
  );
  const passaFiltroBasico = (o) =>
    (ui.tipo === "todos" || o.tipo === ui.tipo) && (!ui.cat || o.cat === ui.cat) && (!ui.raio || distM(o, state.me) <= Number(ui.raio));

  // ---------------------------------------------------------------- mapa: zoom/pan
  const viewport = $("#viewport"), stage = $("#stage");
  const view = { s: 1, tx: 0, ty: 0, min: 0.2, max: 3 };

  function limites() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    return { vw, vh, contain: Math.min(vw / SW(), vh / SH()), cover: Math.max(vw / SW(), vh / SH()) };
  }
  function clamp() {
    const { vw, vh } = limites();
    const w = SW() * view.s, h = SH() * view.s;
    view.tx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, view.tx));
    view.ty = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, view.ty));
  }
  function aplicar() {
    clamp();
    stage.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
    stage.style.setProperty("--inv", (1 / view.s).toFixed(4));
    viewport.classList.toggle("far", view.s < 0.6);
    $("#layer-locais").style.display = ui.verLocais && view.s >= 0.3 ? "" : "none";
  }
  function enquadrar(initial = false) {
    const { vw, contain, cover } = limites();
    if (!vw) return;
    view.min = contain;
    view.s = initial ? Math.min(cover, contain * 3) : contain;
    if (initial) centrar(orient === "land" ? { x: 55, y: 62 } : { x: 60, y: 60 }, false);
    else { view.tx = 0; view.ty = 0; }
    aplicar();
  }
  function zoomEm(fator, cx, cy) {
    const ns = Math.max(view.min, Math.min(view.max, view.s * fator));
    const k = ns / view.s;
    view.tx = cx - (cx - view.tx) * k;
    view.ty = cy - (cy - view.ty) * k;
    view.s = ns;
    aplicar();
  }
  function centrar(p, zoomIn = true) {
    const { vw, vh } = limites();
    if (zoomIn && view.s < 0.9) view.s = Math.min(view.max, Math.max(view.min, 0.9));
    const px = stagePx(p);
    view.tx = vw / 2 - px.x * view.s;
    view.ty = vh / 2 - px.y * view.s;
    aplicar();
  }
  function pontoDoEvento(e) {
    const r = stage.getBoundingClientRect();
    const l = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const t = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    return unpos(l, t);
  }

  const ptrs = new Map();
  let gesto = null;
  viewport.addEventListener("pointerdown", (e) => {
    viewport.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      gesto = { tipo: "pan", sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moveu: false, alvo: e.target, ev: e };
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      gesto = { tipo: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), moveu: true };
    }
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId) || !gesto) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesto.tipo === "pan") {
      const dx = e.clientX - gesto.sx, dy = e.clientY - gesto.sy;
      if (!gesto.moveu && Math.hypot(dx, dy) > 6) { gesto.moveu = true; viewport.classList.add("dragging"); }
      if (gesto.moveu) { view.tx = gesto.tx + dx; view.ty = gesto.ty + dy; aplicar(); }
    } else if (gesto.tipo === "pinch" && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = viewport.getBoundingClientRect();
      zoomEm(d / gesto.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      gesto.d = d;
    }
  });
  const fimPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    viewport.classList.remove("dragging");
    if (gesto && gesto.tipo === "pan" && !gesto.moveu && e.type === "pointerup") toqueNoMapa(gesto.alvo, gesto.ev);
    if (ptrs.size === 1 && gesto && gesto.tipo === "pinch") {
      const [p] = [...ptrs.values()];
      gesto = { tipo: "pan", sx: p.x, sy: p.y, tx: view.tx, ty: view.ty, moveu: true };
    } else if (ptrs.size === 0) gesto = null;
  };
  viewport.addEventListener("pointerup", fimPtr);
  viewport.addEventListener("pointercancel", fimPtr);
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  function toqueNoMapa(alvo, ev) {
    const pin = alvo.closest && alvo.closest(".pin");
    if (ui.mode === "add") { abrirForm(pontoDoEvento(ev)); sairModo(); return; }
    if (ui.mode === "calibrar") { adicionarCalibracao(pontoDoEvento(ev)); sairModo(); return; }
    if (ui.mode === "me") {
      state.me = pontoDoEvento(ev); save(); sairModo();
      toast("Localização definida: " + descreverLocal(state.me));
      renderTudo(); return;
    }
    if (pin) abrirDetalhe(pin.dataset.id);
  }

  $("#z-in").onclick = () => { const { vw, vh } = limites(); zoomEm(1.3, vw / 2, vh / 2); };
  $("#z-out").onclick = () => { const { vw, vh } = limites(); zoomEm(1 / 1.3, vw / 2, vh / 2); };
  $("#z-fit").onclick = () => enquadrar();
  function definirOrientacao(o) {
    orient = o;
    stage.style.width = SW() + "px";
    stage.style.height = SH() + "px";
    $("#map-img").src = o === "land" ? "assets/mapa-facens.webp" : "assets/mapa-facens-vertical.jpg";
    renderLocais(); renderPins(); renderRota();
    if (ui.heat) desenharCalor();
  }
  // ponto do mapa (coordenadas de dados) que está no centro da tela
  function pontoCentral() {
    const { vw, vh } = limites();
    const l = ((vw / 2 - view.tx) / view.s / SW()) * 100, t = ((vh / 2 - view.ty) / view.s / SH()) * 100;
    return unpos(l, t);
  }
  // Reenquadra quando o mapa muda de tamanho (rotação, painel aberto, aba que estava oculta).
  let enquadrado = false;
  new ResizeObserver(() => {
    const { vw, vh } = limites();
    if (!vw) return;
    const novo = vh > vw * 1.15 ? "port" : "land";
    if (novo !== orient || !enquadrado) {
      const centro = enquadrado ? pontoCentral() : null;
      definirOrientacao(novo);
      enquadrado = true;
      enquadrar(true);
      if (centro) centrar(centro, false);
      return;
    }
    const { contain } = limites();
    view.min = contain;
    view.s = Math.max(view.s, contain);
    aplicar();
  }).observe(viewport);

  // ---------------------------------------------------------------- modos
  function entrarModo(mode, texto) {
    ui.mode = mode;
    $("#btn-aqui-gps").hidden = !(mode === "add" && gps.ativo && gps.dentro);
    $("#mode-text").textContent = texto;
    $("#mode-banner").hidden = false;
    viewport.classList.add("picking");
    setTab("mapa");
  }
  function sairModo() {
    ui.mode = null;
    $("#mode-banner").hidden = true;
    viewport.classList.remove("picking");
  }
  $("#btn-cancel-mode").onclick = sairModo;
  $("#fab-add").onclick = () => entrarModo("add", "Toque no mapa onde está o problema ou a sugestão");
  $("#btn-def-local").onclick = () => entrarModo("me", "Toque no mapa onde você está");

  // ---------------------------------------------------------------- render: mapa
  function renderLocais() {
    $("#layer-locais").innerHTML = LOCAIS.map((l) =>
      `<div class="local-label ${l.tipo}" style="${css(l)}">${esc(l.nome)}</div>`).join("");
  }
  function renderPins() {
    const list = visiveisNoMapa().slice().sort((a, b) => a.y - b.y);
    let html = list.map((o) => {
      const c = CATEGORIAS[o.cat];
      const cls = ["pin", o.tipo === "sugestao" ? "sug" : "", o.status === "resolvido" ? "resolvido" : "",
        precisaReconfirmar(o) ? "stale" : "", ui.selecionada === o.id ? "selected" : "", o._nova ? "nova" : ""].join(" ");
      return `<button class="${cls}" data-id="${o.id}" style="${css(o)}" aria-label="${esc(o.titulo)}">
        <div class="head" style="background:${c.cor}"><span>${c.icone}</span></div>
        ${o.confirmacoes ? `<span class="count">${o.confirmacoes}</span>` : ""}
      </button>`;
    }).join("");
    if (ui.raio) {
      const d = (2 * Number(ui.raio)) / MAPA.metrosPorPixel;
      html = `<div class="radius-ring" style="${css(state.me)};width:${d}px;height:${d}px"></div>` + html;
    }
    $("#layer-pins").innerHTML = html;
    renderMe();
    if (ui.heat) desenharCalor();
  }
  function renderRota() {
    const svg = $("#route-layer");
    if (!state.rota) { svg.innerHTML = ""; return; }
    const a = pos(localPorId(state.rota.origem)), b = pos(localPorId(state.rota.destino));
    svg.innerHTML = `
      <line x1="${a.l}" y1="${a.t}" x2="${b.l}" y2="${b.t}" stroke="#fff" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85"/>
      <line x1="${a.l}" y1="${a.t}" x2="${b.l}" y2="${b.t}" stroke="#2563eb" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  function desenharCalor() {
    const cv = $("#heat"), ctx = cv.getContext("2d");
    cv.width = SW() / 2; cv.height = SH() / 2;
    for (const o of state.ocorrencias) {
      if (!ativa(o)) continue;
      const q = pos(o), x = (q.l / 100) * cv.width, y = (q.t / 100) * cv.height;
      const r = 30 + Math.log2(o.confirmacoes + 1) * 10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(220,38,38,0.85)");
      g.addColorStop(0.5, "rgba(245,158,11,0.45)");
      g.addColorStop(1, "rgba(245,158,11,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- render: lista
  function pillStatus(o) {
    const s = STATUS[o.status];
    return `<span class="pill status" style="background:${s.cor}">${s.nome}</span>`;
  }
  function pillTipo(o) {
    return o.tipo === "sugestao" ? `<span class="pill tipo sug">💡 Sugestão</span>` : `<span class="pill tipo">⚠️ Problema</span>`;
  }
  function renderLista() {
    const list = filtradas();
    const ativas = state.ocorrencias.filter(ativa).length;
    $("#resumo-lista").textContent = `${list.length} exibida(s) · ${ativas} ativa(s) no campus`;
    $("#lista").innerHTML = list.length ? list.map((o) => {
      const c = CATEGORIAS[o.cat];
      return `<li class="card ${ui.selecionada === o.id ? "selected" : ""}" tabindex="0" data-id="${o.id}">
        <div class="cat-dot" style="background:${c.cor}">${c.icone}</div>
        <div>
          <h4>${esc(o.titulo)}</h4>
          <div class="meta">${pillTipo(o)} ${pillStatus(o)} ${precisaReconfirmar(o) ? `<span class="pill stale">Precisa reconfirmar</span>` : ""}</div>
          <div class="meta" style="margin-top:4px">${esc(descreverLocal(o))} · ${Math.round(distM(o, state.me))} m de você · ${quando(o.criadoEm)}</div>
        </div>
        <div class="likes"><b>${o.confirmacoes}</b>${o.tipo === "sugestao" ? "apoios" : "confirm."}</div>
      </li>`;
    }).join("") : `<li class="empty">Nada encontrado com esses filtros.<br/>Que tal registrar algo novo?</li>`;
  }
  $("#lista").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) selecionarNoMapa(card.dataset.id);
  });
  $("#lista").addEventListener("keydown", (e) => {
    const card = e.target.closest(".card");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selecionarNoMapa(card.dataset.id); }
  });
  function selecionarNoMapa(id) {
    const o = byId(id);
    if (!o) return;
    if (window.innerWidth < 900) setTab("mapa");
    centrar(o);
    abrirDetalhe(id);
  }

  // ---------------------------------------------------------------- render: painel
  function renderPainel() {
    const all = state.ocorrencias;
    const ativas = all.filter(ativa);
    const res = all.filter((o) => o.status === "resolvido");
    const stale = all.filter(precisaReconfirmar);
    const sug = all.filter((o) => o.tipo === "sugestao" && ativa(o));
    const totalConf = all.reduce((s, o) => s + o.confirmacoes, 0);
    $("#kpis").innerHTML = [
      [ativas.length, "ocorrências ativas"],
      [res.length, "resolvidas"],
      [sug.length, "sugestões de melhoria abertas"],
      [totalConf, "confirmações da comunidade"],
      [stale.length, "precisam de reconfirmação"],
      [all.length ? Math.round((res.length / all.length) * 100) + "%" : "0%", "taxa de resolução"],
    ].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");

    const tot = all.length || 1;
    $("#bar-status").innerHTML = Object.entries(STATUS).map(([k, s]) => {
      const n = all.filter((o) => o.status === k).length;
      return `<div style="width:${(n / tot) * 100}%;background:${s.cor}" title="${s.nome}: ${n}"></div>`;
    }).join("");
    $("#legend-status").innerHTML = Object.entries(STATUS).map(([k, s]) =>
      `<span><i style="background:${s.cor}"></i>${s.nome}: ${all.filter((o) => o.status === k).length}</span>`).join("");

    const porCat = Object.entries(CATEGORIAS).map(([k, c]) => [k, c, ativas.filter((o) => o.cat === k).length])
      .filter(([, , n]) => n > 0).sort((a, b) => b[2] - a[2]);
    const max = Math.max(1, ...porCat.map((x) => x[2]));
    $("#bars-cat").innerHTML = porCat.map(([, c, n]) => `<div class="bar-row"><span>${c.icone} ${c.nome}</span>
      <div class="track"><div class="fill" style="width:${(n / max) * 100}%;background:${c.cor}"></div></div><b>${n}</b></div>`).join("")
      || `<p class="muted small">Nenhuma ocorrência ativa.</p>`;

    const porLocal = {};
    for (const o of ativas) {
      const { local } = localMaisProximo(o);
      porLocal[local.nome] = porLocal[local.nome] || { n: 0, conf: 0 };
      porLocal[local.nome].n++; porLocal[local.nome].conf += o.confirmacoes;
    }
    $("#rank-locais").innerHTML = Object.entries(porLocal).sort((a, b) => b[1].conf - a[1].conf).slice(0, 5)
      .map(([nome, v]) => `<li><b>${esc(nome)}</b> — ${v.n} registro(s), ${v.conf} confirmações</li>`).join("");
    $("#btn-heat").classList.toggle("active", ui.heat);
  }

  // ---------------------------------------------------------------- render: rota
  function renderRotaPainel() {
    const opts = LOCAIS.map((l) => `<option value="${l.id}">${esc(l.nome)}</option>`).join("");
    const o = $("#r-origem"), d = $("#r-destino");
    if (!o.options.length) { o.innerHTML = opts; d.innerHTML = opts; o.value = "portaria1"; d.value = "predio-e"; }
    if (state.rota) { o.value = state.rota.origem; d.value = state.rota.destino; }
    const info = $("#rota-info");
    if (!state.rota) { info.innerHTML = `<p class="muted small">Nenhuma rota salva.</p>`; return; }
    const noCaminho = ocorrenciasNaRota();
    const a = localPorId(state.rota.origem), b = localPorId(state.rota.destino);
    info.innerHTML = `<p class="small"><b>${esc(a.nome)} → ${esc(b.nome)}</b> · ~${Math.round(distM(a, b))} m (trajeto aproximado em linha reta)</p>
      ${noCaminho.length ? `<ul class="cards">${noCaminho.map((x) => `<li class="card" data-id="${x.id}" tabindex="0">
        <div class="cat-dot" style="background:${CATEGORIAS[x.cat].cor}">${CATEGORIAS[x.cat].icone}</div>
        <div><h4>${esc(x.titulo)}</h4><div class="meta">${pillStatus(x)}</div></div>
        <div class="likes"><b>${x.confirmacoes}</b>confirm.</div></li>`).join("")}</ul>`
        : `<p class="small">✅ Nenhum problema ativo no seu caminho agora.</p>`}`;
  }
  const ocorrenciasNaRota = () => {
    if (!state.rota) return [];
    const a = localPorId(state.rota.origem), b = localPorId(state.rota.destino);
    return state.ocorrencias.filter((o) => ativa(o) && o.tipo === "problema" && distSegM(o, a, b) <= RAIO_ROTA_M);
  };
  $("#rota-info").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) selecionarNoMapa(c.dataset.id); });
  $("#btn-salvar-rota").onclick = () => {
    const origem = $("#r-origem").value, destino = $("#r-destino").value;
    if (origem === destino) { toast("Escolha origem e destino diferentes."); return; }
    state.rota = { origem, destino };
    const n = ocorrenciasNaRota().length;
    alertar(n ? `Sua rota tem ${n} ocorrência(s) ativa(s) no caminho.` : "Rota salva: nenhum problema ativo no caminho.", null);
    save(); renderTudo(); toast("Rota salva. Você será avisado de novidades no caminho.");
  };
  $("#btn-limpar-rota").onclick = () => { state.rota = null; save(); renderTudo(); };

  // ---------------------------------------------------------------- alertas
  function alertar(texto, id) {
    state.alertas.unshift({ texto, id, data: Date.now(), lido: false });
    state.alertas = state.alertas.slice(0, 40);
    save(); renderAlertas();
  }
  function renderAlertas() {
    const n = state.alertas.filter((a) => !a.lido).length;
    for (const el of [$("#badge-alertas"), $("#badge-nav")]) {
      if (!el) continue;
      el.textContent = n; el.hidden = n === 0;
    }
    $("#alertas").innerHTML = state.alertas.length ? state.alertas.map((a, i) =>
      `<li class="${a.lido ? "" : "unread"}" data-i="${i}">${esc(a.texto)}<time>${quando(a.data)}</time></li>`).join("")
      : `<li class="empty">Sem alertas por enquanto. Salve uma rota para ser avisado de problemas no caminho.</li>`;
  }
  $("#alertas").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    const a = state.alertas[li.dataset.i];
    if (a && a.id && byId(a.id)) selecionarNoMapa(a.id);
  });
  function marcarAlertasLidos() {
    if (state.alertas.some((a) => !a.lido)) { state.alertas.forEach((a) => (a.lido = true)); save(); setTimeout(renderAlertas, 1500); }
  }
  function avaliarNovidade(o) {
    if (o.autor === "Você") return;
    const dMe = distM(o, state.me);
    const naRota = state.rota && o.tipo === "problema" &&
      distSegM(o, localPorId(state.rota.origem), localPorId(state.rota.destino)) <= RAIO_ROTA_M;
    if (naRota) alertar(`⚠️ Nova ocorrência na sua rota: ${o.titulo}`, o.id);
    else if (dMe <= RAIO_ALERTA_M) alertar(`📍 Nova ocorrência a ${Math.round(dMe)} m de você: ${o.titulo}`, o.id);
    else return;
    toast("Novo alerta: " + o.titulo);
    Plataforma.vibrar("alerta");
    Plataforma.notificar(naRota ? "Nova ocorrência na sua rota" : "Nova ocorrência perto de você", o.titulo);
  }

  // ---------------------------------------------------------------- detalhe
  const sheet = $("#sheet");
  function abrirDetalhe(id) {
    const o = byId(id);
    if (!o) return;
    ui.selecionada = id;
    const c = CATEGORIAS[o.cat];
    const sug = o.tipo === "sugestao";
    const fiz = confirmei(o);
    const stale = precisaReconfirmar(o);
    $("#detalhe").innerHTML = `
      <div class="detail-head">
        <div class="cat-dot" style="background:${c.cor}">${c.icone}</div>
        <div><h2 id="d-titulo">${esc(o.titulo)}</h2>
          <div class="meta">${pillTipo(o)} ${pillStatus(o)} <span>${c.nome}</span></div></div>
      </div>
      <p class="muted small">📍 ${esc(descreverLocal(o))} · ${Math.round(distM(o, state.me))} m de você</p>
      ${o.foto ? `<img class="detail-photo" src="${o.foto}" alt="Foto enviada" />` : ""}
      <p>${esc(o.desc) || "<span class='muted'>Sem descrição.</span>"}</p>
      <p class="muted small">Registrado por ${esc(o.autor)} · ${dataCurta(o.criadoEm)} · última confirmação ${quando(o.ultimaConfirmacao)}</p>
      ${stale ? `<div class="dup">⏳ Ninguém confirma esta ocorrência há mais de ${DIAS_PARA_RECONFIRMAR} dias. Se ela ainda existe, confirme abaixo; caso contrário, ela pode ser arquivada pela gestão.</div>` : ""}
      <div class="confirm-box">
        ${o.status === "resolvido"
          ? `<p>A gestão marcou como resolvido. Se o problema voltou, avise a comunidade.</p>
             <button class="confirm-btn" data-act="reabrir">🔁 O problema voltou</button>`
          : `<p>${sug
              ? "<b>Apoiar</b> mostra à gestão do campus que mais pessoas querem esta melhoria. Sugestões mais apoiadas sobem no ranking."
              : "<b>Confirmar</b> significa: “eu também vi, e o problema <u>ainda está</u> aí”. Isso aumenta a confiabilidade do registro e mantém o mapa atualizado."}</p>
             <button class="confirm-btn ${fiz ? "done" : ""}" data-act="confirmar">
               ${fiz ? "✓ Você " + (sug ? "apoiou" : "confirmou") + " · " + o.confirmacoes : (sug ? "👍 Apoiar sugestão" : "👍 Confirmar que ainda existe") + " · " + o.confirmacoes}
             </button>`}
      </div>
      <div class="btn-row"><button class="btn" data-act="compartilhar">↗ Compartilhar</button></div>
      <h3 class="sub">Histórico</h3>
      <ul class="timeline">${o.historico.slice().reverse().map((h) => `<li>${esc(h.texto)}<time>${dataCurta(h.data)}</time></li>`).join("")}</ul>
      ${ui.role === "gestao" ? `<div class="status-ctrl">
        <b>Gestão do campus</b>
        <label class="field">Alterar status
          <select id="d-status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${s.nome}</option>`).join("")}</select>
        </label>
        <label class="field">Resposta à comunidade (opcional)
          <input id="d-nota" maxlength="140" placeholder="Ex.: Equipe de manutenção agendada para sexta" />
        </label>
        <div class="btn-row end"><button class="btn primary" data-act="status">Atualizar</button></div>
      </div>` : ""}`;
    sheet.hidden = false;
    renderPins(); renderLista();
  }
  function fecharSheets() {
    sheet.hidden = true; $("#form-sheet").hidden = true;
    if (ui.selecionada) { ui.selecionada = null; renderPins(); renderLista(); }
  }
  for (const s of [sheet, $("#form-sheet")]) {
    s.addEventListener("click", (e) => { if (e.target === s || e.target.closest("[data-close]")) fecharSheets(); });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharSheets(); sairModo(); } });

  $("#detalhe").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const o = byId(ui.selecionada);
    if (!act || !o) return;
    if (act === "compartilhar") {
      const c = CATEGORIAS[o.cat];
      Plataforma.compartilhar(o.titulo, `${c.icone} ${c.nome} · ${STATUS[o.status].nome}\n📍 ${descreverLocal(o)} — campus Facens\n${o.desc}\n${o.confirmacoes} confirmações no Meu Bairro Conecta`)
        .then((r) => { if (r === "copiado") toast("Texto copiado para compartilhar."); });
      return;
    }
    if (act === "confirmar") {
      if (confirmei(o)) {
        state.confirmadas = state.confirmadas.filter((x) => x !== o.id);
        o.confirmacoes = Math.max(0, o.confirmacoes - 1);
      } else {
        state.confirmadas.push(o.id);
        o.confirmacoes++;
        o.ultimaConfirmacao = Date.now();
        Plataforma.vibrar("sucesso");
        toast(o.tipo === "sugestao" ? "Obrigado pelo apoio!" : "Confirmação registrada. Obrigado!");
      }
    } else if (act === "reabrir") {
      o.status = "pendente"; o.ultimaConfirmacao = Date.now(); o.confirmacoes++;
      if (!confirmei(o)) state.confirmadas.push(o.id);
      o.historico.push({ data: Date.now(), texto: "Reaberta pela comunidade: o problema voltou" });
      toast("Ocorrência reaberta.");
    } else if (act === "status") {
      const novo = $("#d-status").value, nota = $("#d-nota").value.trim();
      if (novo === o.status && !nota) return;
      o.status = novo;
      o.historico.push({ data: Date.now(), texto: `Gestão do campus: ${STATUS[novo].nome.toLowerCase()}${nota ? " — " + nota : ""}` });
      if (confirmei(o) || o.autor === "Você") alertar(`🔔 Atualização em “${o.titulo}”: ${STATUS[novo].nome}${nota ? " — " + nota : ""}`, o.id);
      toast("Status atualizado e comunidade notificada.");
    }
    save(); renderTudo(); abrirDetalhe(o.id);
  });

  // ---------------------------------------------------------------- formulário
  function montarCategorias() {
    $("#f-cats").innerHTML = `<legend>Categoria</legend>` + Object.entries(CATEGORIAS).map(([k, c]) =>
      `<button type="button" class="cat-opt ${k === ui.form.cat ? "active" : ""}" data-cat="${k}"><span>${c.icone}</span>${c.nome}</button>`).join("");
    $("#f-cat").innerHTML = `<option value="">Todas as categorias</option>` +
      Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}">${c.icone} ${c.nome}</option>`).join("");
  }
  function abrirForm(p) {
    Object.assign(ui.form, { x: p.x, y: p.y, foto: null });
    $("#form").reset();
    $("#f-preview").hidden = true;
    $("#f-local").textContent = "📍 " + descreverLocal(p);
    setFormTipo(ui.form.tipo);
    montarCategorias();
    checarDuplicadas();
    $("#form-sheet").hidden = false;
    setTimeout(() => $("#f-titulo").focus(), 50);
  }
  function setFormTipo(t) {
    ui.form.tipo = t;
    $$("[data-ftipo]").forEach((b) => b.classList.toggle("active", b.dataset.ftipo === t));
    $("#f-titulo-h").textContent = t === "sugestao" ? "Nova sugestão de melhoria" : "Nova ocorrência";
    $("#f-titulo").placeholder = t === "sugestao" ? "Ex.: Bicicletário coberto perto do Prédio E" : "Ex.: Buraco perto da Portaria 1";
  }
  $$("[data-ftipo]").forEach((b) => (b.onclick = () => { setFormTipo(b.dataset.ftipo); checarDuplicadas(); }));
  $("#f-cats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    ui.form.cat = b.dataset.cat;
    $$(".cat-opt").forEach((x) => x.classList.toggle("active", x === b));
    checarDuplicadas();
  });
  // Evita relatos duplicados: sugere confirmar uma ocorrência parecida já existente.
  function checarDuplicadas() {
    const p = { x: ui.form.x, y: ui.form.y };
    const dups = state.ocorrencias.filter((o) => ativa(o) && o.cat === ui.form.cat && o.tipo === ui.form.tipo && distM(o, p) <= RAIO_DUPLICADA_M);
    $("#f-duplicadas").innerHTML = dups.map((o) => `<div class="dup">Já existe um registro parecido a ${Math.round(distM(o, p))} m:
      <b>${esc(o.titulo)}</b> (${o.confirmacoes} confirmações). Se for o mesmo caso, confirme o existente em vez de criar outro.
      <br/><button type="button" class="btn small" data-dup="${o.id}">Ver e confirmar</button></div>`).join("");
  }
  $("#f-duplicadas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-dup]");
    if (!b) return;
    $("#form-sheet").hidden = true;
    abrirDetalhe(b.dataset.dup);
  });
  $("#f-foto").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      ui.form.foto = await reduzirImagem(f, 900);
      $("#f-preview").src = ui.form.foto; $("#f-preview").hidden = false;
    } catch (_) { toast("Não foi possível ler a imagem."); }
  });
  function reduzirImagem(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        resolve(cv.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = $("#f-titulo").value.trim();
    if (!titulo) return;
    const agora = Date.now();
    const o = {
      id: "u" + state.proximoId++, tipo: ui.form.tipo, cat: ui.form.cat, titulo, desc: $("#f-desc").value.trim(),
      x: ui.form.x, y: ui.form.y, status: "pendente", criadoEm: agora, ultimaConfirmacao: agora, confirmacoes: 1,
      autor: "Você", foto: ui.form.foto, historico: [{ data: agora, texto: "Registrada por você" }],
    };
    state.ocorrencias.push(o);
    state.confirmadas.push(o.id);
    save();
    $("#form-sheet").hidden = true;
    renderTudo();
    Plataforma.vibrar("sucesso");
    toast(o.tipo === "sugestao" ? "Sugestão publicada! Peça para colegas apoiarem." : "Ocorrência publicada! Obrigado por avisar.");
    abrirDetalhe(o.id);
  });

  // ---------------------------------------------------------------- filtros / abas / perfil
  $$("[data-tipo]").forEach((b) => (b.onclick = () => {
    ui.tipo = b.dataset.tipo;
    $$("[data-tipo]").forEach((x) => x.classList.toggle("active", x === b));
    renderTudo();
  }));
  $("#f-cat").onchange = (e) => { ui.cat = e.target.value; renderTudo(); };
  $("#f-status").onchange = (e) => { ui.status = e.target.value; renderTudo(); };
  $("#f-raio").onchange = (e) => { ui.raio = e.target.value; renderTudo(); };
  $("#f-ordem").onchange = (e) => { ui.ordem = e.target.value; renderLista(); };

  $("#tg-locais").onclick = (e) => {
    ui.verLocais = !ui.verLocais;
    e.currentTarget.classList.toggle("active", ui.verLocais);
    e.currentTarget.setAttribute("aria-pressed", ui.verLocais);
    aplicar();
  };
  $("#tg-resolvidos").onclick = (e) => {
    ui.verResolvidas = !ui.verResolvidas;
    e.currentTarget.classList.toggle("active", ui.verResolvidas);
    e.currentTarget.setAttribute("aria-pressed", ui.verResolvidas);
    renderPins();
  };

  const side = $("#side");
  side.prepend($("#tpl-side-tabs").content.cloneNode(true));
  function setTab(t) {
    const desktop = window.innerWidth >= 900;
    if (desktop && t === "mapa") t = ui.tab === "mapa" ? "lista" : ui.tab;
    ui.tab = t;
    document.body.dataset.tab = t;
    const painel = t === "mapa" ? "lista" : t;
    $$(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== painel));
    $$("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    if (t === "alertas") marcarAlertasLidos();
    side.scrollTop = 0;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) setTab(b.dataset.tab);
  });
  $("#btn-alertas").onclick = () => setTab("alertas");

  $$("[data-role]").forEach((b) => (b.onclick = () => {
    ui.role = b.dataset.role;
    $$("[data-role]").forEach((x) => x.classList.toggle("active", x === b));
    document.body.classList.toggle("gestao", ui.role === "gestao");
    toast(ui.role === "gestao" ? "Modo Gestão Facens: altere status e veja o painel completo." : "Modo Comunidade.");
    if (ui.role === "gestao") setTab("painel");
    if (!sheet.hidden && ui.selecionada) abrirDetalhe(ui.selecionada);
  }));

  $("#btn-heat").onclick = () => {
    ui.heat = !ui.heat;
    $("#heat").hidden = !ui.heat;
    if (ui.heat) { desenharCalor(); if (window.innerWidth < 900) setTab("mapa"); }
    renderPainel();
  };
  $("#btn-csv").onclick = () => {
    const cols = ["id", "tipo", "categoria", "titulo", "descricao", "local", "status", "confirmacoes", "criado_em", "ultima_confirmacao"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = state.ocorrencias.map((o) => [o.id, o.tipo, CATEGORIAS[o.cat].nome, o.titulo, o.desc, descreverLocal(o),
      STATUS[o.status].nome, o.confirmacoes, new Date(o.criadoEm).toISOString(), new Date(o.ultimaConfirmacao).toISOString()].map(q).join(";"));
    const blob = new Blob(["﻿" + cols.join(";") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ocorrencias-campus-facens.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#btn-reset").onclick = () => {
    if (!confirm("Apagar os registros feitos neste navegador e restaurar os dados de demonstração?")) return;
    state = defaults(); state.onboardingVisto = true; save(); renderTudo(); toast("Dados de demonstração restaurados.");
  };

  // ---------------------------------------------------------------- onboarding
  const PASSOS = [
    { i: "🗺️", t: "O campus em um mapa", p: "Veja onde estão os problemas de mobilidade e infraestrutura da Facens — buracos, iluminação, acessibilidade, estacionamento e mais." },
    { i: "➕", t: "Registre em segundos", p: "Toque em <b>Registrar</b>, escolha o ponto no mapa, a categoria e, se quiser, envie uma foto. Também dá para propor <b>sugestões de melhoria</b>." },
    { i: "👍", t: "Confirme o que é real", p: "Viu um problema já registrado? <b>Confirme</b> que ele ainda existe. Isso mostra à gestão o que é prioridade e evita relatos duplicados ou desatualizados." },
    { i: "🔔", t: "Receba alertas da sua rota", p: "Salve seu trajeto diário (ex.: Portaria 1 → Prédio E) e seja avisado quando surgir algo no caminho." },
  ];
  let passo = 0;
  function renderPasso() {
    const s = PASSOS[passo];
    $("#ob-step").innerHTML = `<div class="ob-icon">${s.i}</div><h2 id="ob-title">${s.t}</h2><p>${s.p}</p>`;
    $("#ob-dots").innerHTML = PASSOS.map((_, i) => `<i class="${i === passo ? "on" : ""}"></i>`).join("");
    $("#ob-next").textContent = passo === PASSOS.length - 1 ? "Começar" : "Próximo";
  }
  function abrirOnboarding() { passo = 0; renderPasso(); $("#onboarding").hidden = false; }
  function fecharOnboarding() { $("#onboarding").hidden = true; state.onboardingVisto = true; save(); }
  $("#ob-next").onclick = () => { if (passo < PASSOS.length - 1) { passo++; renderPasso(); } else fecharOnboarding(); };
  $("#ob-skip").onclick = fecharOnboarding;
  $("#btn-ajuda").onclick = abrirOnboarding;

  // ---------------------------------------------------------------- demonstração de notificação
  function agendarDemo() {
    if (byId("demo-1")) return;
    setTimeout(() => {
      if (byId("demo-1")) return;
      const agora = Date.now();
      const o = Object.assign({}, OCORRENCIA_DEMO, {
        id: "demo-1", criadoEm: agora, ultimaConfirmacao: agora, foto: null, _nova: true,
        historico: [{ data: agora, texto: "Registrada pela comunidade" }],
      });
      state.ocorrencias.push(o);
      save(); renderTudo();
      avaliarNovidade(o);
      setTimeout(() => { delete o._nova; save(); }, 4000);
    }, 25000);
  }

  // ---------------------------------------------------------------- GPS em tempo real
  // Converte latitude/longitude reais em posição na ilustração do campus:
  // transformação afim (mínimos quadrados) + correção local por distância inversa.
  const LAT0 = (CAMPUS.sul + CAMPUS.norte) / 2, LNG0 = (CAMPUS.oeste + CAMPUS.leste) / 2;
  const KY = 111320, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
  const enu = (lat, lng) => ({ e: (lng - LNG0) * KX, n: (lat - LAT0) * KY });
  let calib = null;
  function ajustarCalibracao() {
    const pts = GPS_PONTOS.concat(state.calibracao || []).map((p) => ({ ...enu(p.lat, p.lng), x: p.x, y: p.y }));
    const resolver = (campo) => {
      const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
      for (const p of pts) {
        const f = [p.e, p.n, 1];
        for (let i = 0; i < 3; i++) { r[i] += f[i] * p[campo]; for (let j = 0; j < 3; j++) S[i][j] += f[i] * f[j]; }
      }
      const M = S.map((row, i) => [...row, r[i]]);
      for (let i = 0; i < 3; i++) {
        let piv = i;
        for (let q = i + 1; q < 3; q++) if (Math.abs(M[q][i]) > Math.abs(M[piv][i])) piv = q;
        [M[i], M[piv]] = [M[piv], M[i]];
        for (let q = 0; q < 3; q++) if (q !== i) { const k = M[q][i] / M[i][i]; for (let j = i; j < 4; j++) M[q][j] -= k * M[i][j]; }
      }
      return M.map((row, i) => row[3] / row[i]);
    };
    const ax = resolver("x"), ay = resolver("y");
    const afim = (e, n) => ({ x: ax[0] * e + ax[1] * n + ax[2], y: ay[0] * e + ay[1] * n + ay[2] });
    calib = { afim, pts: pts.map((p) => { const a = afim(p.e, p.n); return { e: p.e, n: p.n, rx: p.x - a.x, ry: p.y - a.y }; }) };
  }
  function gpsParaMapa(lat, lng) {
    const { e, n } = enu(lat, lng);
    const a = calib.afim(e, n);
    let sw = 1 / (60 * 60), cx = 0, cy = 0; // peso base: a correção some a ~60 m dos pontos de controle
    for (const p of calib.pts) {
      const w = 1 / ((p.e - e) ** 2 + (p.n - n) ** 2 + 4);
      sw += w; cx += w * p.rx; cy += w * p.ry;
    }
    return { x: a.x + cx / sw, y: a.y + cy / sw };
  }
  function dentroDoCampus(lat, lng) {
    const m = CAMPUS.margemM;
    return lat >= CAMPUS.sul - m / KY && lat <= CAMPUS.norte + m / KY && lng >= CAMPUS.oeste - m / KX && lng <= CAMPUS.leste + m / KX;
  }

  const gps = { ativo: false, parar: null, ultimo: null, dentro: false, seguir: false, alertados: new Set(), ultimoSave: 0, ultimaLista: 0 };

  function renderMe() {
    let el = $("#me");
    if (!el) {
      $("#layer-me").innerHTML = `<div id="me-acc" class="me-acc"></div><div id="me" class="me"><i class="me-dir" hidden></i></div>`;
      el = $("#me");
    }
    const c = css(state.me);
    el.style.cssText = c;
    el.classList.toggle("live", gps.ativo && gps.dentro);
    el.title = gps.ativo && gps.dentro ? "Você está aqui (GPS)" : "Sua localização";
    const acc = $("#me-acc");
    if (gps.ativo && gps.dentro && gps.ultimo) {
      const d = (2 * Math.min(gps.ultimo.precisao, 120)) / MAPA.metrosPorPixel;
      acc.style.cssText = `${c};width:${d}px;height:${d}px`;
      acc.hidden = false;
      const dir = el.querySelector(".me-dir");
      const h = gps.ultimo.direcao;
      if (h != null && !Number.isNaN(h) && (gps.ultimo.velocidade ?? 1) > 0.3) {
        // direção real → ângulo na tela: projeta um ponto 10 m à frente
        const rad = (h * Math.PI) / 180;
        const frente = gpsParaMapa(gps.ultimo.lat + (10 * Math.cos(rad)) / KY, gps.ultimo.lng + (10 * Math.sin(rad)) / KX);
        const a = stagePx(state.me), b = stagePx(frente);
        dir.style.transform = `rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90}deg)`;
        dir.hidden = false;
      } else dir.hidden = true;
    } else acc.hidden = true;
  }

  function renderGpsStatus(texto, tipo = "") {
    const el = $("#gps-status");
    el.textContent = texto;
    el.className = "gps-status " + tipo;
    el.hidden = !texto;
    $("#tg-gps").classList.toggle("active", gps.ativo);
    $("#tg-gps").setAttribute("aria-pressed", gps.ativo);
    $("#z-me").classList.toggle("active", gps.seguir);
    const btn = $("#btn-gps-rota");
    if (btn) btn.textContent = gps.ativo ? "Desligar GPS" : "Usar GPS em tempo real";
  }

  function ligarGps() {
    if (gps.ativo) return;
    gps.ativo = true; gps.seguir = true; gps.ultimo = null;
    state.gpsLigado = true; save();
    renderGpsStatus("Procurando sinal de GPS…", "busca");
    gps.parar = Plataforma.assistirPosicao(aoMudarPosicao, aoErroGps);
    Plataforma.pedirPermissaoNotificacoes();
  }
  function desligarGps(motivo) {
    if (gps.parar) gps.parar();
    gps.ativo = false; gps.seguir = false; gps.parar = null; gps.dentro = false;
    if (!motivo) { state.gpsLigado = false; save(); }
    renderGpsStatus(motivo || "");
    renderMe();
  }
  function aoErroGps(err) {
    const msg = err && err.code === 1 ? "Permissão de localização negada. Ative nas configurações do aparelho."
      : err && err.code === 3 ? "GPS sem resposta. Vá para um local aberto e tente de novo."
      : "Não foi possível obter a localização.";
    if (!gps.ultimo || (err && err.code === 1)) { desligarGps(msg); toast(msg); }
  }
  function aoMudarPosicao(p) {
    if (!gps.ativo) return;
    const primeiro = !gps.ultimo;
    gps.ultimo = p;
    gps.dentro = dentroDoCampus(p.lat, p.lng);
    if (!gps.dentro) {
      const ref = GPS_PONTOS.find((g) => g.nome === "Portaria 1");
      const d = Math.hypot((p.lng - ref.lng) * KX, (p.lat - ref.lat) * KY);
      renderGpsStatus(`Você está fora do campus (${d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d) + " m"} da Portaria 1)`, "fora");
      renderMe();
      return;
    }
    const m = gpsParaMapa(p.lat, p.lng);
    state.me = { x: Math.max(0, Math.min(100, m.x)), y: Math.max(0, Math.min(100, m.y)) };
    renderGpsStatus(`GPS ao vivo · ${descreverLocal(state.me)} · ±${Math.round(p.precisao)} m`, "ok");
    renderMe();
    if (gps.seguir) centrar(state.me, primeiro);
    const agora = Date.now();
    if (agora - gps.ultimoSave > 15000) { gps.ultimoSave = agora; save(); }
    if (agora - gps.ultimaLista > 4000) {
      gps.ultimaLista = agora;
      if (ui.raio) renderPins();
      if (ui.tab === "lista" || window.innerWidth >= 900) renderLista();
    }
    verificarProximidade();
  }
  // Alerta em tempo real ao se aproximar de um problema ativo (uma vez por ocorrência).
  function verificarProximidade() {
    const perto = state.ocorrencias
      .filter((o) => ativa(o) && o.tipo === "problema" && !gps.alertados.has(o.id))
      .map((o) => ({ o, d: distM(o, state.me) }))
      .filter((x) => x.d <= CAMPUS.raioAlertaProximidadeM)
      .sort((a, b) => a.d - b.d)[0];
    if (!perto) return;
    gps.alertados.add(perto.o.id);
    const txt = `${CATEGORIAS[perto.o.cat].icone} ${perto.o.titulo} — a ${Math.round(perto.d)} m de você`;
    alertar("⚠️ Atenção no caminho: " + txt, perto.o.id);
    toast("Atenção: " + txt);
    Plataforma.vibrar("alerta");
    Plataforma.notificar("Atenção no caminho", txt);
  }

  $("#tg-gps").onclick = () => (gps.ativo ? desligarGps() : ligarGps());
  $("#z-me").onclick = () => {
    if (!gps.ativo) { ligarGps(); return; }
    gps.seguir = !gps.seguir;
    if (gps.seguir && gps.dentro) centrar(state.me);
    renderGpsStatus($("#gps-status").textContent, $("#gps-status").className.replace("gps-status", "").trim());
  };
  // Arrastar o mapa desliga o "seguir" (o usuário quer olhar outro lugar).
  viewport.addEventListener("pointermove", () => {
    if (gps.seguir && gesto && gesto.moveu && gesto.tipo === "pan") {
      gps.seguir = false;
      $("#z-me").classList.remove("active");
    }
  });
  $("#btn-aqui-gps").onclick = () => { sairModo(); abrirForm(state.me); };
  $("#btn-gps-rota").onclick = () => (gps.ativo ? desligarGps() : ligarGps());

  // Calibração (perfil Gestão): com o GPS ligado, toque no ponto exato onde você está.
  function adicionarCalibracao(p) {
    if (!gps.ultimo || !gps.dentro) { toast("Ligue o GPS dentro do campus para calibrar."); return; }
    state.calibracao.push({ lat: gps.ultimo.lat, lng: gps.ultimo.lng, x: p.x, y: p.y, nome: "Calibração " + (state.calibracao.length + 1) });
    ajustarCalibracao(); save();
    aoMudarPosicao(gps.ultimo);
    toast(`Ponto de calibração salvo (${state.calibracao.length}).`);
    renderPainel();
  }
  $("#btn-calibrar").onclick = () => {
    if (!gps.ativo || !gps.dentro) { toast("Ligue o GPS dentro do campus para calibrar."); ligarGps(); return; }
    entrarModo("calibrar", "Toque no ponto exato do mapa onde você está agora");
  };
  $("#btn-limpar-calib").onclick = () => {
    state.calibracao = []; ajustarCalibracao(); save();
    if (gps.ultimo) aoMudarPosicao(gps.ultimo);
    toast("Calibração restaurada para o padrão.");
    renderPainel();
  };

  // ---------------------------------------------------------------- init
  function renderTudo() {
    renderPins(); renderRota(); renderLista(); renderPainel(); renderRotaPainel(); renderAlertas();
  }
  // badge na navegação inferior
  const navAlert = $('.bottom-nav [data-tab="alertas"]');
  navAlert.insertAdjacentHTML("beforeend", `<span class="badge" id="badge-nav" hidden>0</span>`);

  Plataforma.configurar();
  // Botão voltar do Android: fecha janelas e abas antes de sair do app.
  Plataforma.aoVoltar(() => {
    if (!$("#onboarding").hidden) { fecharOnboarding(); return true; }
    if (!sheet.hidden || !$("#form-sheet").hidden) { fecharSheets(); return true; }
    if (ui.mode) { sairModo(); return true; }
    if (window.innerWidth < 900 && ui.tab !== "mapa") { setTab("mapa"); return true; }
    return false;
  });
  // No app nativo, recupera os dados do armazenamento do aplicativo se o WebView tiver sido limpo.
  if (Plataforma.nativo) {
    let vazio = true;
    try { vazio = !localStorage.getItem(STORE); } catch (_) {}
    if (vazio) Plataforma.restaurar(STORE).then((raw) => {
      if (!raw) return;
      try { state = Object.assign(defaults(), JSON.parse(raw)); ajustarCalibracao(); renderTudo(); } catch (_) {}
    });
  }
  ajustarCalibracao();
  montarCategorias();
  renderLocais();
  setTab(window.innerWidth >= 900 ? "lista" : "mapa");
  renderTudo();
  if (!state.onboardingVisto) abrirOnboarding();
  agendarDemo();
  if (state.gpsLigado) ligarGps();
  // Gancho de teste: permite simular uma posição no navegador (ex.: no console).
  window.__simularGps = (lat, lng, precisao = 8, direcao = null, velocidade = 1) => {
    if (!gps.ativo) { gps.ativo = true; renderGpsStatus("Simulação de GPS", "busca"); }
    aoMudarPosicao({ lat, lng, precisao, direcao, velocidade, ts: Date.now() });
  };
})();

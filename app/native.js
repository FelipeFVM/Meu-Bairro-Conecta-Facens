/* Camada de plataforma: usa os plugins nativos do Capacitor no Android/iOS
 * e as APIs equivalentes do navegador na versão web (PWA).
 */
window.Plataforma = (() => {
  "use strict";
  const Cap = window.Capacitor;
  const nativo = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const plataforma = nativo ? Cap.getPlatform() : "web"; // "android" | "ios" | "web"
  const P = (nome) => (nativo && Cap.Plugins ? Cap.Plugins[nome] : null);

  document.documentElement.classList.add("plat-" + plataforma);
  if (nativo) document.documentElement.classList.add("nativo");

  // ---------------------------------------------------------------- GPS
  // assistir(cb, erro) → função para parar. cb recebe { lat, lng, precisao, direcao, velocidade, ts }
  function normalizar(pos) {
    const c = pos.coords;
    return { lat: c.latitude, lng: c.longitude, precisao: c.accuracy, direcao: c.heading, velocidade: c.speed, ts: pos.timestamp || Date.now() };
  }
  async function pedirPermissaoLocalizacao() {
    const Geo = P("Geolocation");
    if (!Geo) return true; // no navegador o pedido aparece ao iniciar o watch
    try {
      let st = await Geo.checkPermissions();
      if (st.location !== "granted") st = await Geo.requestPermissions({ permissions: ["location"] });
      return st.location === "granted";
    } catch (_) { return false; }
  }
  function assistirPosicao(cb, erro) {
    const opts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 };
    const Geo = P("Geolocation");
    if (Geo) {
      let id = null, parado = false;
      pedirPermissaoLocalizacao().then((ok) => {
        if (!ok) { erro({ code: 1, message: "Permissão de localização negada" }); return; }
        Geo.watchPosition(opts, (pos, err) => {
          if (err) erro(err); else if (pos) cb(normalizar(pos));
        }).then((wid) => { id = wid; if (parado) Geo.clearWatch({ id }); });
      });
      return () => { parado = true; if (id) Geo.clearWatch({ id }); };
    }
    if (!("geolocation" in navigator)) { erro({ code: 2, message: "GPS indisponível neste dispositivo" }); return () => {}; }
    const id = navigator.geolocation.watchPosition((p) => cb(normalizar(p)), erro, opts);
    return () => navigator.geolocation.clearWatch(id);
  }

  // ---------------------------------------------------------------- vibração
  function vibrar(tipo = "leve") {
    const H = P("Haptics");
    if (H) {
      if (tipo === "alerta") H.notification({ type: "WARNING" }).catch(() => {});
      else if (tipo === "sucesso") H.notification({ type: "SUCCESS" }).catch(() => {});
      else H.impact({ style: tipo === "forte" ? "HEAVY" : "LIGHT" }).catch(() => {});
      return;
    }
    if (navigator.vibrate) navigator.vibrate(tipo === "alerta" ? [120, 60, 120] : 25);
  }

  // ---------------------------------------------------------------- notificações do sistema
  let idNotif = 1;
  async function pedirPermissaoNotificacoes() {
    const LN = P("LocalNotifications");
    if (LN) {
      try {
        let st = await LN.checkPermissions();
        if (st.display !== "granted") st = await LN.requestPermissions();
        return st.display === "granted";
      } catch (_) { return false; }
    }
    if (!("Notification" in window)) return false;
    if (Notification.permission === "default") { try { await Notification.requestPermission(); } catch (_) {} }
    return Notification.permission === "granted";
  }
  async function notificar(titulo, corpo) {
    const LN = P("LocalNotifications");
    if (LN) {
      try { await LN.schedule({ notifications: [{ id: idNotif++, title: titulo, body: corpo }] }); } catch (_) {}
      return;
    }
    // Na web, só notifica quando o app está em segundo plano (em primeiro plano o alerta já aparece na tela).
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
        if (reg) reg.showNotification(titulo, { body: corpo, icon: "icons/icon-192.png" });
        else new Notification(titulo, { body: corpo, icon: "icons/icon-192.png" });
      } catch (_) {}
    }
  }

  // ---------------------------------------------------------------- compartilhar
  async function compartilhar(titulo, texto) {
    const S = P("Share");
    try {
      if (S) { await S.share({ title: titulo, text: texto, dialogTitle: "Compartilhar ocorrência" }); return "ok"; }
      if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return "ok"; }
      await navigator.clipboard.writeText(`${titulo}\n${texto}`);
      return "copiado";
    } catch (_) { return "cancelado"; }
  }

  // ---------------------------------------------------------------- armazenamento persistente
  // No iOS o localStorage do WebView pode ser apagado pelo sistema; no app nativo
  // os dados também são gravados no armazenamento do aplicativo (Preferences).
  function persistir(chave, valor) {
    const Pr = P("Preferences");
    if (Pr) Pr.set({ key: chave, value: valor }).catch(() => {});
  }
  async function restaurar(chave) {
    const Pr = P("Preferences");
    if (!Pr) return null;
    try { return (await Pr.get({ key: chave })).value; } catch (_) { return null; }
  }

  // ---------------------------------------------------------------- integração com o sistema
  const ouvintesVoltar = [];
  function aoVoltar(fn) { ouvintesVoltar.push(fn); }
  function configurar() {
    const App = P("App"), SB = P("StatusBar"), Splash = P("SplashScreen");
    if (App) {
      // Botão "voltar" do Android: fecha janelas/abas antes de sair do app.
      App.addListener("backButton", () => {
        for (const fn of ouvintesVoltar) if (fn()) return;
        App.exitApp();
      });
      App.addListener("appStateChange", ({ isActive }) => document.dispatchEvent(new CustomEvent("app-estado", { detail: { ativo: isActive } })));
    }
    if (SB) {
      const escuro = matchMedia("(prefers-color-scheme: dark)");
      const aplicar = () => {
        SB.setStyle({ style: escuro.matches ? "DARK" : "LIGHT" }).catch(() => {});
        if (plataforma === "android") SB.setBackgroundColor({ color: escuro.matches ? "#18212b" : "#ffffff" }).catch(() => {});
      };
      aplicar();
      escuro.addEventListener("change", aplicar);
    }
    if (Splash) setTimeout(() => Splash.hide().catch(() => {}), 300);
  }

  return { nativo, plataforma, assistirPosicao, pedirPermissaoLocalizacao, vibrar, pedirPermissaoNotificacoes, notificar, compartilhar, persistir, restaurar, aoVoltar, configurar };
})();

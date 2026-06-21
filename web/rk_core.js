/**
 * REIKEN CORE - Infraestructura básica y utilidades globales.
 */

// ── SUPABASE ───────────────
const _sbUrl = "https://ukvtrpbpdrlvpuiibbnz.supabase.co";
const _sbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrdnRycGJwZHJsdnB1aWliYm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTE0OTEsImV4cCI6MjA5MDEyNzQ5MX0.AYiyWPqlUaWpgjYkF7uThG9BNLc7Yz1n5pB2cupsfFY";
const supabaseClient = supabase.createClient(_sbUrl, _sbKey);
window.supabaseClient = supabaseClient;

// ── CONSTANTES ─────────────
window.ROLE_ICONS = {
  "StoryBoard": "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889757/hzhkqhmmaktqqwbzu8f8.png",
  "Narrativa": "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889740/ylxaonfjgizs41galkqn.png",
  "Dirección": "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889745/gpudg05wkqjwa8nemnnt.png",
  "SFX": "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889743/h7solsm3cirfnpg5mps6.png",
};

// ── UTILIDADES ──────────────

/** Muestra un toast flotante con mensaje y color */
window.showToast = function (message, type = "success") {
  let toast = document.getElementById("rk-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "rk-toast";
    Object.assign(toast.style, {
      position: "fixed", bottom: "30px", left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 24px", borderRadius: "12px",
      fontFamily: "Gliker, sans-serif", fontSize: "16px",
      color: "white", zIndex: "99999",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      transition: "opacity 0.4s ease",
      pointerEvents: "none"
    });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === "error" ? "#b03030" : "#2e7d50";
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = "0"; }, 3000);
};

/** Convierte dataURL base64 a Blob */
window.dataURLtoBlob = function (dataURL) {
  if (!dataURL) return null;
  const [header, data] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

// ── CLOUDINARY ──────────────
const CLOUD_NAME = "dyy6zbkop";
const UPLOAD_PRESET = "reiken_default";

/** Sube un Blob o File a Cloudinary y devuelve la URL segura */
window.uploadToCloudinary = async function (fileOrBlob, subfolder, resourceType = "auto") {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append("file", fileOrBlob);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", `reiken_assets/${subfolder}`);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Error subiendo a Cloudinary");
  }
  const data = await res.json();
  return data.secure_url;
};

// ── GLOBAL FONT SIZE ──────────
(function initGlobalFontSize() {
  const STORAGE_KEY = "rk_global_font_size";
  const MIN = 12, MAX = 22, DEFAULT = 15;

  function applyGlobalFont(size) {
    document.documentElement.style.setProperty("--rk-global-font-size", size + "px");
    try { localStorage.setItem(STORAGE_KEY, size); } catch (e) { }
  }

  const saved = parseInt(localStorage.getItem(STORAGE_KEY)) || DEFAULT;
  applyGlobalFont(saved);

  window.RKFontSize = {
    apply: applyGlobalFont,
    get: () => parseInt(localStorage.getItem(STORAGE_KEY)) || DEFAULT,
    min: MIN, max: MAX
  };
})();

// ── GLOBAL PAGE ZOOM ──────────
(function initGlobalZoom() {
  const STORAGE_KEY = "rk_page_zoom";
  const MIN = 50, MAX = 150, DEFAULT = 100, STEP = 5;

  function applyGlobalZoom(percent) {
    const factor = percent / 100;
    if (window.__TAURI__?.core) {
      window.__TAURI__.core.invoke('set_zoom', { factor }).catch(() => {});
    } else if (window.rkZoom?.setZoomFactor) {
      window.rkZoom.setZoomFactor(factor);
    } else {
      document.body.style.zoom = factor;
    }
    try { localStorage.setItem(STORAGE_KEY, percent); } catch (e) { }
  }

  const saved = parseInt(localStorage.getItem(STORAGE_KEY)) || DEFAULT;
  if (document.body) {
    applyGlobalZoom(saved);
  } else {
    document.addEventListener("DOMContentLoaded", () => applyGlobalZoom(saved));
  }

  window.RKZoom = {
    apply: applyGlobalZoom,
    get: () => parseInt(localStorage.getItem(STORAGE_KEY)) || DEFAULT,
    min: MIN, max: MAX, step: STEP
  };
})();

// ── GLOBAL ANIMATION SYSTEM ──────────

window.ANIM = {
  async show(el, animClass = 'anim-scale-in') {
    if (!el) return;
    if (!el.classList.contains('hidden')) return;
    el.classList.remove('hidden');
    el.classList.remove('closing');
    el.classList.add(animClass);
    await new Promise(r => {
      el.addEventListener('animationend', () => {
        el.classList.remove(animClass);
        r();
      }, { once: true });
    });
  },
  async hide(el, animClass = 'anim-fade-out') {
    if (!el) return;
    if (el.classList.contains('hidden')) return;
    el.classList.add('closing');
    el.classList.add(animClass);
    await new Promise(r => {
      el.addEventListener('animationend', () => {
        el.classList.remove(animClass);
        el.classList.remove('closing');
        el.classList.add('hidden');
        r();
      }, { once: true });
    });
  },
  async toggle(el, animIn = 'anim-scale-in', animOut = 'anim-fade-out') {
    if (!el) return;
    if (el.classList.contains('hidden')) {
      await window.ANIM.show(el, animIn);
    } else {
      await window.ANIM.hide(el, animOut);
    }
  },
  stagger(parentSelector, delay = 40, animClass = 'anim-slide-up') {
    const children = document.querySelectorAll(`${parentSelector} > *`);
    children.forEach((child, i) => {
      child.classList.add(animClass);
      child.style.animationDelay = `${i * delay}ms`;
      child.addEventListener('animationend', () => {
        child.classList.remove(animClass);
        child.style.animationDelay = '';
      }, { once: true });
    });
  }
};

// ── GLOBAL UI (Background, Profile Card, Config) ──────────

window.applyBackground = async function (url) {
  const bg = document.getElementById("rk-bg");
  if (!bg) return;

  const isLowPerf = localStorage.getItem("rk_low_perf") === "true";
  if (isLowPerf) {
    bg.style.backgroundImage = "none";
    bg.style.backgroundColor = "#0f051a";
    return;
  }

  bg.style.backgroundImage = `url('${url}')`;
  bg.style.backgroundSize = "cover";
  bg.style.backgroundPosition = "center";
  bg.style.backgroundRepeat = "no-repeat";
};

window.loadUserBackground = async function () {
  const saved = localStorage.getItem("rk_background");
  if (saved) applyBackground(saved);

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    const { data } = await supabaseClient.from("usuarios").select("background_url").eq("id", user.id).single();
    if (data?.background_url) {
      applyBackground(data.background_url);
      localStorage.setItem("rk_background", data.background_url);
    }
  }
};

window.applyLowPerfSettings = function (enabled) {
  if (enabled) {
    document.body.classList.add("low-perf");
  } else {
    document.body.classList.remove("low-perf");
  }
};

// ── CACHE MANAGER ──────────────
const RK_CACHE_PREFIX = "rk_c_";
window.RKCache = {
  save: (key, data, ttlMinutes = 30) => {
    try {
      const payload = {
        data,
        expires: Date.now() + (ttlMinutes * 60 * 1000)
      };
      localStorage.setItem(RK_CACHE_PREFIX + key, JSON.stringify(payload));
      // Cleanup old entries if we are approaching limits
      if (localStorage.length > 50) window.RKCache.prune();
    } catch (e) {
      console.warn("RKCache: Failed to save", e);
      window.RKCache.prune(true); // Forced prune on quota error
    }
  },
  get: (key) => {
    try {
      const raw = localStorage.getItem(RK_CACHE_PREFIX + key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (Date.now() > payload.expires) {
        localStorage.removeItem(RK_CACHE_PREFIX + key);
        return null;
      }
      return payload.data;
    } catch { return null; }
  },
  remove: (key) => localStorage.removeItem(RK_CACHE_PREFIX + key),
  clearNamespace: (ns) => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(RK_CACHE_PREFIX + ns)) localStorage.removeItem(k);
    });
  },
  prune: (force = false) => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(RK_CACHE_PREFIX));
    if (!force && keys.length < 40) return;

    // Sort by expiration (older first) or just remove expired
    const entries = keys.map(k => { try { return { key: k, p: JSON.parse(localStorage.getItem(k) || '{}') }; } catch (e) { return { key: k, p: {} }; } });
    const now = Date.now();

    entries.forEach(e => {
      if (force || now > (e.p.expires || 0)) localStorage.removeItem(e.key);
    });
    console.log("RKCache: Pruned storage.");
  }
};

window.RKCore = {
  /**
   * Aplica datos de perfil a elementos estándar de la UI de forma instantánea
   */
  applyProfileData: (data) => {
    if (!data) return;
    const { alias, color_alias, fuente_alias, foto_url, background_url } = data;

    // 1. Fondo de pantalla
    if (background_url && window.applyBackground) {
      window.applyBackground(background_url);
      localStorage.setItem("rk_background", background_url);
    }

    // 2. Sidebar
    const sidebarAlias = document.getElementById("sidebarAlias");
    const sidebarAvatar = document.getElementById("sidebarAvatarImg");
    if (sidebarAlias) {
      sidebarAlias.textContent = alias || "Sin alias";
      if (color_alias) sidebarAlias.style.color = color_alias;
    }
    if (sidebarAvatar && foto_url) sidebarAvatar.src = foto_url;

    // 3. Welcome Bar (Index/Projects)
    const welcomeAlias = document.getElementById("ipWelcomeAlias");
    const welcomeAvatar = document.getElementById("ipWelcomeAvatarImg");
    if (welcomeAlias) {
      welcomeAlias.textContent = alias || "Sin alias";
      if (color_alias) welcomeAlias.style.color = color_alias;
    }
    if (welcomeAvatar && foto_url) welcomeAvatar.src = foto_url;

    // 4. Fuente Personalizada
    if (fuente_alias && fuente_alias.startsWith("http")) {
      const fName = "customUserAliasFont";
      if (![...document.fonts].some(f => f.family === fName)) {
        const face = new FontFace(fName, `url(${fuente_alias})`);
        face.load().then(f => {
          document.fonts.add(f);
          if (sidebarAlias) sidebarAlias.style.fontFamily = `'${fName}', 'Gliker', sans-serif`;
          if (welcomeAlias) welcomeAlias.style.fontFamily = `'${fName}', 'Gliker', sans-serif`;
        }).catch(() => { });
      } else {
        if (sidebarAlias) sidebarAlias.style.fontFamily = `'${fName}', 'Gliker', sans-serif`;
        if (welcomeAlias) welcomeAlias.style.fontFamily = `'${fName}', 'Gliker', sans-serif`;
      }
    }
  },

  /**
   * Carga el perfil desde caché (instantáneo) y luego refresca desde Supabase
   */
  loadGlobalProfile: async (forceRemote = false) => {
    // A. Cargar desde Caché (Velocidad Luz)
    const cached = window.RKCache.get("user_profile");
    if (cached) {
      window.RKCore.applyProfileData(cached);
      if (!forceRemote) {
        // Silent refresh en 2 segundos para no impactar carga inicial
        setTimeout(() => window.RKCore.syncRemoteProfile(), 2000);
        return cached;
      }
    }

    // B. Cargar desde Supabase
    return await window.RKCore.syncRemoteProfile();
  },

  syncRemoteProfile: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return null;

      const { data } = await supabaseClient.from("usuarios")
        .select("alias,color_alias,fuente_alias,foto_url,background_url")
        .eq("id", user.id).single();

      if (data) {
        const current = window.RKCache.get("user_profile");
        if (JSON.stringify(current) !== JSON.stringify(data)) {
          window.RKCore.applyProfileData(data);
          window.RKCache.save("user_profile", data, 1440); // 24h cache
        }
        return data;
      }
    } catch (e) {
      console.warn("RKCore: Error syncing profile", e);
    }
    return null;
  }
};

// ── GLOBAL PRELOADER ──────────
window.RKPreloader = {
  _loaderEl: null,
  
  injectLoader() {
    this._showTime = Date.now();
    if (document.getElementById("rk-global-loader")) {
      this._loaderEl = document.getElementById("rk-global-loader");
      this._loaderEl.classList.remove("hidden");
      return;
    }
    this._loaderEl = document.createElement("div");
    this._loaderEl.id = "rk-global-loader";
    this._loaderEl.innerHTML = `
      <div class="rk-gl-logo">
        <img src="icons/ReikenIcon.png" alt="Reiken">
      </div>
      <h2 class="rk-gl-text" id="rkGlText">Sincronizando Workspace</h2>
      <p class="rk-gl-subtext" id="rkGlSubtext">Conectando con la base de datos...</p>
      <div class="rk-gl-spinner"></div>
    `;
    document.body.appendChild(this._loaderEl);
  },

  updateText(text, subtext) {
    const t = document.getElementById("rkGlText");
    const st = document.getElementById("rkGlSubtext");
    if (t && text) t.textContent = text;
    if (st && subtext) st.textContent = subtext;
  },

  async hide() {
    if (this._loaderEl) {
      // Garantizar tiempo mínimo visible para que la transición no sea instantánea
      const elapsed = Date.now() - (this._showTime || Date.now());
      if (elapsed < 500) {
        await new Promise(r => setTimeout(r, 500 - elapsed));
      }
      // Esperar 1 frame para que el navegador tenga el estado base pintado
      await new Promise(r => requestAnimationFrame(r));
      window.ANIM.hide(this._loaderEl, 'anim-fade-out');
      setTimeout(() => { if(this._loaderEl) this._loaderEl.remove(); }, 800);
    }
  },

  async start() {
    // Only run on pages that need workspace data (not login/register)
    if (window.location.pathname.includes("login.html") || window.location.pathname.includes("register.html") || window.location.pathname.endsWith("/") || window.location.pathname.endsWith("index.html")) {
       return; 
    }

    // Si la aplicación ya arrancó en esta sesión, ocultar loader estático con transición y salir.
    if (sessionStorage.getItem('rk_app_booted') === 'true') {
      const el = document.getElementById("rk-global-loader");
      if (el) {
        el.classList.add("hidden");
        setTimeout(() => { if (el) el.remove(); }, 800);
      }
      document.dispatchEvent(new CustomEvent('rk-cache-ready'));
      return;
    }

    // Es un inicio fresco de la app. Forzamos limpiar la caché de prefetch 
    // para garantizar que la pantalla de carga traiga la versión más reciente de la DB.
    window.RKCache.clearNamespace("user_projects");
    window.RKCache.clearNamespace("prefetch_p_");

    this.injectLoader();
    // Esperar 1 frame para que el navegador pinte el loader visible antes de cualquier fetch
    await new Promise(r => requestAnimationFrame(r));
    
    try {
      this.updateText("Verificando credenciales", "Cargando perfil de usuario...");
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        await this.hide();
        return;
      }

      await window.RKCore.loadGlobalProfile(true); // Force sync on startup

      this.updateText("Descargando Proyectos", "Buscando tus mundos e historias...");
      
      const { data: memberships } = await supabaseClient.from("proyecto_miembros").select("proyecto_id").eq("user_id", user.id);
      if (!memberships || !memberships.length) {
        await this.hide();
        return;
      }

      const pIds = memberships.map(m => m.proyecto_id);
      const { data: projects } = await supabaseClient.from("proyectos").select("*").in("id", pIds).order("created_at", { ascending: false });
      
      if (!projects || !projects.length) {
         await this.hide();
         return;
      }

      // Save projects list to cache
      window.RKCache.save("user_projects", projects, 60);

      this.updateText("Sincronizando Módulos", "Storyboards, Conceptos y Mapas...");
      
      // 1. Fetch Global Templates
      if (!window.RKCache.get("global_templates")) {
        const { data: tmpls } = await supabaseClient.from("plantillas_concepto").select("*").order("nombre");
        if (tmpls) window.RKCache.save("global_templates", tmpls, 60);
      }

      // 2. Fetch Sections & Storyboards
      const { data: allSections } = await supabaseClient.from("secciones").select("*").in("proyecto_id", pIds);
      const { data: allStoryboards } = await supabaseClient.from("storyboards").select("*").in("proyecto_id", pIds).order("orden", { ascending: true });

      // 3. Fetch Concepts
      let allConcepts = [];
      let mapContents = [];
      let allMapBlocks = [];
      
      if (allSections) {
        const wbSecIds = allSections.filter(s => s.tipo === "worldbuilding").map(s => s.id);
        if (wbSecIds.length > 0) {
          const { data: c } = await supabaseClient.from("conceptos").select("*, plantillas_concepto(nombre)").in("seccion_id", wbSecIds).order("orden", { ascending: true });
          allConcepts = c || [];
          
          const mapTitles = wbSecIds.map(id => `__MAP_${id}`);
          const { data: mc } = await supabaseClient.from("contenidos").select("id, titulo").in("titulo", mapTitles).eq("tipo_plantilla", "wb_mapa");
          mapContents = mc || [];
          
          if (mapContents.length > 0) {
            const { data: mb } = await supabaseClient.from("bloques").select("*").in("contenido_id", mapContents.map(x => x.id));
            allMapBlocks = mb || [];
          }
        }
      }

      // Save to cache per project
      pIds.forEach(pid => {
        const pSections = allSections ? allSections.filter(s => s.proyecto_id === pid) : [];
        const pStoryboards = allStoryboards ? allStoryboards.filter(s => s.proyecto_id === pid) : [];
        const currentWbSec = pSections.find(s => s.tipo === "worldbuilding");
        const pConcepts = allConcepts.filter(c => c.seccion_id === currentWbSec?.id);
        
        const pMapContent = mapContents.find(c => c.titulo === `__MAP_${currentWbSec?.id}`);
        const pMapData = allMapBlocks.find(b => b.contenido_id === pMapContent?.id)?.data || null;

        const cacheData = {
          sections: pSections,
          storyboards: pStoryboards,
          concepts: pConcepts,
          mapData: pMapData
        };
        window.RKCache.save(`prefetch_p_${pid}`, cacheData, 60); 
      });

      // Marcar que la app ya completó su boot inicial en esta sesión
      sessionStorage.setItem('rk_app_booted', 'true');

      // Dispatch event to let modules know cache is ready
      document.dispatchEvent(new CustomEvent('rk-cache-ready'));
      
    } catch (err) {
      console.error("RKPreloader Error:", err);
    } finally {
      await this.hide();
    }
  }
};

// ── INITIALIZE GLOBAL ──────────
document.addEventListener("DOMContentLoaded", async () => {

  // ── SSO: Auto-login si venimos del Launcher ─────────────────────────────
  // Reiken Hub (o Tauri) inyecta el access_token vía variable de entorno.
  // Intentamos leerlo desde Tauri (window.__TAURI__) o Electron (window.rkSession).
  let ssoToken = null, ssoRefresh = null, ssoEmail = null;
  if (window.__TAURI__?.core) {
    try {
      const session = await window.__TAURI__.core.invoke('get_session');
      if (session?.access_token) {
        ssoToken = session.access_token;
        ssoRefresh = session.refresh_token;
        ssoEmail = session.user_email;
      }
    } catch (e) {
      console.warn('[SSO] Tauri get_session falló:', e.message);
    }
  } else if (window.rkSession?.fromLauncher && window.rkSession.accessToken) {
    ssoToken = window.rkSession.accessToken;
    ssoRefresh = window.rkSession.refreshToken;
    ssoEmail = window.rkSession.userEmail;
  }
  if (ssoToken) {
    try {
      await supabaseClient.auth.setSession({
        access_token: ssoToken,
        refresh_token: ssoRefresh || ''
      });
      console.log('[SSO] Sesión inyectada desde Reiken Hub para:', ssoEmail);
    } catch (e) {
      console.warn('[SSO] No se pudo inyectar la sesión del Launcher:', e.message);
    }
  }

  // 1. Verificar si estamos en el index/landing y si el usuario ya está logueado
  const isLanding = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
  
  if (isLanding) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      // Usuario ya logueado, saltar directo al Dashboard
      window.location.href = "projects.html";
      return;
    }
  }

  // 2. Aplicación ultra-rápida desde caché antes de cualquier otra cosa
  window.RKCore.loadGlobalProfile();
  
  // 3. Iniciar precarga si corresponde
  window.RKPreloader.start();

  const isLowPerf = localStorage.getItem("rk_low_perf") === "true";
  applyLowPerfSettings(isLowPerf);
});


// ── GLOBAL UX SOUNDS ───────────────────────
(function initGlobalSounds() {
  // Sound registry — centralised so every module benefits automatically
  const SFX = {
    open: { file: "sounds/open.mp3", vol: 0.1 },
    close: { file: "sounds/backup-close.wav", vol: 0.45 },
    create: { file: "sounds/create.mp3", vol: 0.45 },
    noti: { file: "sounds/noti.mp3", vol: 0.4 },
    hover: { file: "sounds/hoversidebar.wav", vol: 0.3 },
    swoosh1: { file: "sounds/Swoosh-1.wav", vol: 0.4 },
    swoosh2: { file: "sounds/Swoosh-2.wav", vol: 0.4 },
    clickconcept: { file: "sounds/clickconcept-1.wav", vol: 0.5 },
  };

  window.RKSound = {
    _swoopToggle: false,
    play(type) {
      const s = SFX[type];
      if (!s) return;
      const a = new Audio(s.file);
      a.volume = s.vol;
      a.play().catch(() => { });
    },
    playSwoosh() {
      const type = this._swoopToggle ? 'swoosh2' : 'swoosh1';
      this._swoopToggle = !this._swoopToggle;
      this.play(type);
    }
  };

  // ── Modal open/close observer ──────────────────────────────
  // Watches ANY element with these classes for hidden toggling
  const OPEN_SELECTORS = ['modal-overlay', 'ip-noti-panel', 'profile-card', 'wb-concept-detail'];
  const CLOSE_SELECTORS = ['modal-overlay', 'ip-noti-panel', 'profile-card', 'wb-concept-detail',
    'brush-dropdown-menu', 'qd-char-dropdown'];

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type !== 'attributes' || m.attributeName !== 'class') return;
      const el = m.target;
      if (!el.classList) return;

      const wasHidden = m.oldValue ? m.oldValue.split(' ').includes('hidden') : false;
      const isHidden = el.classList.contains('hidden');

      const matchesOpen = OPEN_SELECTORS.some(c => el.classList.contains(c));
      const matchesClose = CLOSE_SELECTORS.some(c => el.classList.contains(c) || (m.oldValue && m.oldValue.includes(c)));

      if (wasHidden && !isHidden && matchesOpen) {
        window.RKSound.play('open');
      } else if (!wasHidden && isHidden && matchesClose) {
        window.RKSound.play('close');
      }
    });
  });

  function startObserver() {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  // ── Save/Create button sounds ──────────────────────────────
  // Intercepts any .modal-save-btn, .button-main, #saveProjectBtn etc.
  const SAVE_BTN_SELECTORS = [
    '.modal-save-btn', '#saveProjectBtn', '#saveSceneBtn',
    '#saveEditSceneBtn', '#saveDrawingBtn', '#saveEditBtn',
    '[id^="pem-save"]'
  ];

  function wireSaveSounds() {
    SAVE_BTN_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if (btn._rkSoundWired) return;
        btn._rkSoundWired = true;
        btn.addEventListener('click', () => window.RKSound.play('create'));
      });
    });
  }

  // ── Back / navigation buttons → close sound ───────────────
  const BACK_BTN_SELECTORS = [
    '#backBtn', '#cdBackBtn', '.wb-cd-back-btn',
    '.ip-back-btn', '#macroHubBackBtn'
  ];

  function wireBackSounds() {
    BACK_BTN_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if (btn._rkBackWired) return;
        btn._rkBackWired = true;
        // Use mousedown instead of click so the sound starts before the page unloads
        btn.addEventListener('mousedown', () => window.RKSound.play('close'));
      });
    });
  }

  // ── Sidebar hover — applied globally ─────────────────────
  function wireSidebarHover() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      if (item._rkHoverWired) return;
      item._rkHoverWired = true;
      item.addEventListener('mouseenter', () => window.RKSound.play('hover'));
    });
  }

  // ── showToast override → noti sound ─────────────────────
  const _origShowToast = window.showToast;
  window.showToast = function (msg, type) {
    if (_origShowToast) _origShowToast(msg, type);
    // Play noti on success toasts only (not errors)
    if (type !== 'error') window.RKSound.play('noti');
  };

  // ── Shortcut system — universal (compartido entre todas las páginas) ──
  window.__shortcutProjectId = null;
  window.__shortcutGoHandler = null;

  window.__shortcutGoHandlerUniversal = function(sc) {
    if (!sc?.type) return;
    const pid = window.__shortcutProjectId || localStorage.getItem('rk_last_project_id') || '';
    if (sc.type === 'escena' && sc.targetId) {
      window.location.href = 'escena.html?id=' + sc.targetId;
    } else if (sc.type === 'concepto' && sc.targetId) {
      window.location.href = 'worldbuilding.html?project_id=' + pid + '&world_id=' + sc.targetId;
    } else if (sc.type === 'section') {
      window.location.href = 'index_projects.html?id=' + pid;
    }
  };

  function _scKey() { return `rk_shortcuts_${window.__shortcutProjectId || ''}`; }

  function _getSC() {
    try { return JSON.parse(localStorage.getItem(_scKey()) || '[]'); } catch { return []; }
  }

  function _setSC(list) {
    localStorage.setItem(_scKey(), JSON.stringify(list));
    _renderSC();
    window.dispatchEvent(new CustomEvent('shortcuts-changed'));
  }

  function _renderSC() {
    const el = document.getElementById('shortcutList');
    if (!el) return;
    const items = _getSC();
    el.innerHTML = '';
    if (!items.length) return;
    el.style.cssText = 'display:flex;flex-wrap:wrap;flex-direction:row;gap:6px;';
    items.forEach((sc, idx) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-flex;';

      const btn = document.createElement('button');
      btn.title = sc.label || 'Atajo';
      btn.addEventListener('click', () => window.__shortcutGoHandler?.(sc));

      const del = document.createElement('button');
      del.textContent = '✕';
      del.title = 'Eliminar atajo';
      del.style.cssText = 'position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;border:none;background:rgba(219,78,78,0.9);color:white;font-size:10px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:2;padding:0;';
      del.addEventListener('click', (e) => { e.stopPropagation(); _setSC(_getSC().filter((_, i) => i !== idx)); });
      wrapper.addEventListener('mouseenter', () => del.style.display = 'flex');
      wrapper.addEventListener('mouseleave', () => del.style.display = 'none');

      if (sc.type === 'concepto') {
        btn.className = 'sc-circle';
        btn.style.cssText = 'width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,255,255,0.1);cursor:pointer;flex-shrink:0;overflow:hidden;position:relative;';
        if (sc.iconoUrl) {
          btn.style.backgroundImage = 'url("' + sc.iconoUrl + '")';
          btn.style.backgroundSize = 'cover';
          btn.style.backgroundPosition = 'center';
        } else {
          btn.style.background = sc.color || 'rgba(150,100,200,0.7)';
          btn.textContent = (sc.label || '?')[0].toUpperCase();
          btn.style.color = 'white';
          btn.style.fontSize = '20px';
          btn.style.fontWeight = 'bold';
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
        }
      } else {
        btn.className = 'sc-card';
        btn.style.cssText = 'width:130px;height:68px;border-radius:10px;border:none;cursor:pointer;flex-shrink:0;overflow:hidden;position:relative;';
        if (sc.bannerUrl) {
          btn.style.backgroundImage = 'url("' + sc.bannerUrl + '")';
          btn.style.backgroundSize = 'cover';
          btn.style.backgroundPosition = 'center';
        } else {
          btn.style.background = sc.color || 'rgba(219,111,78,0.6)';
        }
        btn.innerHTML = '<span style="position:absolute;bottom:0;inset-inline:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:4px 8px;font-size:11px;color:white;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;">' + (sc.label || 'Atajo') + '</span>';
      }

      wrapper.appendChild(btn);
      wrapper.appendChild(del);
      el.appendChild(wrapper);
    });
  }

  async function _showCreateSCModal() {
    const old = document.getElementById('scCreateModal');
    if (old) old.remove();
    const pid = window.__shortcutProjectId;
    if (!pid) { window.showToast?.('Abre un proyecto primero', 'info'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'scCreateModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:rgba(30,12,40,0.97);border:1px solid rgba(219,111,78,0.4);border-radius:14px;padding:16px;min-width:320px;max-width:420px;max-height:70vh;display:flex;flex-direction:column;';

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-family:&apos;Gliker&apos;,sans-serif;font-size:15px;color:white;">CREAR ATAJO</span>
        <button id="scCloseBtn" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:18px;cursor:pointer;">✕</button>
      </div>
      <input id="scSearch" type="text" placeholder="Buscar..." autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:white;font-size:13px;outline:none;margin-bottom:10px;font-family:inherit;">
      <div id="scList" style="overflow-y:auto;flex:1;min-height:0;">
        <div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px;">Cargando...</div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Static events
    modal.querySelector('#scCloseBtn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const searchInput = modal.querySelector('#scSearch');
    if (searchInput) setTimeout(() => searchInput.focus(), 0);

    try {
      // Get section IDs first
      const { data: sections } = await supabaseClient.from('secciones').select('id,tipo').eq('proyecto_id', pid);
      const sbSec = (sections || []).find(s => s.tipo === 'storyboarding');
      const wbSec = (sections || []).find(s => s.tipo === 'worldbuilding');

      const [escenasRes, conceptRes, sbNameRes] = await Promise.all([
        sbSec
          ? supabaseClient.from('escenas').select('id,titulo,banner_url,storyboard_id').eq('seccion_id', sbSec.id).order('orden', { ascending: true })
          : { data: [] },
        wbSec
          ? supabaseClient.from('conceptos').select('id,titulo,icono_url').eq('seccion_id', wbSec.id).order('orden', { ascending: true })
          : { data: [] },
        supabaseClient.from('storyboards').select('id,titulo').eq('proyecto_id', pid),
      ]);
      const escenas = escenasRes.data || [];
      const concepts = conceptRes.data || [];
      const sbMap = {};
      (sbNameRes.data || []).forEach(sb => { sbMap[sb.id] = sb.titulo; });

      const scList = modal.querySelector('#scList');
      if (!scList) return;

      let listHtml = '';

      // Escenas individuales
      if (escenas.length > 0) {
        listHtml += `<div style="margin-bottom:8px;"><div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Escenas</div>`;
        escenas.forEach(e => {
          const obj = { type: 'escena', targetId: e.id, label: e.titulo || 'Sin título', color: 'rgba(219,111,78,0.6)', bannerUrl: e.banner_url || null, storyboardId: e.storyboard_id };
          const enc = JSON.stringify(obj).replace(/'/g, '&#39;');
          const sbLabel = sbMap[e.storyboard_id] || '';
          listHtml += `<div class="sc-item sc-searchable" data-json='${enc}'>
            <span class="sidebar-circle-color" style="background:${obj.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;"></span>
            <span style="flex:1;">${obj.label}${sbLabel ? ` <span style="color:rgba(255,255,255,0.25);font-size:10px;">(${sbLabel})</span>` : ''}</span>
            <span style="color:rgba(255,255,255,0.25);font-size:11px;">+</span>
          </div>`;
        });
        listHtml += `</div>`;
      }

      // Conceptos
      if (concepts.length > 0) {
        listHtml += `<div style="margin-bottom:4px;"><div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Conceptos</div>`;
        concepts.forEach(c => {
          const obj = { type: 'concepto', targetId: c.id, label: c.titulo || 'Sin título', color: 'rgba(150,100,200,0.7)', iconoUrl: c.icono_url || null };
          const enc = JSON.stringify(obj).replace(/'/g, '&#39;');
          listHtml += `<div class="sc-item sc-searchable" data-json='${enc}'>
            <span class="sidebar-circle-color" style="background:${obj.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;"></span>
            <span style="flex:1;">${obj.label}</span>
            <span style="color:rgba(255,255,255,0.25);font-size:11px;">+</span>
          </div>`;
        });
        listHtml += `</div>`;
      }

      scList.innerHTML = listHtml || '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px;">Sin resultados</div>';

      // Search
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.trim().toLowerCase();
          scList.querySelectorAll('.sc-searchable').forEach(el => {
            el.style.display = (!q || el.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
          });
        });
      }

      // Item click → save shortcut
      scList.querySelectorAll('.sc-item').forEach(el => {
        el.addEventListener('click', () => {
          try {
            const sc = JSON.parse(el.dataset.json);
            const list = _getSC();
            const dup = list.find(x => x.type === sc.type && x.targetId === sc.targetId && x.target === sc.target);
            if (dup) { window.showToast?.("ℹ Ese atajo ya existe"); return; }
            list.push(sc);
            _setSC(list);
            window.showToast?.("✔ Atajo creado: " + (sc.label || ""));
            overlay.remove();
          } catch (e) { console.error('shortcut item click:', e); }
        });
      });
    } catch (e) {
      console.error('_showCreateSCModal fetch:', e);
      const scList = modal.querySelector('#scList');
      if (scList) scList.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px;">Error al cargar datos</div>';
    }
  }

  // Delegated click: cualquier clic en #createShortcutBtn abre el modal
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#createShortcutBtn')) return;
    _showCreateSCModal();
  });

  // Init pública para que cada página registre su projectId y goHandler
  window.__initShortcuts = function(projectId, goHandler) {
    window.__shortcutProjectId = projectId;
    window.__shortcutGoHandler = goHandler;
    if (projectId) localStorage.setItem('rk_last_project_id', projectId);
    _renderSC();
  };

  // ── Bootstrap everything ─────────────────────────────────
  function bootstrap() {
    startObserver();
    wireSaveSounds();
    wireBackSounds();
    wireSidebarHover();

    // Re-wire on DOM changes (for dynamically created elements)
    const rewireObserver = new MutationObserver(() => {
      wireSaveSounds();
      wireBackSounds();
      wireSidebarHover();
    });
    rewireObserver.observe(document.body, { childList: true, subtree: true });

    // Auto-init shortcuts si ninguna página registró su propio handler
    setTimeout(() => {
      if (!window.__shortcutProjectId) {
        const lastPid = localStorage.getItem('rk_last_project_id');
        if (lastPid) {
          window.__shortcutProjectId = lastPid;
          window.__shortcutGoHandler = window.__shortcutGoHandler || window.__shortcutGoHandlerUniversal;
          _renderSC();
        }
      }
    }, 50);
  }

  if (document.body) {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
  }
})();

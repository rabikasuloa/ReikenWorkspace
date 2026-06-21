/**
 * REIKEN COMPONENTS
 * Componentes compartidos y selector de usuarios.
 */

window.RKCache = window.RKCache || {};
if (!window.RKCache.hasOwnProperty('users')) window.RKCache.users = null;

// ── USER PICKER ───────────────────────────

window.openUserPicker = async function (excludeIds = [], onAdd) {
  let overlay = document.getElementById("userPickerOverlay");

  // Si no existe, lo creamos una sola vez (DOM Recycling)
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "userPickerOverlay";
    overlay.className = "up-overlay";
    overlay.innerHTML = `
      <div class="up-panel">
        <div class="up-header">
          <h2 class="up-title">Añadir miembros</h2>
          <input class="up-search modal-input" id="upSearch" placeholder="Buscar usuario...">
          <button class="modal-close" id="upClose">✕</button>
        </div>
        <div class="up-grid" id="upGrid"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("upClose").onclick = () => window.ANIM.hide(overlay, 'anim-fade-out');
    overlay.onclick = (e) => { if (e.target === overlay) window.ANIM.hide(overlay, 'anim-fade-out'); };

    document.getElementById("upSearch").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      overlay.querySelectorAll(".up-user-card").forEach(card => {
        const name = card.dataset.name || "";
        card.style.display = name.includes(q) ? "" : "none";
      });
    };
  }

  const grid = document.getElementById("upGrid");
  window.ANIM.show(overlay, 'anim-fade-in');

  // Usar Caché para mejorar el rendimiento
  if (!window.RKCache.users) {
    grid.innerHTML = `<p class="up-loading">Cargando usuarios...</p>`;
    const { data: usuarios } = await supabaseClient
      .from("usuarios")
      .select("id, alias, foto_url, color_alias, usuario_roles(tipo, roles(nombre, icon_url))")
      .order("alias");
    window.RKCache.users = usuarios || [];
  }

  renderUserPickerGrid(excludeIds, onAdd);
}

function renderUserPickerGrid(excludeIds, onAdd) {
  const grid = document.getElementById("upGrid");
  const usuarios = window.RKCache.users;

  if (!usuarios || usuarios.length === 0) {
    grid.innerHTML = `<p class="up-loading">No hay usuarios registrados.</p>`;
    return;
  }

  // Agrupar por rol principal
  const groups = {};
  usuarios.forEach(u => {
    const principal = u.usuario_roles?.find(r => r.tipo === "principal");
    const rolNombre = principal?.roles?.nombre || "Sin rol";
    if (!groups[rolNombre]) groups[rolNombre] = [];
    groups[rolNombre].push({ ...u, rolPrincipal: principal });
  });

  grid.innerHTML = "";

  Object.entries(groups).forEach(([rol, users]) => {
    const groupEl = document.createElement("div");
    groupEl.className = "up-group";

    const labelEl = document.createElement("div");
    labelEl.className = "up-group-label";
    const rolIcon = users[0].rolPrincipal?.roles?.icon_url
      ? `<img class="up-group-icon" src="${users[0].rolPrincipal.roles.icon_url}" alt="">`
      : "";
    labelEl.innerHTML = `${rolIcon}<span>${rol}</span>`;
    groupEl.appendChild(labelEl);

    const rowEl = document.createElement("div");
    rowEl.className = "up-group-row";

    users.forEach(u => {
      if (excludeIds.includes(u.id)) return;

      const card = document.createElement("div");
      card.className = "up-user-card";
      card.dataset.id = u.id;
      card.dataset.name = (u.alias || "").toLowerCase();

      card.innerHTML = `
        <div class="up-user-avatar"><img src="${u.foto_url || 'icons/Tu.png'}" alt=""></div>
        <span class="up-user-alias" style="color:${u.color_alias || '#fff'}">${u.alias || "Sin alias"}</span>
        <button class="up-add-btn" title="Añadir">+</button>
      `;

      card.querySelector(".up-add-btn").onclick = async () => {
        const btn = card.querySelector(".up-add-btn");
        btn.textContent = "✔";
        btn.disabled = true;
        card.classList.add("up-user-card--added");

        await onAdd(u.id);

        setTimeout(() => {
          card.style.opacity = "0";
          card.style.maxWidth = "0";
          setTimeout(() => card.remove(), 300);
        }, 600);
      };

      rowEl.appendChild(card);
    });

    if (rowEl.children.length > 0) {
      groupEl.appendChild(rowEl);
      grid.appendChild(groupEl);
    }
  });

  if (grid.children.length === 0) {
    grid.innerHTML = `<p class="up-loading">Todos los usuarios ya son miembros.</p>`;
  }
}

// ── MODALES GLOBALES (Apariencia / Config) ───────────────────────────

window.injectAppearanceModal = function () {
  if (document.getElementById("appearanceModal")) return;
  const m = document.createElement("div");
  m.id = "appearanceModal";
  m.className = "modal-overlay hidden";
  m.innerHTML = `
    <div class="modal-box modal-appearance">
      <div class="modal-header">
        <h2>Apariencia</h2>
        <button class="modal-close" id="closeAppearanceModal">✕</button>
      </div>
      <p class="appearance-subtitle">Fondo de pantalla</p>
      <input type="file" id="bgFolderInput" accept="image/*" multiple hidden>
      <div class="appearance-load-row">
        <button class="appearance-load-btn" id="loadBgFolderBtn">Cargar fondos de pantalla</button>
        <span class="appearance-hint" id="appearanceHint">Sube imágenes para tu galería</span>
      </div>
      <div class="appearance-grid" id="appearanceGrid"></div>
      
      <p class="appearance-subtitle" style="margin-top:20px">Tamaño de fuente global</p>
      <div class="appearance-font-row">
        <input type="range" class="appearance-font-slider" id="globalFontSlider"
               min="${window.RKFontSize?.min || 12}" max="${window.RKFontSize?.max || 22}" step="1"
               value="${window.RKFontSize?.get() || 15}">
        <span class="appearance-font-val" id="globalFontVal">${window.RKFontSize?.get() || 15}px</span>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  document.getElementById("closeAppearanceModal").onclick = () => window.ANIM.hide(m, 'anim-modal-out');
  m.onclick = (e) => { if (e.target === m) window.ANIM.hide(m, 'anim-modal-out'); };

  const slider = document.getElementById("globalFontSlider");
  const valLbl = document.getElementById("globalFontVal");
  slider.oninput = () => {
    const v = parseInt(slider.value);
    if (valLbl) valLbl.textContent = v + "px";
    window.RKFontSize?.apply(v);
  };

  const loadBtn = document.getElementById("loadBgFolderBtn");
  const input = document.getElementById("bgFolderInput");
  const grid = document.getElementById("appearanceGrid");
  const hint = document.getElementById("appearanceHint");

  loadBtn.onclick = () => input.click();
  input.onchange = async () => {
    const files = Array.from(input.files).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    hint.textContent = `Subiendo...`;
    for (const file of files) {
      try {
        const url = await uploadToCloudinary(file, "backgrounds");
        const thumb = document.createElement("div");
        thumb.className = "bg-thumb";
        thumb.innerHTML = `<img src="${url}" loading="lazy">`;
        thumb.onclick = async () => {
          applyBackground(url);
          localStorage.setItem("rk_background", url);
          const { data: { user } } = await supabaseClient.auth.getUser();
          if (user) await supabaseClient.from("usuarios").update({ background_url: url }).eq("id", user.id);
          showToast("✔ Fondo aplicado");
        };
        grid.prepend(thumb);
      } catch (e) { showToast("Error al subir", "error"); }
    }
    hint.textContent = `Listo.`;
  };
};

window.injectConfigModal = function () {
  if (document.getElementById("configModal")) return;
  const m = document.createElement("div");
  m.id = "configModal";
  m.className = "modal-overlay hidden";
  const isLowPerf = localStorage.getItem("rk_low_perf") === "true";
  const isLunaEnabled = localStorage.getItem("rk_experimental_luna") === "true";

  m.innerHTML = `
    <div class="modal-box modal-box-sm">
      <div class="modal-header">
        <h2>Configuración</h2>
        <button class="modal-close" id="closeConfigModal">✕</button>
      </div>
      <div class="modal-config-item">
        <div class="modal-config-info">
          <span class="modal-config-label">Modo Pobre (Optimización)</span>
          <p class="modal-config-hint">Desactiva efectos visuales para mayor fluidez.</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="lowPerfToggle" ${isLowPerf ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
      </div>
      <div class="modal-config-item" style="margin-top: 15px;">
        <div class="modal-config-info">
          <span class="modal-config-label">Luna(Experimental)</span>
          <p class="modal-config-hint">Habilita a la asistente Luna para ayudarte en el Workspace.</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="lunaExperimentalToggle" ${isLunaEnabled ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
      </div>
      <div class="modal-config-item" style="margin-top: 15px; flex-direction:column; align-items:stretch; gap:10px;">
        <div class="modal-config-info">
          <span class="modal-config-label">Zoom de página</span>
          <p class="modal-config-hint">Ajusta el tamaño general de la interfaz (50% – 150%).</p>
        </div>
        <div class="appearance-font-row" style="width:100%;">
          <input type="range" class="appearance-font-slider"
                 min="${window.RKZoom?.min || 50}" max="${window.RKZoom?.max || 150}" step="${window.RKZoom?.step || 5}"
                 value="${window.RKZoom?.get() || 100}" id="pageZoomSlider">
          <span class="appearance-font-val" id="pageZoomVal">${window.RKZoom?.get() || 100}%</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  document.getElementById("lowPerfToggle").onchange = (e) => {
    const enabled = e.target.checked;
    localStorage.setItem("rk_low_perf", enabled);
    if (window.applyLowPerfSettings) window.applyLowPerfSettings(enabled);
    if (window.applyBackground) {
      const savedBG = localStorage.getItem("rk_background");
      if (savedBG) window.applyBackground(savedBG);
    }
  };

  document.getElementById("pageZoomSlider").oninput = function () {
    const v = parseInt(this.value);
    document.getElementById("pageZoomVal").textContent = v + "%";
    if (window.RKZoom) window.RKZoom.apply(v);
  };

  document.getElementById("lunaExperimentalToggle").onchange = (e) => {
    const enabled = e.target.checked;
    localStorage.setItem("rk_experimental_luna", enabled);

    // Toggle sidebar button visibility reactively
    const lunaBtn = document.getElementById("btnLunaChat");
    if (lunaBtn) {
      if (enabled || (window.RKTutorial && window.RKTutorial.isCEO)) {
        lunaBtn.style.display = "";
      } else {
        lunaBtn.style.display = "none";
      }
    }

    // Reveal/hide voice settings gear button reactively - ONLY for CEO!
    if (window.RKTutorial) {
      if (window.RKTutorial.isCEO) {
        if (window.RKTutorial.voiceGearBtn) {
          window.RKTutorial.voiceGearBtn.classList.remove("hidden");
        }
      } else {
        if (window.RKTutorial.voiceGearBtn) {
          window.RKTutorial.voiceGearBtn.classList.add("hidden");
        }
      }
    }
  };

  document.getElementById("closeConfigModal").onclick = () => window.ANIM.hide(m, 'anim-modal-out');
  m.onclick = (e) => { if (e.target === m) window.ANIM.hide(m, 'anim-modal-out'); };
};

// ── PROFILE CARD ───────────────────────────

let profileCardEl = null;
let profileDataCache = null;

// Forzar recarga si es necesario
window.clearProfileCache = () => { profileDataCache = null; };

window.toggleProfileCard = async function (btn) {
  if (profileCardEl) {
    profileCardEl.remove();
    profileCardEl = null;
    return;
  }

  if (!profileDataCache) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const [uRes, rolesRes, dispRes] = await Promise.all([
      supabaseClient.from("usuarios").select("alias,color_alias,fuente_alias,foto_url,banner_url").eq("id", user.id).single(),
      supabaseClient.from("usuario_roles").select("tipo, roles(nombre, icon_url)").eq("user_id", user.id),
      supabaseClient.from("disponibilidad").select("dia,hora_inicio,hora_fin").eq("user_id", user.id)
    ]);

    profileDataCache = {
      u: uRes.data,
      roles: rolesRes.data || [],
      disp: dispRes.data || [],
      userId: user.id
    };
  }

  const { u, roles, disp, userId } = profileDataCache;
  const principal = roles.find(r => r.tipo === "principal");
  const secundarios = roles.filter(r => r.tipo === "secundario");


  const card = document.createElement("div");
  card.id = "profileCard";
  card.className = "rkw-user-card"; // Usar clase de Reikanales

  // Roles HTML (Lógica de Reikanales)
  const roleTag = (rol, isPrincipal = false) => {
    const icon = rol.roles?.icon_url ? `<img src="${rol.roles.icon_url}" alt="">` : ""
    return `<span class="rkw-uc-role${isPrincipal ? " principal" : ""}">${icon}${rol.roles?.nombre || ""}</span>`;
  };
  const rolesHTML = (principal || secundarios.length)
    ? `${principal ? `<div class="rkw-uc-section-label">Rol Principal</div><div class="rkw-uc-roles">${roleTag(principal, true)}</div>` : ""}${secundarios.length ? `<div class="rkw-uc-section-label">Roles Secundarios</div><div class="rkw-uc-roles">${secundarios.map(r => roleTag(r)).join("")}</div>` : ""}`
    : `<p class="rkw-uc-noroles">Sin roles asignados</p>`;

  // Disponibilidad HTML (Lógica de Reikanales)
  const diasOrden = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
  const dispData = disp || [];
  const dispHTML = dispData.length
    ? `<div class="rkw-uc-disp-box">${diasOrden.filter(d => dispData.some(x => x.dia === d)).map(d => { const h = dispData.find(x => x.dia === d); return `<div class="rkw-uc-disp-row"><span class="rkw-uc-disp-day">${d}</span><span class="rkw-uc-disp-time">${(h.hora_inicio || "").slice(0, 5)} – ${(h.hora_fin || "").slice(0, 5)}</span></div>`; }).join("")}</div>`
    : `<p class="rkw-uc-disp-empty">Sin disponibilidad registrada</p>`;

  card.innerHTML = `
    <div class="rkw-uc-banner" style="${u?.banner_url ? `background-image:url('${u.banner_url}')` : ""}"></div>
    <div class="rkw-uc-avatar-row"><img class="rkw-uc-avatar" src="${u?.foto_url || 'icons/Tu.png'}" alt="" onerror="this.src='icons/Tu.png'"></div>
    <div class="rkw-uc-alias" style="color:${u?.color_alias || '#fff'}">${u?.alias || "Usuario"}</div>
    
    ${rolesHTML}
    
    <div class="rkw-uc-section-label">Disponibilidad</div>
    ${dispHTML}

    <div class="pc-footer">
      <button class="pc-edit-btn" id="pcEditBtn">Editar perfil</button>
      <button class="pc-logout-btn" id="pcLogoutBtn">Cerrar sesión</button>
    </div>
  `;

  document.body.appendChild(card);
  profileCardEl = card;

  // Lógica de fuente personalizada (Copiada de Reikanales)
  if (u?.fuente_alias) {
    try {
      if (u.fuente_alias.startsWith("http")) {
        const fName = `RKUCFont_${userId.slice(0, 8)}`;
        if (![...document.fonts].find(f => f.family === fName)) {
          const face = new FontFace(fName, `url(${u.fuente_alias})`);
          await face.load(); document.fonts.add(face);
        }
        card.querySelector(".rkw-uc-alias").style.fontFamily = `'${fName}','RKMontserrat','Gliker',sans-serif`;
      } else {
        card.querySelector(".rkw-uc-alias").style.fontFamily = `'${u.fuente_alias}','RKMontserrat','Gliker',sans-serif`;
      }
    } catch (e) { }
  }

  // Posicionamiento
  const rect = btn.getBoundingClientRect();
  card.style.left = `${rect.left}px`;
  card.style.bottom = `${window.innerHeight - rect.top + 10}px`;

  card.querySelector("#pcEditBtn").onclick = () => window.location.href = "personalization.html";
  card.querySelector("#pcLogoutBtn").onclick = async () => { await supabaseClient.auth.signOut(); window.location.href = "login.html"; };

  const closePc = (e) => {
    if (profileCardEl && !profileCardEl.contains(e.target) && !btn.contains(e.target)) {
      profileCardEl.remove(); profileCardEl = null;
      document.removeEventListener("click", closePc);
    }
  };
  setTimeout(() => document.addEventListener("click", closePc), 0);
};

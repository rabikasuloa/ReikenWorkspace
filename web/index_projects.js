// ==========================
// INDEX PROJECT PAGE
// ==========================
(function () {
  if (!document.getElementById("ipProjectTitle")) return;

  const sb = supabaseClient;

  // ── Leer proyecto_id de la URL ────────────
  const params    = new URLSearchParams(window.location.search);
  const projectId = params.get("id");
  if (!projectId) {
    window.location.href = "projects.html";
    return;
  }

  // ── Elementos DOM ─────────────────────────
  const ipProjectTitle   = document.getElementById("ipProjectTitle");
  const ipProjectIcon    = document.getElementById("ipProjectIcon");
  const ipWelcomeText    = document.getElementById("ipWelcomeText");
  const ipWelcomeAlias   = document.getElementById("ipWelcomeAlias");
  const ipWelcomeAvatar  = document.getElementById("ipWelcomeAvatarImg");
  const sidebarAvatarImg = document.getElementById("sidebarAvatarImg");
  const sidebarAlias     = document.getElementById("sidebarAlias");
  const backBtn          = document.getElementById("backBtn");
  const sidebarToggle    = document.getElementById("sidebarToggle");
  const sidebar          = document.getElementById("sidebar");

  // Storyboarding
  const bodyStoryboarding    = document.getElementById("bodyStoryboarding");
  const emptyStoryboarding   = document.getElementById("emptyStoryboarding");
  const btnNuevoStoryboard   = document.getElementById("btnNuevoStoryboard");
  const modalNuevaEscena     = document.getElementById("modalNuevaEscena");
  const closeModalEscena     = document.getElementById("closeModalEscena");
  const cancelModalEscena    = document.getElementById("cancelModalEscena");
  const saveEscenaBtn        = document.getElementById("saveEscenaBtn");
  const escenaTitulo         = document.getElementById("escenaTitulo");
  const escenaDesc           = document.getElementById("escenaDesc");
  const escenaBanner         = document.getElementById("escenaBanner");
  const escenaBannerBox      = document.getElementById("escenaBannerBox");
  const escenaBannerPreview  = document.getElementById("escenaBannerPreview");
  const escenaBannerHint     = document.getElementById("escenaBannerHint");

  // WorldBuilding
  const bodyWorldbuilding    = document.getElementById("bodyWorldbuilding");
  const emptyWorldbuilding   = document.getElementById("emptyWorldbuilding");
  const btnNuevoConcepto     = document.getElementById("btnNuevoConcepto");
  const modalNuevoConcepto   = document.getElementById("modalNuevoConcepto");
  const closeModalConcepto   = document.getElementById("closeModalConcepto");
  const cancelModalConcepto  = document.getElementById("cancelModalConcepto");
  const saveConceptoBtn      = document.getElementById("saveConceptoBtn");
  const conceptoTitulo       = document.getElementById("conceptoTitulo");
  const conceptoIconBox      = document.getElementById("conceptoIconBox");
  const conceptoIconInput    = document.getElementById("conceptoIconInput");
  const conceptoIconPreview  = document.getElementById("conceptoIconPreview");
  const worldDesc            = document.getElementById("worldDesc");
  const worldBanner          = document.getElementById("worldBanner");
  const worldBannerBox       = document.getElementById("worldBannerBox");
  const worldBannerPreview   = document.getElementById("worldBannerPreview");
  const worldBannerHint      = document.getElementById("worldBannerHint");

  // Panel derecho
  const ipConceptTree        = document.getElementById("ipConceptTree");
  const rpExpandBtn          = document.getElementById("rpExpandBtn");
  const ipRightPanel         = document.getElementById("ipRightPanel");
  const ipSearch             = document.getElementById("ipSearch");

  // Colapsar columnas
  const colStoryboarding     = document.getElementById("colStoryboarding");
  const colWorldbuilding     = document.getElementById("colWorldbuilding");
  const colPlanning          = document.getElementById("colPlanning");

  // Planificación
  const bodyPlanning          = document.getElementById("bodyPlanning");
  const emptyPlanning         = document.getElementById("emptyPlanning");
  const btnNuevaTemporada     = document.getElementById("btnNuevaTemporada");
  const modalNuevaTemporada   = document.getElementById("modalNuevaTemporada");
  const closeModalSeason     = document.getElementById("closeModalSeason");
  const cancelModalSeason    = document.getElementById("cancelModalSeason");
  const saveSeasonBtn        = document.getElementById("saveSeasonBtn");
  const deleteSeasonBtn      = document.getElementById("deleteSeasonBtn");
  const seasonTitle          = document.getElementById("seasonTitle");
  const seasonDesc           = document.getElementById("seasonDesc");
  const modalSeasonTitleText = document.getElementById("modalSeasonTitleText");

  let editingSeasonId = null;
  let seasonsData = [];

  // Notificaciones y Anuncios
  const btnNotificaciones    = document.getElementById("btnNotificaciones");
  const notiDot              = document.getElementById("notiDot");
  const panelNotificaciones  = document.getElementById("panelNotificaciones");
  const listaNotificaciones  = document.getElementById("listaNotificaciones");
  const closeNotiPanel       = document.getElementById("closeNotiPanel");
  
  const btnAbrirPublicar     = document.getElementById("btnAbrirPublicar");
  const modalPublicarAnuncio = document.getElementById("modalPublicarAnuncio");
  const closeModalAnuncio    = document.getElementById("closeModalAnuncio");
  const cancelModalAnuncio   = document.getElementById("cancelModalAnuncio");
  const enviarAnuncioBtn     = document.getElementById("enviarAnuncioBtn");
  const anuncioTexto         = document.getElementById("anuncioTexto");
  
  // Sticker Panel
  const ipStickerPanel       = document.getElementById("ipStickerPanel");
  const ipStickerGrid        = document.getElementById("ipStickerGrid");
  const closeIpSticker       = document.getElementById("closeIpSticker");
  const btnStickerAnuncio     = document.getElementById("btnStickerAnuncio");



  // Sidebar Buttons
  const appearanceBtn        = document.getElementById("appearanceBtn");
  const configBtn            = document.getElementById("configBtn");
  const profileBtn           = document.getElementById("profileBtn");

  // Estado
  let seccionSBId   = null; // id de la sección storyboarding de este proyecto
  let seccionWBId   = null; // id de la sección worldbuilding
  let plantillaSelId = null;
  let conceptoIconDataURL = null;
  let conceptosCache = []; // para el árbol del panel derecho
  let currentUser   = null;
  let worldTemplateId = null;
  let worldBannerDataURL = null;
  let activeStickerTarget = null; // "anuncio" o un ID de anuncio (para comentario)
  let visibleCommentsCount = {}; // { anuncioId: 0 }



  let escenaBannerDataURL = null;
  let userRole      = "Empleado"; // Default role


  // ── Sidebar toggle ───────────────────────
  sidebarToggle?.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

  // ── Volver a projects ────────────────────
  backBtn?.addEventListener("click", () => window.location.href = "projects.html");

  // ── Panel derecho: expandir/colapsar ─────
  rpExpandBtn?.addEventListener("click", () => {
    ipRightPanel.classList.toggle("expanded");
    rpExpandBtn.textContent = ipRightPanel.classList.contains("expanded") ? "✕" : "⛶";
  });

  // ── Colapsar columnas ────────────────────
  document.querySelectorAll(".ip-col-collapse-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const collapsed = target.classList.toggle("collapsed");
      btn.textContent = collapsed
        ? (btn.dataset.target === "colStoryboarding" ? "⟩" : "⟨")
        : (btn.dataset.target === "colStoryboarding" ? "⟨" : "⟩");
    });
  });

  // ── Notificaciones y Anuncios ────────────
  btnNotificaciones?.addEventListener("click", () => {
    window.ANIM.toggle(panelNotificaciones, 'anim-slide-up', 'anim-slide-down-out');
    if (!panelNotificaciones.classList.contains("hidden")) {
      window.ANIM.hide(notiDot, 'anim-fade-out');
      loadAnuncios();
    }
  });

  // ── Drag & Resize Noti ────────────────────
  let lastAnuncioData = null; // Cache to prevent redundant full re-renders

  function wireDragNoti(panel) {

    const header = panel.querySelector(".ip-noti-header");
    let dragging = false, ox = 0, oy = 0;
    
    header.addEventListener("mousedown", e => {
      if (e.target.closest("button")) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      panel.style.transition = "none";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      panel.style.left = (e.clientX - ox) + "px";
      panel.style.top = (e.clientY - oy) + "px";
      panel.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      panel.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    });
  }

  function wireResizeNoti(panel) {
    const handle = document.getElementById("notiResize");
    let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
    
    handle.addEventListener("mousedown", e => {
      resizing = true;
      sx = e.clientX; sy = e.clientY;
      sw = panel.offsetWidth; sh = panel.offsetHeight;
      panel.style.transition = "none";
      e.preventDefault();
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", e => {
      if (!resizing) return;
      panel.style.width = Math.max(300, sw + (e.clientX - sx)) + "px";
      panel.style.height = Math.max(200, sh + (e.clientY - sy)) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.userSelect = "";
      panel.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    });
  }


  closeNotiPanel?.addEventListener("click", () => window.ANIM.hide(panelNotificaciones, 'anim-slide-down-out'));

  btnAbrirPublicar?.addEventListener("click", () => {
    anuncioTexto.value = "";
    window.ANIM.show(modalPublicarAnuncio, 'anim-modal-in');
  });

  closeModalAnuncio?.addEventListener("click", () => window.ANIM.hide(modalPublicarAnuncio, 'anim-modal-out'));
  cancelModalAnuncio?.addEventListener("click", () => window.ANIM.hide(modalPublicarAnuncio, 'anim-modal-out'));
  modalPublicarAnuncio?.addEventListener("click", (e) => {
    if (e.target === modalPublicarAnuncio) window.ANIM.hide(modalPublicarAnuncio, 'anim-modal-out');
  });

  enviarAnuncioBtn?.addEventListener("click", async () => {
    const texto = anuncioTexto.value.trim();
    if (!texto) return;

    enviarAnuncioBtn.disabled = true;
    enviarAnuncioBtn.textContent = "Publicando...";

    try {
      const { error } = await sb.from("anuncios").insert({
        user_id: currentUser.id,
        contenido: texto
      });
      if (error) throw error;

      window.ANIM.hide(modalPublicarAnuncio, 'anim-modal-out');
      showToast("✔ Anuncio publicado para todos");
    } catch (err) {
      showToast("✖ Error al publicar: " + err.message, "error");
    } finally {
      enviarAnuncioBtn.disabled = false;
      enviarAnuncioBtn.textContent = "¡PUBLICAR!";
    }
  });




  // ── INIT ─────────────────────────────────
  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user;
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user;

    // Inyectar modales modulares
    if (window.injectAppearanceModal) window.injectAppearanceModal();
    if (window.injectConfigModal) window.injectConfigModal();

    // Wire Sidebar Buttons
    appearanceBtn?.addEventListener("click", () => {
      window.ANIM.show(document.getElementById("appearanceModal"), 'anim-modal-in');
    });
    configBtn?.addEventListener("click", () => {
      window.ANIM.show(document.getElementById("configModal"), 'anim-modal-in');
    });
    profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.toggleProfileCard) window.toggleProfileCard(profileBtn);
    });

    await Promise.all([
      loadProject(),
      loadUserProfile(),
      loadPlantillas(),
      fetchAnuncioStickers(),
    ]);

    await loadSecciones();
    window.__initShortcuts?.(projectId, goToShortcut);
    subscribeAnuncios();
    subscribeComentarios();
    checkUnreadAnuncios();
    wireDragNoti(panelNotificaciones);
    wireResizeNoti(panelNotificaciones);
    wireStickerPanelForAnuncios();
    initExportImport();
    // setupSeasonEvents();

    // Hover sounds for sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('mouseenter', playSidebarHoverSound);
    });

    // Iniciar actualizador automático de Electron
    initAutoUpdater();
  }

  let globalStickers = [];
  async function fetchAnuncioStickers() {
    const { data } = await sb.from("stickers_global").select("url");
    globalStickers = data || [];
  }

  function wireStickerPanelForAnuncios() {
    closeIpSticker?.addEventListener("click", () => window.ANIM.hide(ipStickerPanel, 'anim-fade-out'));
    btnStickerAnuncio?.addEventListener("click", () => {
      activeStickerTarget = "anuncio";
      openStickerGrid();
    });
  }

  function openStickerGrid() {
    ipStickerGrid.innerHTML = "";
    globalStickers.forEach(s => {
      const img = document.createElement("img");
      img.src = s.url;
      img.onclick = () => {
        if (activeStickerTarget === "anuncio") {
          anuncioTexto.value += `[sticker:${s.url}]`;
        } else {
          const input = document.getElementById(`input-comment-${activeStickerTarget}`);
          if (input) input.value += `[sticker:${s.url}]`;
        }
          window.ANIM.hide(ipStickerPanel, 'anim-fade-out');
      };
      ipStickerGrid.appendChild(img);
    });
    window.ANIM.show(ipStickerPanel, 'anim-fade-in');
  }

  function subscribeComentarios() {
    sb.channel("global-comentarios")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anuncios_comentarios" }, payload => {
        const c = payload.new;
        const container = document.getElementById(`comments-list-${c.anuncio_id}`);
        if (container) loadComentarios(c.anuncio_id);
      })
      .subscribe();
  }





  // ── Cargar datos del proyecto ─────────────
  async function loadProject() {
    const { data: p } = await sb.from("proyectos").select("*").eq("id", projectId).single();
    if (!p) { window.location.href = "projects.html"; return; }

    ipProjectTitle.textContent = p.nombre || "Proyecto";
    if (p.icono_url) {
      ipProjectIcon.src = p.icono_url;
      ipProjectIcon.style.display = "block";
    } else {
      ipProjectIcon.style.display = "none";
    }
  }

  // ── Perfil del usuario ────────────────────
  async function loadUserProfile() {
    // A. Cargar datos básicos de perfil (Inmediato vía RKCore)
    const u = await window.RKCore.loadGlobalProfile();
    const alias = u?.alias || "Usuario";

    // B. Lógica específica del Dashboard (Mensaje de bienvenida con Proyecto)
    try {
      const { data: p } = await sb.from("proyectos").select("nombre").eq("id", projectId).single();
      if (ipWelcomeText && p) {
        ipWelcomeText.textContent = `¿Qué queremos hacer con ${p.nombre} hoy, ${alias}?`;
      }
    } catch (e) {}

    // Cargar Rol
    const { data: roles } = await sb.from("usuario_roles")
      .select("roles(nombre)")
      .eq("user_id", currentUser.id);
    
    if (roles && roles.length > 0) {
      // Priorizar CEO si tiene varios roles
      const isCEO = roles.some(r => r.roles?.nombre === "CEO");
      userRole = isCEO ? "CEO" : (roles[0].roles?.nombre || "Empleado");
    }

    if (userRole === "CEO") {
      window.ANIM.show(btnAbrirPublicar, 'anim-fade-in');
    }
  }

  // ── Anuncios Realtime ────────────────────
  function subscribeAnuncios() {
    sb.channel("global-anuncios")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anuncios" }, payload => {
        const nuevo = payload.new;
        if (nuevo.user_id !== currentUser.id) {
          window.ANIM.show(notiDot, 'anim-fade-in');
          playNotiSound();
          showToast("📢 Nuevo anuncio de la directiva");
        }
        if (!panelNotificaciones.classList.contains("hidden")) {
          loadAnuncios();
          saveLastSeenAnuncio(nuevo.id);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "anuncios" }, () => {
        if (!panelNotificaciones.classList.contains("hidden")) loadAnuncios();
      })
      .subscribe();
  }


  async function checkUnreadAnuncios() {
    const { data } = await sb.from("anuncios")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      const lastId = data[0].id;
      const seenId = localStorage.getItem("rk_last_seen_anuncio");
      if (seenId !== lastId) {
        window.ANIM.show(notiDot, 'anim-fade-in');
      }
    }
  }

  function saveLastSeenAnuncio(id) {
    if (id) localStorage.setItem("rk_last_seen_anuncio", id);
  }

  async function loadAnuncios(silent = false) {
    if (!silent) {
      listaNotificaciones.innerHTML = `
        <div class="ip-skeleton-item"></div>
        <div class="ip-skeleton-item" style="width: 80%"></div>
        <div class="ip-skeleton-item"></div>
      `;
    }

    const { data, error } = await sb.from("anuncios")
      .select(`
        *, 
        usuarios(id, alias, color_alias, foto_url, fuente_alias),
        comentarios_count:anuncios_comentarios(count)
      `)
      .order("created_at", { ascending: false })
      .limit(15);
    
    if (error) {
      console.error("Error cargando anuncios:", error);
      if (!silent) listaNotificaciones.innerHTML = `<p style="text-align:center;color:rgba(255,100,100,0.5);padding:20px">Error al cargar anuncios</p>`;
      return;
    }

    // Prevención de re-render innecesario
    const dataStr = JSON.stringify(data);
    if (dataStr === lastAnuncioData) return;
    lastAnuncioData = dataStr;

    if (data && data.length > 0) {
      saveLastSeenAnuncio(data[0].id);
    }

    if (!data || data.length === 0) {

      listaNotificaciones.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;font-size:0.9rem">No hay anuncios nuevos ✨</p>`;
      return;
    }

    listaNotificaciones.innerHTML = "";
    for (const a of data) {
      const item = document.createElement("div");
      item.className = "ip-noti-item";
      const u = a.usuarios || {};
      const fecha = new Date(a.created_at).toLocaleString("es-ES", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      
      const fontName = u.fuente_alias ? `UserFont_${u.id}`.replace(/[^a-zA-Z0-9]/g, "_") : "'Etna', sans-serif";
      if (u.fuente_alias) {
        if (!document.getElementById(`style_${u.id}`)) {
          const style = document.createElement("style");
          style.id = `style_${u.id}`;
          style.textContent = `@font-face { font-family: "${fontName}"; src: url("${u.fuente_alias}"); }`;
          document.head.appendChild(style);
        }
      }

      const avatarHtml = u.foto_url 
        ? `<img src="${u.foto_url}" class="ip-noti-avatar" alt="">`
        : `<div class="ip-noti-avatar" style="background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;color:white">${(u.alias || "?")[0]}</div>`;

      const isOwner = a.user_id === currentUser.id;
      const deleteBtnHtml = isOwner ? `<button class="noti-delete-btn" title="Borrar anuncio">✕</button>` : "";
      const totalComments = a.comentarios_count?.[0]?.count || 0;

      item.innerHTML = `
        <div class="ip-noti-user-row">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            ${avatarHtml}
            <div class="noti-user" style="color:${u.color_alias || '#db6f4e'}; font-family:${fontName}">${u.alias || 'CEO'}</div>
          </div>
          ${deleteBtnHtml}
        </div>
        <div class="noti-content">${parseAnuncioText(a.contenido)}</div>
        <div class="noti-time">${fecha}</div>
        
        <div class="noti-comments-section">
          <div id="comments-list-${a.id}" class="comments-list"></div>
          <div id="comments-controls-${a.id}" class="comments-controls"></div>
          
          <div class="noti-comment-input-row">
            <input type="text" class="noti-comment-input" id="input-comment-${a.id}" placeholder="Escribe un comentario..." autocomplete="off">
            <button class="noti-comment-btn-sticker" id="btn-sticker-${a.id}">🎞️</button>
          </div>
        </div>
      `;

      if (isOwner) {
        item.querySelector(".noti-delete-btn").onclick = () => borrarAnuncio(a.id);
      }


      listaNotificaciones.appendChild(item);
      
      // Wire Comentario
      const input = item.querySelector(`#input-comment-${a.id}`);
      input.onkeydown = e => { 
        if (e.key === "Enter") {
          enviarComentario(a.id, input.value);
        }
      };
      
      const stickerBtn = item.querySelector(`#btn-sticker-${a.id}`);
      stickerBtn.onclick = (e) => { 
        e.stopPropagation();
        activeStickerTarget = a.id; 
        openStickerGrid(stickerBtn); 
      };

      // Si ya teníamos expandido este anuncio, recargar comentarios
      if (visibleCommentsCount[a.id] > 0) {
        loadComentarios(a.id);
      } else if (totalComments > 0) {
        renderComentariosInitialButton(a.id, totalComments);
      }
    }
  }

  function parseAnuncioText(text) {
    const safe = escapeHtml(text);
    // [sticker:url]
    return safe.replace(/\[sticker:(https?:\/\/.+?)\]/g, '<img src="$1" class="noti-sticker">');
  }

  function renderComentariosInitialButton(anuncioId, count) {
    const ctrls = document.getElementById(`comments-controls-${anuncioId}`);
    if (!ctrls) return;
    ctrls.innerHTML = `
      <button class="btn-comments-more" style="margin-top:10px">
        Ver comentarios (${count})
      </button>
    `;
    ctrls.querySelector("button").onclick = () => {
      visibleCommentsCount[anuncioId] = 10;
      loadComentarios(anuncioId);
    };
  }

  async function loadComentarios(anuncioId) {
    const listContainer = document.getElementById(`comments-list-${anuncioId}`);
    const controlsContainer = document.getElementById(`comments-controls-${anuncioId}`);
    if (!listContainer || !controlsContainer) return;

    if (visibleCommentsCount[anuncioId] === undefined) visibleCommentsCount[anuncioId] = 0;
    const limit = visibleCommentsCount[anuncioId];

    // Solo cargamos si el limit > 0
    if (limit === 0) return;

    // Mostrar loader pequeño en comentarios
    if (listContainer.innerHTML === "") {
      listContainer.innerHTML = `<div class="ip-skeleton-item" style="height:40px; margin: 10px 0"></div>`;
    }

    const { data, count, error } = await sb.from("anuncios_comentarios")
      .select("*, usuarios(id, alias, foto_url, color_alias)", { count: 'exact' })
      .eq("anuncio_id", anuncioId)
      .order("created_at", { ascending: true })
      .limit(limit);
    
    if (error || !data) return;
    
    listContainer.innerHTML = "";
    data.forEach(c => {
      const u = c.usuarios || {};
      const div = document.createElement("div");
      div.className = "noti-comment-item ip-fade-in";
      
      const avatarHtml = u.foto_url 
        ? `<img src="${u.foto_url}" class="noti-comment-avatar" alt="">`
        : `<div class="noti-comment-avatar" style="background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;color:white">${(u.alias || "?")[0]}</div>`;

      div.innerHTML = `
        ${avatarHtml}
        <div class="noti-comment-body">
          <div class="comment-user" style="color:${u.color_alias || '#fff'}">${u.alias || 'Usuario'}</div>
          <div class="comment-text">${parseAnuncioText(c.contenido)}</div>
        </div>
      `;
      listContainer.appendChild(div);
    });

    // Controles
    controlsContainer.innerHTML = "";
    if (count > limit) {
      const btnMore = document.createElement("button");
      btnMore.className = "btn-comments-more";
      btnMore.textContent = `Ver más comentarios (${count - limit} más)`;
      btnMore.onclick = () => {
        visibleCommentsCount[anuncioId] += 10;
        loadComentarios(anuncioId);
      };
      controlsContainer.appendChild(btnMore);
    }

    if (limit > 0) {
      const btnLess = document.createElement("button");
      btnLess.className = "btn-comments-less";
      btnLess.textContent = "Colapsar";
      btnLess.onclick = () => {
        visibleCommentsCount[anuncioId] = 0;
        listContainer.innerHTML = "";
        renderComentariosInitialButton(anuncioId, count);
      };
      controlsContainer.appendChild(btnLess);
    }
  }



  async function enviarComentario(anuncioId, texto) {
    if (!texto.trim()) return;
    const input = document.getElementById(`input-comment-${anuncioId}`);
    input.value = "";
    input.disabled = true;

    const { error } = await sb.from("anuncios_comentarios").insert({
      anuncio_id: anuncioId,
      user_id: currentUser.id,
      contenido: texto
    });

    input.disabled = false;
    if (error) {
      showToast("Error al comentar");
    } else {
      loadComentarios(anuncioId);
    }
  }

  async function borrarAnuncio(id) {
    if (!confirm("¿Seguro que quieres borrar este anuncio y todos sus comentarios?")) return;
    
    const { error } = await sb.from("anuncios").delete().eq("id", id);
    if (error) {
      showToast("No tienes permisos o hubo un error al borrar");
    } else {
      showToast("Anuncio eliminado");
      loadAnuncios();
    }
  }




  function playNotiSound() { window.RKSound?.play('noti'); }
  function playSidebarHoverSound() { window.RKSound?.play('hover'); }

  function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
  }


  // --- CACHE HELPER ---
  function getPrefetchCache() {
    return window.RKCache.get(`prefetch_p_${projectId}`);
  }

  let skipRemoteLoad = false;

  // ── Cargar/crear secciones del proyecto ───
  async function loadSecciones() {
    const cache = getPrefetchCache();
    let secciones = [];

    if (cache && cache.sections?.length > 0) {
      console.log("⚡ Loading sections from cache");
      secciones = cache.sections;
      skipRemoteLoad = true;
    } else {
      const { data } = await sb.from("secciones").select("*").eq("proyecto_id", projectId);
      secciones = data || [];
    }

    const sb_sec = secciones?.find(s => s.tipo === "storyboarding");
    const wb_sec = secciones?.find(s => s.tipo === "worldbuilding");

    // Storyboarding Section
    if (!sb_sec) {
      const { data } = await sb.from("secciones").insert({ proyecto_id: projectId, tipo: "storyboarding" }).select().single();
      seccionSBId = data?.id;
      skipRemoteLoad = false; // Need to fetch because we just created it
    } else { seccionSBId = sb_sec.id; }

    // Worldbuilding Section
    if (!wb_sec) {
      const { data } = await sb.from("secciones").insert({ proyecto_id: projectId, tipo: "worldbuilding" }).select().single();
      seccionWBId = data?.id;
      skipRemoteLoad = false;
    } else { seccionWBId = wb_sec.id; }

    if (skipRemoteLoad && cache) {
      // Immediate load from cache
      console.log("⚡ Immediate load from cache: Escenas/Conceptos");
      
      // Load Escenas
      if (cache.storyboards) {
        if (cache.storyboards.length === 0) {
          emptyStoryboarding.style.display = "flex";
        } else {
          emptyStoryboarding.style.display = "none";
          Array.from(bodyStoryboarding.querySelectorAll(".ip-escena-card")).forEach(el => el.remove());
          cache.storyboards.forEach(e => renderEscenaCard(e));
        }
      }

      // Load Conceptos
      if (cache.concepts) {
        conceptosCache = cache.concepts;
        renderWorldbuildingList();
        renderConceptTree(conceptosCache);
      }

      // Background silent refresh to ensure sync
      setTimeout(() => {
        loadEscenas(true);
        loadConceptos(true);
        runDeepWarmup();
      }, 1500);
    } else {
      await Promise.all([ loadEscenas(), loadConceptos() ]);
      runDeepWarmup();
    }
  }

  /**
   * MASSIVE DEEP WARMUP
   * Descarga todos los bloques y relaciones del proyecto activo
   */
  async function runDeepWarmup() {
    if (!seccionWBId || !conceptosCache.length) return;
    console.log("🔥 Starting Deep Warmup for current project...");
    
    try {
      const cIds = conceptosCache.map(c => c.id);
      
      // 1. Fetch ALL contents for these concepts
      const { data: contents } = await sb.from('contenidos')
        .select('id, titulo')
        .in('titulo', cIds)
        .eq('tipo_plantilla', 'wb_concepto');
        
      if (contents?.length) {
        const contentIds = contents.map(c => c.id);
        const { data: blocks } = await sb.from('bloques').select('*').in('contenido_id', contentIds).order('orden', { ascending: true });
        
        if (blocks) {
          const blocksByConcept = {};
          contents.forEach(ct => {
            blocksByConcept[ct.titulo] = blocks.filter(b => b.contenido_id === ct.id);
          });
          window.RKCache.save(`deep_blocks_${projectId}`, blocksByConcept, 45);
        }
      }

      // 2. Fetch ALL relations for this project (using Wb Section ID as worldId proxy)
      const { data: rels } = await sb.from('concepto_relaciones')
        .select('*')
        .in('concepto_origen_id', cIds); // Fetches all starting from our concepts
        
      if (rels) {
        const relsByConcept = { from: {}, to: {} };
        rels.forEach(r => {
          if (!relsByConcept.from[r.concepto_origen_id]) relsByConcept.from[r.concepto_origen_id] = [];
          relsByConcept.from[r.concepto_origen_id].push(r);
          
          if (!relsByConcept.to[r.concepto_destino_id]) relsByConcept.to[r.concepto_destino_id] = [];
          relsByConcept.to[r.concepto_destino_id].push(r);
        });
        window.RKCache.save(`deep_rels_${projectId}`, relsByConcept, 45);
      }

      // 3. Fetch ALL scenes for ALL storyboards in this project
      const { data: sbs } = await sb.from('storyboards').select('id').eq('proyecto_id', projectId);
      if (sbs?.length) {
        const sbIds = sbs.map(s => s.id);
        const { data: allEscenas } = await sb.from('escenas').select('*').in('storyboard_id', sbIds).order('orden', { ascending: true });
        if (allEscenas) {
          sbIds.forEach(sid => {
            const scs = allEscenas.filter(e => e.storyboard_id === sid);
            window.RKCache.save(`deep_scenes_${sid}`, scs, 45);
          });
        }
      }
      
      console.log("💎 Deep Warmup complete.");
    } catch (e) {
      console.warn("⚠️ Deep Warmup failed:", e);
    }
  }

  // ══════════════════════════════════════════
  // PLANIFICACIÓN — Temporadas / Seasons
  // ══════════════════════════════════════════
  async function loadPlanningData() {
    try {
      const plan = await window.RKPlanning.load(projectId);
      seasonsData = plan.seasons || [];
      
      // Limpiar anteriores
      Array.from(bodyPlanning.querySelectorAll(".ip-escena-card")).forEach(el => el.remove());
      
      if (seasonsData.length === 0) {
        emptyPlanning.style.display = "flex";
        return;
      }
      emptyPlanning.style.display = "none";
      
      seasonsData.forEach(s => renderSeasonCard(s, plan));
    } catch (e) {
      console.error("Error cargando planificación:", e);
      emptyPlanning.style.display = "flex";
    }
  }

  function renderSeasonCard(season, plan) {
    const card = document.createElement("div");
    card.className = "ip-escena-card";
    card.dataset.id = season.id;
    
    // Contar episodios de esta temporada
    const epsCount = plan.episodes ? plan.episodes.filter(e => e.season_id === season.id).length : 0;
    const plotsCount = plan.plotlines ? plan.plotlines.filter(p => p.season_id === season.id).length : 0;
    
    card.innerHTML = `
      <button class="ip-card-edit" data-action="edit-season" title="Editar">
        <img src="icons/iconos/editar.png" alt="editar" onerror="this.style.display='none';this.parentElement.textContent='✏'">
      </button>
      <div class="ip-escena-preview" style="background: linear-gradient(135deg, rgba(219,111,78,0.2) 0%, rgba(155,93,229,0.2) 100%); display:flex; align-items:center; justify-content:center;">
        <span style="font-size: 2.2rem;">📅</span>
      </div>
      <div class="ip-escena-info">
        <h3 class="ip-escena-titulo">${season.nombre || "Sin título"}</h3>
        <p class="ip-escena-desc">${season.descripcion || ""}</p>
        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-top: 6px; display: flex; gap: 12px;">
          <span>🎬 ${epsCount} Episodios</span>
          <span>📈 ${plotsCount} Tramas</span>
        </div>
      </div>
    `;
    
    card.querySelector('[data-action="edit-season"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openSeasonModal(season);
    });
    
    card.addEventListener("click", () => {
      window.location.href = `planning.html?project_id=${projectId}&season_id=${season.id}`;
    });
    
    bodyPlanning.insertBefore(card, emptyPlanning);
  }

  function openSeasonModal(season = null) {
    if (season) {
      editingSeasonId = season.id;
      modalSeasonTitleText.textContent = "Editar Temporada";
      seasonTitle.value = season.nombre || "";
      seasonDesc.value = season.descripcion || "";
      window.ANIM.show(deleteSeasonBtn, 'anim-fade-in');
    } else {
      editingSeasonId = null;
      modalSeasonTitleText.textContent = "Nueva Temporada";
      seasonTitle.value = "";
      seasonDesc.value = "";
      window.ANIM.hide(deleteSeasonBtn, 'anim-fade-out');
    }
    window.ANIM.show(modalNuevaTemporada, 'anim-modal-in');
  }

  function setupSeasonEvents() {
    btnNuevaTemporada?.addEventListener("click", () => openSeasonModal());
    
    const close = () => window.ANIM.hide(modalNuevaTemporada, 'anim-modal-out');
    closeModalSeason?.addEventListener("click", close);
    cancelModalSeason?.addEventListener("click", close);
    modalNuevaTemporada.addEventListener("click", (e) => { if (e.target === modalNuevaTemporada) close(); });
    
    saveSeasonBtn?.addEventListener("click", async () => {
      const title = seasonTitle.value.trim();
      if (!title) {
        showToast("El nombre de la temporada es obligatorio", "error");
        return;
      }
      
      saveSeasonBtn.disabled = true;
      try {
        await window.RKPlanning.saveSeason(projectId, {
          id: editingSeasonId,
          nombre: title,
          descripcion: seasonDesc.value.trim()
        });
        showToast("Temporada guardada correctamente ✨");
        close();
        await loadPlanningData();
      } catch (err) {
        showToast("Error al guardar temporada: " + err.message, "error");
      } finally {
        saveSeasonBtn.disabled = false;
      }
    });

    deleteSeasonBtn?.addEventListener("click", async () => {
      if (!editingSeasonId) return;
      if (!confirm("¿Estás seguro de que deseas eliminar esta temporada y toda su planificación asociada? Esta acción es irreversible.")) return;
      
      deleteSeasonBtn.disabled = true;
      try {
        await window.RKPlanning.deleteSeason(projectId, editingSeasonId);
        showToast("Temporada eliminada.");
        close();
        await loadPlanningData();
      } catch (err) {
        showToast("Error al eliminar temporada: " + err.message, "error");
      } finally {
        deleteSeasonBtn.disabled = false;
      }
    });
  }

  // ══════════════════════════════════════════
  // STORYBOARDING — Storyboards
  // ══════════════════════════════════════════
  async function loadEscenas(silent = false) {
    if (skipRemoteLoad && !silent) return;

    const { data: storyboardsObj } = await sb.from("storyboards")
      .select("*")
      .eq("proyecto_id", projectId)
      .order("orden", { ascending: true });

    if (!storyboardsObj || storyboardsObj.length === 0) {
      emptyStoryboarding.style.display = "flex";
      return;
    }
    emptyStoryboarding.style.display = "none";
    // limpiar cards anteriores
    Array.from(bodyStoryboarding.querySelectorAll(".ip-escena-card")).forEach(el => el.remove());
    storyboardsObj.forEach(e => renderEscenaCard(e));

    // Update cache if we loaded fresh data
    const existing = getPrefetchCache() || { timestamp: Date.now(), expires: Date.now() + 1800000 };
    existing.storyboards = storyboardsObj;
    localStorage.setItem(`rk_prefetch_${projectId}`, JSON.stringify(existing));
  }

  function storyboardMetaKey(id) { return `rk_storyboard_meta_${id}`; }
  function getStoryboardMeta(id) {
    try { return JSON.parse(localStorage.getItem(storyboardMetaKey(id)) || "{}"); }
    catch { return {}; }
  }
  function setStoryboardMeta(id, meta) {
    localStorage.setItem(storyboardMetaKey(id), JSON.stringify(meta || {}));
  }

  function renderEscenaCard(escena) {
    // "escena" = storyboard en este MVP (tabla storyboards)
    const card = document.createElement("div");
    card.className = "ip-escena-card";
    card.dataset.id = escena.id;
    card.innerHTML = `
      <button class="ip-card-edit" data-action="edit-storyboard" title="Editar">
        <img src="icons/iconos/editar.png" alt="editar" onerror="this.style.display='none';this.parentElement.textContent='✏'">
      </button>
      <div class="ip-escena-preview">
        ${escena.banner_url ? `<img src="${escena.banner_url}" alt="">` : ""}
      </div>
      <div class="ip-escena-info">
        <h3 class="ip-escena-titulo">${escena.titulo || "Sin título"}</h3>
        <p class="ip-escena-desc">${escena.descripcion || ""}</p>
      </div>
    `;
    card.querySelector('[data-action="edit-storyboard"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditStoryboardModal(escena);
    });
    card.addEventListener("click", () => {
      window.location.href = "storyboard.html?id=" + escena.id;
    });
    bodyStoryboarding.insertBefore(card, emptyStoryboarding);
  }

  // ══════════════════════════════════════════
  // EDITAR / ELIMINAR — STORYBOARD (tabla escenas)
  // ══════════════════════════════════════════
  function ensureEditStoryboardModal() {
    if (document.getElementById("editStoryboardModal")) return;

    const m = document.createElement("div");
    m.id = "editStoryboardModal";
    m.className = "modal-overlay hidden";
    m.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2>Editar Storyboard</h2>
          <button class="modal-close" id="closeEditStoryboardModal">✕</button>
        </div>

        <input id="editStoryboardTitle" type="text" placeholder="Título..." class="modal-input">
        <textarea id="editStoryboardDesc" placeholder="Descripción (opcional)..." class="modal-textarea" rows="3"></textarea>

        <div class="modal-file-box" id="editStoryboardBannerBox" title="Cambiar banner">
          <div class="modal-file-left">
            <div class="modal-file-thumb">
              <img id="editStoryboardBannerPreview" src="" alt="banner">
            </div>
            <div class="modal-file-meta">
              <p class="modal-file-title">Banner</p>
              <p class="modal-file-hint" id="editStoryboardBannerHint">Haz clic para subir imagen (opcional)</p>
            </div>
          </div>
          <div class="modal-file-action">+</div>
        </div>
        <input id="editStoryboardBannerInput" type="file" accept="image/*" hidden>

        <div class="modal-footer" style="justify-content:space-between">
          <button class="button-delete" id="deleteStoryboardBtn">🗑 Eliminar storyboard</button>
          <div style="display:flex;gap:10px">
            <button class="button-secondary" id="cancelEditStoryboardModal">Cancelar</button>
            <button class="button-main modal-save-btn" id="saveEditStoryboardBtn">¡HECHO!</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    const close = () => window.ANIM.hide(m, 'anim-modal-out');
    document.getElementById("closeEditStoryboardModal").addEventListener("click", close);
    document.getElementById("cancelEditStoryboardModal").addEventListener("click", close);
    m.addEventListener("click", (e) => { if (e.target === m) close(); });

    document.getElementById("editStoryboardBannerBox").addEventListener("click", () => {
      document.getElementById("editStoryboardBannerInput").click();
    });
  }

  let editingStoryboardId = null;
  let editStoryboardBannerDataURL = null;

  function openEditStoryboardModal(escenaRow) {
    ensureEditStoryboardModal();
    editingStoryboardId = escenaRow.id;
    editStoryboardBannerDataURL = null;

    document.getElementById("editStoryboardTitle").value = escenaRow.titulo || "";
    document.getElementById("editStoryboardDesc").value = escenaRow.descripcion || "";

    const prev = document.getElementById("editStoryboardBannerPreview");
    const hint = document.getElementById("editStoryboardBannerHint");
    if (escenaRow.banner_url) {
      prev.src = escenaRow.banner_url;
      prev.classList.add("loaded");
      hint.textContent = "Banner actual";
    } else {
      prev.src = "";
      prev.classList.remove("loaded");
      hint.textContent = "Haz clic para subir imagen (opcional)";
    }

    document.getElementById("editStoryboardBannerInput").onchange = async () => {
      const file = document.getElementById("editStoryboardBannerInput").files?.[0] || null;
      if (!file) return;
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) {
        editStoryboardBannerDataURL = cropped;
        prev.src = editStoryboardBannerDataURL;
        prev.classList.add("loaded");
        hint.textContent = "Imagen recortada";
      }
    };

    document.getElementById("saveEditStoryboardBtn").onclick = async () => {
      const btn = document.getElementById("saveEditStoryboardBtn");
      const title = document.getElementById("editStoryboardTitle").value.trim();
      if (!title) { showToast("ℹ Escribe un título", "error"); return; }
      btn.disabled = true; btn.textContent = "Guardando...";
      try {
        const desc = document.getElementById("editStoryboardDesc").value.trim();
        const updates = { titulo: title, descripcion: desc };

        let bannerUrl = null;
        if (editStoryboardBannerDataURL) {
          bannerUrl = await uploadToCloudinary(dataURLtoBlob(editStoryboardBannerDataURL), "storyboards/banners_storyboards");
          updates.banner_url = bannerUrl;
        }

        const { error } = await sb.from("storyboards").update(updates).eq("id", editingStoryboardId);
        if (error) throw new Error(error.message);

        // refrescar lista
        await loadEscenas();
        window.ANIM.hide(document.getElementById("editStoryboardModal"), 'anim-modal-out');
        showToast("✔ Storyboard actualizado");
      } catch (e) {
        showToast("✖ " + e.message, "error");
      } finally {
        btn.disabled = false; btn.textContent = "¡HECHO!";
      }
    };

    document.getElementById("deleteStoryboardBtn").onclick = async () => {
      if (!confirm("¿Eliminar este storyboard? Esta acción no se puede deshacer.")) return;
      if (!confirm("Confirmación final: ¿Seguro que deseas eliminarlo?")) return;
      try {
        const { error } = await sb.from("storyboards").delete().eq("id", editingStoryboardId);
        if (error) throw new Error(error.message);
        localStorage.removeItem(storyboardMetaKey(editingStoryboardId));
        await loadEscenas();
        window.ANIM.hide(document.getElementById("editStoryboardModal"), 'anim-modal-out');
        showToast("✔ Storyboard eliminado");
      } catch (e) {
        showToast("✖ " + e.message, "error");
      }
    };

    window.ANIM.show(document.getElementById("editStoryboardModal"), 'anim-modal-in');
  }

  // Modal nueva escena
  btnNuevoStoryboard?.addEventListener("click", () => {
    escenaTitulo.value = "";
    escenaDesc && (escenaDesc.value = "");
    escenaBannerDataURL = null;
    if (escenaBanner) escenaBanner.value = "";
    
    escenaBannerPreview && (escenaBannerPreview.src = "");
    escenaBannerPreview?.classList.remove("loaded");
    escenaBannerHint && (escenaBannerHint.textContent = "Haz clic para subir imagen (opcional)");
    
    window.ANIM.show(modalNuevaEscena, 'anim-modal-in');
  });
  closeModalEscena?.addEventListener("click",  () => window.ANIM.hide(modalNuevaEscena, 'anim-modal-out'));
  cancelModalEscena?.addEventListener("click", () => window.ANIM.hide(modalNuevaEscena, 'anim-modal-out'));
  modalNuevaEscena?.addEventListener("click",  e => { if (e.target === modalNuevaEscena) window.ANIM.hide(modalNuevaEscena, 'anim-modal-out'); });

  saveEscenaBtn?.addEventListener("click", async () => {
    const titulo = escenaTitulo.value.trim();
    if (!titulo) { showToast("ℹ Escribe un título para el storyboard", "error"); return; }

    saveEscenaBtn.disabled = true;
    saveEscenaBtn.textContent = "Guardando...";

    try {
      const { count } = await sb.from("storyboards").select("*", { count: "exact", head: true }).eq("proyecto_id", projectId);

      const desc = escenaDesc?.value?.trim() || "";
      let bannerUrl = "";
      const bannerFile = escenaBanner?.files?.[0] || null;
      if (bannerFile) {
        const cropped = await window.RKCrop.open(bannerFile, "banner");
        if (cropped) {
          bannerUrl = await uploadToCloudinary(dataURLtoBlob(cropped), "storyboards/banners_storyboards");
        }
      }

      const payload = {
        proyecto_id: projectId,
        titulo,
        descripcion: desc,
        banner_url: bannerUrl || null,
        orden: count || 0,
      };

      const { data: nueva, error } = await sb.from("storyboards").insert(payload).select().single();
      if (error) throw new Error(error.message);

      // Play sound with slight pitch variation
      const createSound = new Audio("sounds/create.mp3");
      createSound.playbackRate = 0.9 + Math.random() * 0.3;
      createSound.play().catch(() => {});

      emptyStoryboarding.style.display = "none";
      renderEscenaCard(nueva);
      window.ANIM.hide(modalNuevaEscena, 'anim-modal-out');
      showToast("✔ Storyboard creado");
    } catch(err) {
      showToast("✖ No se pudo crear: Asegúrate de haber ejecutado el SQL para la tabla 'storyboards'. " + err.message, "error");
    } finally {
      saveEscenaBtn.disabled = false;
      saveEscenaBtn.textContent = "¡HECHO!";
    }
  });

  // ══════════════════════════════════════════
  // WORLDBUILDING — Worlds + Conceptos
  // ══════════════════════════════════════════

  // Plantillas por defecto (si la tabla está vacía las insertamos)
  const PLANTILLAS_DEFAULT = [
    "Personaje", "Raza", "Criatura", "Objeto",
    "Locación", "Sistema", "Organización", "Evento",
    "Mapa", "Personalizada"
  ];

  async function loadPlantillas() {
    const { data } = await sb.from("plantillas_concepto").select("*").order("nombre");
    let plantillas = data || [];

    // Si no hay ninguna, insertar las por defecto
    if (plantillas.length === 0) {
      const rows = PLANTILLAS_DEFAULT.map(nombre => ({ nombre, tipo: nombre.toLowerCase(), es_default: true }));
      const { data: inserted } = await sb.from("plantillas_concepto").insert(rows).select();
      plantillas = inserted || [];
    }

    // Asegurar plantilla "World"
    let world = plantillas.find(p => (p.nombre || "").toLowerCase() === "world");
    if (!world) {
      const { data: insertedWorld } = await sb.from("plantillas_concepto")
        .insert({ nombre: "World", tipo: "world", es_default: true })
        .select().single();
      if (insertedWorld) {
        plantillas.push(insertedWorld);
        world = insertedWorld;
      }
    }
    worldTemplateId = world?.id || null;
  }

  async function loadConceptos(silent = false) {
    if (!seccionWBId) return;
    if (skipRemoteLoad && !silent) return;

    const { data: conceptos } = await sb.from("conceptos")
      .select("*, plantillas_concepto(nombre)")
      .eq("seccion_id", seccionWBId)
      .order("orden", { ascending: true });

    conceptosCache = conceptos || [];

    renderWorldbuildingList();
    renderConceptTree(conceptosCache);

    // Update cache
    const existing = getPrefetchCache() || { timestamp: Date.now(), expires: Date.now() + 1800000 };
    existing.concepts = conceptosCache;
    localStorage.setItem(`rk_prefetch_${projectId}`, JSON.stringify(existing));
  }

  function isWorld(concepto) {
    const name = concepto?.plantillas_concepto?.nombre || "";
    return name.toLowerCase() === "world";
  }

  function clearWorldbuildingCards() {
    Array.from(bodyWorldbuilding.querySelectorAll(".ip-concepto-card, .ip-world-card")).forEach(el => el.remove());
  }

  function renderWorldbuildingList() {
    clearWorldbuildingCards();

    if (!conceptosCache.length) {
      emptyWorldbuilding.style.display = "flex";
      emptyWorldbuilding.querySelector("p").textContent = "Sin worlds aún.";
      return;
    }

    const worlds = conceptosCache.filter(c => !c.padre_id && isWorld(c));

    if (!worlds.length) {
      emptyWorldbuilding.style.display = "flex";
      emptyWorldbuilding.querySelector("p").textContent = "Sin worlds aún.";
      return;
    }

    emptyWorldbuilding.style.display = "none";
    worlds.forEach(w => renderWorldCard(w));
  }

  function renderWorldCard(world) {
    const card = document.createElement("div");
    card.className = "ip-escena-card ip-world-card";
    card.dataset.id = world.id;
    card.innerHTML = `
      <button class="ip-card-edit" data-action="edit-world" title="Editar">
        <img src="icons/iconos/editar.png" alt="editar" onerror="this.style.display='none';this.parentElement.textContent='✏'">
      </button>
      <div class="ip-escena-preview">
        ${world.banner_url ? `<img src="${world.banner_url}" alt="">` : ""}
      </div>
      <div class="ip-escena-info">
        <h3 class="ip-escena-titulo">${world.titulo || "Sin título"}</h3>
        <p class="ip-escena-desc">${world.descripcion || ""}</p>
      </div>
    `;
    card.querySelector('[data-action="edit-world"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditWorldModal(world);
    });
    // Navegar a WorldBuilding al hacer clic
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      window.location.href = `worldbuilding.html?project_id=${projectId}&world_id=${world.id}`;
    });
    bodyWorldbuilding.insertBefore(card, emptyWorldbuilding);
  }

  // ══════════════════════════════════════════
  // EDITAR / ELIMINAR — WORLD (tabla conceptos)
  // ══════════════════════════════════════════
  function ensureEditWorldModal() {
    if (document.getElementById("editWorldModal")) return;
    const m = document.createElement("div");
    m.id = "editWorldModal";
    m.className = "modal-overlay hidden";
    m.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2>Editar World</h2>
          <button class="modal-close" id="closeEditWorldModal">✕</button>
        </div>

        <input id="editWorldTitle" type="text" placeholder="Título..." class="modal-input">
        <textarea id="editWorldDesc" placeholder="Descripción (opcional)..." class="modal-textarea" rows="3"></textarea>

        <div class="modal-file-box" id="editWorldBannerBox" title="Cambiar banner">
          <div class="modal-file-left">
            <div class="modal-file-thumb">
              <img id="editWorldBannerPreview" src="" alt="banner">
            </div>
            <div class="modal-file-meta">
              <p class="modal-file-title">Banner</p>
              <p class="modal-file-hint" id="editWorldBannerHint">Haz clic para subir imagen (opcional)</p>
            </div>
          </div>
          <div class="modal-file-action">+</div>
        </div>
        <input id="editWorldBannerInput" type="file" accept="image/*" hidden>

        <div class="modal-footer" style="justify-content:space-between">
          <button class="button-delete" id="deleteWorldBtn">🗑 Eliminar world</button>
          <div style="display:flex;gap:10px">
            <button class="button-secondary" id="cancelEditWorldModal">Cancelar</button>
            <button class="button-main modal-save-btn" id="saveEditWorldBtn">¡HECHO!</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    const close = () => window.ANIM.hide(m, 'anim-modal-out');
    document.getElementById("closeEditWorldModal").addEventListener("click", close);
    document.getElementById("cancelEditWorldModal").addEventListener("click", close);
    m.addEventListener("click", (e) => { if (e.target === m) close(); });

    document.getElementById("editWorldBannerBox").addEventListener("click", () => {
      document.getElementById("editWorldBannerInput").click();
    });
  }

  let editingWorldId = null;
  let editWorldBannerDataURL = null;

  function openEditWorldModal(worldRow) {
    ensureEditWorldModal();
    editingWorldId = worldRow.id;
    editWorldBannerDataURL = null;

    document.getElementById("editWorldTitle").value = worldRow.titulo || "";
    document.getElementById("editWorldDesc").value = worldRow.descripcion || "";

    const prev = document.getElementById("editWorldBannerPreview");
    const hint = document.getElementById("editWorldBannerHint");
    if (worldRow.banner_url) {
      prev.src = worldRow.banner_url;
      prev.classList.add("loaded");
      hint.textContent = "Banner actual";
    } else {
      prev.src = "";
      prev.classList.remove("loaded");
      hint.textContent = "Haz clic para subir imagen (opcional)";
    }
    document.getElementById("editWorldBannerInput").value = "";

    document.getElementById("editWorldBannerInput").onchange = async () => {
      const file = document.getElementById("editWorldBannerInput").files?.[0] || null;
      if (!file) return;
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) {
        editWorldBannerDataURL = cropped;
        prev.src = editWorldBannerDataURL;
        prev.classList.add("loaded");
        hint.textContent = "Imagen recortada";
      }
    };

    document.getElementById("saveEditWorldBtn").onclick = async () => {
      const btn = document.getElementById("saveEditWorldBtn");
      const title = document.getElementById("editWorldTitle").value.trim();
      if (!title) { showToast("ℹ Escribe un título", "error"); return; }
      btn.disabled = true; btn.textContent = "Guardando...";
      try {
        const desc = document.getElementById("editWorldDesc").value.trim();

        let bannerUrl = conceptosCache.find(x => x.id === editingWorldId)?.banner_url || "";
        if (editWorldBannerDataURL) {
          bannerUrl = await uploadToCloudinary(dataURLtoBlob(editWorldBannerDataURL), "worlds/banners");
        }

        const updates = { titulo: title, descripcion: desc, banner_url: bannerUrl };
        const { error } = await sb.from("conceptos").update(updates).eq("id", editingWorldId);
        if (error) throw new Error(error.message);

        // refrescar cache y UI
        const idx = conceptosCache.findIndex(x => x.id === editingWorldId);
        if (idx >= 0) {
          conceptosCache[idx].titulo = title;
          conceptosCache[idx].descripcion = desc;
          conceptosCache[idx].banner_url = bannerUrl;
        }
        renderWorldbuildingList();
        renderConceptTree(conceptosCache);

        window.ANIM.hide(document.getElementById("editWorldModal"), 'anim-modal-out');
        showToast("✔ World actualizado");
      } catch (e) {
        showToast("✖ " + e.message, "error");
      } finally {
        btn.disabled = false; btn.textContent = "¡HECHO!";
      }
    };

    document.getElementById("deleteWorldBtn").onclick = async () => {
      if (!confirm("¿Eliminar este world? Se eliminarán también sus conceptos hijos. Esta acción no se puede deshacer.")) return;
      if (!confirm("Confirmación final: ¿Seguro que deseas eliminarlo?")) return;
      try {
        // borrar hijos primero para evitar FK
        await sb.from("conceptos").delete().eq("padre_id", editingWorldId);
        const { error } = await sb.from("conceptos").delete().eq("id", editingWorldId);
        if (error) throw new Error(error.message);

        conceptosCache = conceptosCache.filter(c => c.id !== editingWorldId && c.padre_id !== editingWorldId);
        renderWorldbuildingList();
        renderConceptTree(conceptosCache);

        window.ANIM.hide(document.getElementById("editWorldModal"), 'anim-modal-out');
        showToast("✔ World eliminado");
      } catch (e) {
        showToast("✖ " + e.message, "error");
      }
    };

    window.ANIM.show(document.getElementById("editWorldModal"), 'anim-modal-in');
  }

  function renderConceptoCard(concepto) {
    const card = document.createElement("div");
    card.className = "ip-concepto-card";
    card.dataset.id = concepto.id;
    const tipo = concepto.plantillas_concepto?.nombre || "Concepto";
    card.innerHTML = `
      <div class="ip-concepto-preview">
        ${concepto.icono_url ? `<img src="${concepto.icono_url}" alt="">` : ""}
      </div>
      <div class="ip-concepto-info">
        <h3 class="ip-concepto-titulo">${concepto.titulo || "Sin título"}</h3>
        <span class="ip-concepto-tipo">${tipo}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      // TODO: abrir vista de concepto con bloques
      showToast("ℹ Próximamente: vista de concepto");
    });
    bodyWorldbuilding.insertBefore(card, emptyWorldbuilding);
  }

  // ── CONCEPT EXPLORER (Shared from Worldbuilding) ──
  let explorerCollapsed = {};
  function loadExplorerState() {
    try { explorerCollapsed = JSON.parse(localStorage.getItem('rk_wb_explorer_state') || '{}'); } catch { explorerCollapsed = {}; }
  }
  function saveExplorerState() {
    try { localStorage.setItem('rk_wb_explorer_state', JSON.stringify(explorerCollapsed)); } catch {}
  }

  const MACRO_CATEGORIES = [
    {
      id: 'biologia', label: 'Biología y Población', icon: '🧬', color: 'rgba(90,143,212,0.35)',
      children: ['Raza', 'Personaje', 'Criatura']
    },
    {
      id: 'atlas', label: 'Atlas / Geografía', icon: '🏔️', color: 'rgba(196,135,58,0.35)',
      children: ['Locación']
    },
    {
      id: 'sistemas', label: 'Sistemas y Reglas', icon: '⚙️', color: 'rgba(74,155,111,0.35)',
      children: ['Sistema', 'Poder', 'Objeto']
    },
    {
      id: 'sociedad', label: 'Sociedad y Cultura', icon: '🏛️', color: 'rgba(155,89,182,0.35)',
      children: ['Organización', 'Cultura', 'Evento', 'Historia']
    },
    {
      id: 'freezer', label: 'Freezer', icon: '❄️', color: 'rgba(100,180,220,0.35)',
      children: ['Freezer']
    }
  ];

  const MAIN_TYPES = [
    { key: 'Personaje', icon: '👤' },
    { key: 'Raza', icon: '🧬' },
    { key: 'Criatura', icon: '🐉' },
    { key: 'Locación', icon: '🗺️' },
    { key: 'Objeto', icon: '🗡️' },
    { key: 'Sistema', icon: '⚙️' },
    { key: 'Organización', icon: '🏛️' },
    { key: 'Evento', icon: '📜' },
    { key: 'Poder', icon: '✨' },
    { key: 'Cultura', icon: '🎭' },
    { key: 'Historia', icon: '📖' },
    { key: 'Freezer', icon: '❄️' }
  ];
  function typeIcon(tname) {
    const fn = tname?.toLowerCase() || '';
    if (fn === 'personaje') return '👤';
    if (fn === 'raza') return '🧬';
    if (fn === 'criatura') return '🐉';
    if (fn === 'locación' || fn === 'locacion') return '🗺️';
    if (fn === 'objeto') return '🗡️';
    if (fn === 'sistema') return '⚙️';
    if (fn === 'organización' || fn === 'organizacion') return '🏛️';
    if (fn === 'evento') return '📜';
    if (fn === 'poder') return '✨';
    if (fn === 'cultura') return '🎭';
    if (fn === 'historia') return '📖';
    if (fn === 'freezer') return '❄️';
    if (fn === 'world') return '🌍';
    return '📄';
  }

  function renderConceptTree(conceptos, searchQuery = '') {
    loadExplorerState();
    ipConceptTree.innerHTML = "";
    if (!conceptos.length && !searchQuery) {
      ipConceptTree.innerHTML = `<p class="ip-rp-empty">Sin conceptos aún.</p>`;
      return;
    }

    const q = searchQuery.toLowerCase().trim();

    const topLevel = conceptos.filter(c => {
      const tipo = c.plantillas_concepto?.nombre?.toLowerCase() || '';
      if (tipo === 'world') return false;
      if (!c.padre_id) return true;
      const padre = conceptos.find(p => p.id === c.padre_id);
      if (padre && padre.plantillas_concepto?.nombre?.toLowerCase() === 'world') return true;
      return false;
    });

    // Group by MACRO_CATEGORIES
    MACRO_CATEGORIES.forEach(macro => {
      let macroItems = [];
      macro.children.forEach(typeKey => {
        const matching = topLevel.filter(c => c.plantillas_concepto?.nombre === typeKey);
        macroItems = macroItems.concat(matching);
      });

      if (!macroItems.length && !q) return;

      let filteredItems = macroItems;
      if (q) {
        filteredItems = macroItems.filter(c => conceptMatchesSearch(c, q, conceptos));
        if (!filteredItems.length) return;
      }

      const folderId = `macro_${macro.id}`;
      const isCollapsed = explorerCollapsed[folderId] && !q;

      const folder = document.createElement('div');
      folder.className = 'wb-explorer-folder';

      const header = document.createElement('div');
      header.className = 'wb-explorer-folder-header';
      header.innerHTML = `
        <span class="wb-explorer-chevron ${isCollapsed ? '' : 'open'}">▶</span>
        <span class="wb-explorer-folder-icon">${macro.icon}</span>
        <span class="wb-explorer-folder-name">${macro.label}</span>
        <span class="wb-explorer-folder-count">${macroItems.length}</span>`;
      header.addEventListener('click', () => {
        explorerCollapsed[folderId] = !explorerCollapsed[folderId];
        saveExplorerState();
        renderConceptTree(conceptosCache, ipSearch?.value || '');
      });
      folder.appendChild(header);

      if (!isCollapsed) {
        const children = document.createElement('div');
        children.className = 'wb-explorer-children';

        // Sub-type grouping
        const bySubType = {};
        filteredItems.forEach(c => {
          const t = c.plantillas_concepto?.nombre || 'Otro';
          if (!bySubType[t]) bySubType[t] = [];
          bySubType[t].push(c);
        });

        const subTypeKeys = Object.keys(bySubType);
        if (subTypeKeys.length > 1) {
          subTypeKeys.forEach(t => {
            const subHeader = document.createElement('div');
            subHeader.className = 'wb-explorer-sub-category';
            subHeader.style.paddingLeft = '28px';
            const typeData = MAIN_TYPES.find(mt => mt.key === t);
            subHeader.textContent = typeData ? `${typeData.icon} ${t}` : t;
            children.appendChild(subHeader);
            bySubType[t].forEach(c => {
              children.appendChild(buildExplorerNode(c, 1, q, conceptos));
            });
          });
        } else {
          filteredItems.forEach(c => {
            children.appendChild(buildExplorerNode(c, 1, q, conceptos));
          });
        }
        folder.appendChild(children);
      }

      ipConceptTree.appendChild(folder);
    });

    // Uncategorized concepts
    const knownTypes = new Set(MACRO_CATEGORIES.flatMap(mc => mc.children));
    const uncategorized = topLevel.filter(c => !knownTypes.has(c.plantillas_concepto?.nombre));
    if (uncategorized.length) {
      let filteredUncat = uncategorized;
      if (q) {
        filteredUncat = uncategorized.filter(c => conceptMatchesSearch(c, q, conceptos));
      }
      if (filteredUncat.length) {
        const folderId = 'macro_otros';
        const isCollapsed = explorerCollapsed[folderId] && !q;
        const folder = document.createElement('div');
        folder.className = 'wb-explorer-folder';
        const header = document.createElement('div');
        header.className = 'wb-explorer-folder-header';
        header.innerHTML = `
          <span class="wb-explorer-chevron ${isCollapsed ? '' : 'open'}">▶</span>
          <span class="wb-explorer-folder-icon">📄</span>
          <span class="wb-explorer-folder-name">Otros</span>
          <span class="wb-explorer-folder-count">${uncategorized.length}</span>`;
        header.addEventListener('click', () => {
          explorerCollapsed[folderId] = !explorerCollapsed[folderId];
          saveExplorerState();
          renderConceptTree(conceptosCache, ipSearch?.value || '');
        });
        folder.appendChild(header);
        if (!isCollapsed) {
          const children = document.createElement('div');
          children.className = 'wb-explorer-children';
          filteredUncat.forEach(c => {
            children.appendChild(buildExplorerNode(c, 1, q, conceptos));
          });
          folder.appendChild(children);
        }
        ipConceptTree.appendChild(folder);
      }
    }
  }

  function conceptMatchesSearch(concept, query, allConcepts) {
    if ((concept.titulo || '').toLowerCase().includes(query)) return true;
    const children = allConcepts.filter(c => c.padre_id === concept.id);
    return children.some(c => conceptMatchesSearch(c, query, allConcepts));
  }

  function buildExplorerNode(concept, depth, searchQuery = '', allConcepts) {
    const children = allConcepts.filter(c => c.padre_id === concept.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    const hasChildren = children.length > 0;
    const folderId = `node_${concept.id}`;
    const isCollapsed = explorerCollapsed[folderId] && !searchQuery;

    const wrap = document.createElement('div');
    wrap.className = 'wb-explorer-node-wrap';

    const node = document.createElement('div');
    node.className = 'wb-explorer-item';
    node.dataset.id = concept.id;
    node.style.paddingLeft = `${12 + depth * 16}px`;

    let nameHTML = concept.titulo || 'Sin título';
    if (searchQuery && nameHTML.toLowerCase().includes(searchQuery)) {
      const idx = nameHTML.toLowerCase().indexOf(searchQuery);
      nameHTML = nameHTML.substring(0, idx) + 
        `<mark class="wb-explorer-match">${nameHTML.substring(idx, idx + searchQuery.length)}</mark>` + 
        nameHTML.substring(idx + searchQuery.length);
    }

    const iconContent = concept.icono_url 
      ? `<img src="${concept.icono_url}" alt="" class="wb-explorer-item-img">` 
      : `<span class="wb-explorer-item-emoji">${typeIcon(concept.plantillas_concepto?.nombre || '')}</span>`;

    node.innerHTML = `
      ${hasChildren ? `<span class="wb-explorer-chevron small ${isCollapsed ? '' : 'open'}">▶</span>` : '<span class="wb-explorer-leaf-dot">•</span>'}
      <span class="wb-explorer-item-icon">${iconContent}</span>
      <span class="wb-explorer-item-name">${nameHTML}</span>`;

    node.addEventListener('click', (e) => {
      if (e.target.closest('.wb-explorer-chevron')) {
        explorerCollapsed[folderId] = !explorerCollapsed[folderId];
        saveExplorerState();
        renderConceptTree(conceptosCache, ipSearch?.value || '');
        return;
      }
      ipConceptTree.querySelectorAll('.wb-explorer-item').forEach(n => n.classList.remove('active'));
      node.classList.add('active');
      showToast('ℹ Próximamente: vista de concepto');
    });

    wrap.appendChild(node);

    if (hasChildren && !isCollapsed) {
      const childContainer = document.createElement('div');
      childContainer.className = 'wb-explorer-children';

      const childByType = {};
      let filteredChildren = children;
      if (searchQuery) {
        filteredChildren = children.filter(c => conceptMatchesSearch(c, searchQuery, allConcepts));
      }

      filteredChildren.forEach(c => {
        const t = c.plantillas_concepto?.nombre || 'Otro';
        if (!childByType[t]) childByType[t] = [];
        childByType[t].push(c);
      });

      const typeKeys = Object.keys(childByType);
      if (typeKeys.length > 1) {
        typeKeys.forEach(t => {
          const subHeader = document.createElement('div');
          subHeader.className = 'wb-explorer-sub-category';
          subHeader.style.paddingLeft = `${12 + (depth + 1) * 16}px`;
          subHeader.textContent = t;
          childContainer.appendChild(subHeader);
          childByType[t].forEach(c => {
            childContainer.appendChild(buildExplorerNode(c, depth + 1, searchQuery, allConcepts));
          });
        });
      } else {
        filteredChildren.forEach(c => {
          childContainer.appendChild(buildExplorerNode(c, depth + 1, searchQuery, allConcepts));
        });
      }
      wrap.appendChild(childContainer);
    }

    return wrap;
  }

  // ── Búsqueda en el árbol ──────────────────
  ipSearch?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    renderConceptTree(conceptosCache, q);
  });

  // ── Modal nuevo world / concepto ──────────
  // Cajas de archivo (estilo)
  escenaBannerBox?.addEventListener("click", () => escenaBanner?.click());

  escenaBanner?.addEventListener("change", async () => {
    const file = escenaBanner.files?.[0] || null;
    if (!file) {
      escenaBannerDataURL = null;
      if (escenaBannerPreview) {
        escenaBannerPreview.src = "";
        escenaBannerPreview.classList.remove("loaded");
      }
      if (escenaBannerHint) escenaBannerHint.textContent = "Haz clic para subir imagen (opcional)";
      return;
    }
    const cropped = await window.RKCrop.open(file, "banner");
    if (cropped) {
      escenaBannerDataURL = cropped;
      if (escenaBannerPreview) {
        escenaBannerPreview.src = escenaBannerDataURL;
        escenaBannerPreview.classList.add("loaded");
      }
      if (escenaBannerHint) escenaBannerHint.textContent = "Imagen recortada";
    }
  });

  conceptoIconBox?.addEventListener("click", () => conceptoIconInput?.click());
  conceptoIconInput?.addEventListener("change", async () => {
    const file = conceptoIconInput.files[0];
    if (!file) return;
    const cropped = await window.RKCrop.open(file, "profile");
    if (cropped) {
      conceptoIconDataURL = cropped;
      conceptoIconPreview.src = conceptoIconDataURL;
      conceptoIconPreview.classList.add("loaded");
      conceptoIconBox.classList.add("has-image");
    }
  });

  worldBanner?.addEventListener("change", async () => {
    const file = worldBanner.files?.[0];
    if (!file) {
      worldBannerDataURL = null;
      if (worldBannerPreview) {
        worldBannerPreview.src = "";
        worldBannerPreview.classList.remove("loaded");
      }
      if (worldBannerHint) worldBannerHint.textContent = "Haz clic para subir imagen (opcional)";
      return;
    }
    const cropped = await window.RKCrop.open(file, "banner");
    if (cropped) {
      worldBannerDataURL = cropped;
      if (worldBannerPreview) {
        worldBannerPreview.src = worldBannerDataURL;
        worldBannerPreview.classList.add("loaded");
      }
      if (worldBannerHint) worldBannerHint.textContent = "Imagen recortada";
    }
  });

  worldBannerBox?.addEventListener("click", () => worldBanner?.click());

  btnNuevoConcepto?.addEventListener("click", () => {
    openNewWorldModal();
  });

  function resetWorldModal() {
    conceptoTitulo.value    = "";
    worldDesc && (worldDesc.value = "");
    if (worldBanner) worldBanner.value = "";
    worldBannerDataURL = null;
    if (worldBannerPreview) {
      worldBannerPreview.src = "";
      worldBannerPreview.classList.remove("loaded");
    }
    if (worldBannerHint) worldBannerHint.textContent = "Haz clic para subir imagen (opcional)";
    conceptoIconDataURL     = null;
    conceptoIconPreview.src = "";
    conceptoIconPreview.classList.remove("loaded");
    conceptoIconBox.classList.remove("has-image");
  }

  function openNewWorldModal() {
    resetWorldModal();
    modalNuevoConcepto.querySelector("h2").textContent = "Nuevo World";
    window.ANIM.show(modalNuevoConcepto, 'anim-modal-in');
    modalNuevoConcepto.dataset.mode = "world";
    modalNuevoConcepto.dataset.parentId = "";
  }

  function openNewConceptModal(parentWorldId) {
    resetWorldModal();
    modalNuevoConcepto.querySelector("h2").textContent = "Nuevo Concepto";
    window.ANIM.show(modalNuevoConcepto, 'anim-modal-in');
    modalNuevoConcepto.dataset.mode = "concept";
    modalNuevoConcepto.dataset.parentId = parentWorldId;
    showToast("ℹ En esta versión, el concepto se crea dentro del world. (Editor completo próximamente)");
  }

  closeModalConcepto?.addEventListener("click",  () => window.ANIM.hide(modalNuevoConcepto, 'anim-modal-out'));
  cancelModalConcepto?.addEventListener("click", () => window.ANIM.hide(modalNuevoConcepto, 'anim-modal-out'));
  modalNuevoConcepto?.addEventListener("click",  e => { if (e.target === modalNuevoConcepto) window.ANIM.hide(modalNuevoConcepto, 'anim-modal-out'); });

  saveConceptoBtn?.addEventListener("click", async () => {
    const titulo = conceptoTitulo.value.trim();
    if (!titulo) { showToast("ℹ Escribe un nombre", "error"); return; }

    saveConceptoBtn.disabled = true;
    saveConceptoBtn.textContent = "Guardando...";

    try {
      const { count } = await sb.from("conceptos").select("*", { count: "exact", head: true }).eq("seccion_id", seccionWBId);

      const mode = modalNuevoConcepto.dataset.mode || "world";
      const parentId = modalNuevoConcepto.dataset.parentId || null;

      const nuevoConcepto = {
        seccion_id:   seccionWBId,
        plantilla_id: mode === "world" ? worldTemplateId : null,
        padre_id:     mode === "concept" ? parentId : null,
        titulo,
        orden:        count || 0,
      };

      // Subir ícono si hay
      if (conceptoIconDataURL) {
        const blob = dataURLtoBlob(conceptoIconDataURL);
        // Worlds y conceptos comparten tabla, pero usan carpetas distintas
        const folder = mode === "world"
          ? "worlds/iconos_worlds"
          : "worlds/iconos_conceptos";
        nuevoConcepto.icono_url = await uploadToCloudinary(blob, folder);
      }

      // Banner/desc (opcional) — intentamos guardar si existen columnas; si no, hacemos fallback
      const desc = (mode === "world" ? worldDesc?.value?.trim() : null) || null;
      if (desc) nuevoConcepto.descripcion = desc;
      let worldBannerUrl = "";
      if (mode === "world" && worldBannerDataURL) {
        worldBannerUrl = await uploadToCloudinary(dataURLtoBlob(worldBannerDataURL), "worlds/banners");
        nuevoConcepto.banner_url = worldBannerUrl;
      }

      let insertado = null;
      {
        const res = await sb.from("conceptos").insert(nuevoConcepto).select("*, plantillas_concepto(nombre)").single();
        if (res.error) {
          // Fallback: remover campos opcionales si la DB no los tiene
          const msg = (res.error.message || "").toLowerCase();
          if (msg.includes("banner_url") || msg.includes("descripcion") || msg.includes("column")) {
            delete nuevoConcepto.banner_url;
            delete nuevoConcepto.descripcion;
            const res2 = await sb.from("conceptos").insert(nuevoConcepto).select("*, plantillas_concepto(nombre)").single();
            if (res2.error) throw new Error(res2.error.message);
            insertado = res2.data;
          } else {
            throw new Error(res.error.message);
          }
        } else {
          insertado = res.data;
        }
      }

      conceptosCache.push(insertado);
      renderConceptTree(conceptosCache);
      
      // Play sound with slight pitch variation
      const createSound = new Audio("sounds/create.mp3");
      createSound.playbackRate = 0.9 + Math.random() * 0.3;
      createSound.play().catch(() => {});

      window.ANIM.hide(modalNuevoConcepto, 'anim-modal-out');
      if (mode === "world") {
        // Guardar meta visual local (DB no tiene columnas banner/descripcion)
        setWorldMeta(insertado.id, { descripcion: desc || "", banner_url: worldBannerUrl || "" });
        renderWorldbuildingList();
        showToast("✔ World creado");
      } else {
        // Por ahora no navegamos dentro del world en esta pantalla
        renderWorldbuildingList();
        showToast("✔ Concepto creado");
      }

    } catch(err) {
      showToast("✖ " + err.message, "error");
    } finally {
      saveConceptoBtn.disabled = false;
      saveConceptoBtn.textContent = "¡HECHO!";
    }
  });

  // World Metadata fallback
  function setWorldMeta(id, meta) {
    localStorage.setItem(`rk_world_meta_${id}`, JSON.stringify(meta || {}));
  }
  function getWorldMeta(id) {
    try { return JSON.parse(localStorage.getItem(`rk_world_meta_${id}`) || "{}"); }
    catch { return {}; }
  }

  // Export / Import sections
  function downloadJsonFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportStoryboarding() {
    try {
      showToast("⏳ Preparando exportación de Storyboarding...", "info");
      const { data: storyboardsObj, error: sbErr } = await sb.from("storyboards")
        .select("*")
        .eq("proyecto_id", projectId)
        .order("orden", { ascending: true });
        
      if (sbErr) throw sbErr;
      if (!storyboardsObj || storyboardsObj.length === 0) {
        showToast("ℹ No hay storyboards para exportar en este proyecto.", "info");
        return;
      }

      const sbIds = storyboardsObj.map(s => s.id);
      const { data: escenasObj, error: escErr } = await sb.from("escenas")
        .select("*")
        .in("storyboard_id", sbIds)
        .order("orden", { ascending: true });
        
      if (escErr) throw escErr;

      const exportData = {
        type: "reiken_storyboarding",
        version: 1,
        exportedAt: new Date().toISOString(),
        projectName: ipProjectTitle.textContent,
        storyboards: storyboardsObj.map(s => ({
          id: s.id,
          titulo: s.titulo,
          descripcion: s.descripcion,
          banner_url: s.banner_url,
          orden: s.orden
        })),
        escenas: escenasObj.map(e => ({
          storyboard_id: e.storyboard_id,
          titulo: e.titulo,
          descripcion: e.descripcion,
          banner_url: e.banner_url,
          orden: e.orden,
          contenido_script: e.contenido_script,
          personajes: e.personajes
        }))
      };

      downloadJsonFile(exportData, `Storyboarding_${ipProjectTitle.textContent.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
      showToast("✔ Storyboarding exportado con éxito");
    } catch (err) {
      console.error(err);
      showToast("✖ Error al exportar: " + err.message, "error");
    }
  }

  async function importStoryboarding(file) {
    try {
      showToast("⏳ Importando Storyboarding...", "info");
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== "reiken_storyboarding") {
        throw new Error("El archivo no contiene una sección de Storyboarding válida.");
      }

      if (!data.storyboards || !data.storyboards.length) {
        showToast("ℹ No hay storyboards válidos en el archivo.", "info");
        return;
      }

      let importedCount = 0;
      let scenesCount = 0;

      for (const s of data.storyboards) {
        const { data: newSb, error: sbErr } = await sb.from("storyboards").insert({
          proyecto_id: projectId,
          titulo: s.titulo + " (Importado)",
          descripcion: s.descripcion,
          banner_url: s.banner_url,
          orden: s.orden
        }).select().single();

        if (sbErr) {
          console.error("Error inserting storyboard:", sbErr);
          continue;
        }

        importedCount++;

        const childScenes = data.escenas ? data.escenas.filter(e => e.storyboard_id === s.id) : [];
        for (const esc of childScenes) {
          const { error: escErr } = await sb.from("escenas").insert({
            storyboard_id: newSb.id,
            titulo: esc.titulo,
            descripcion: esc.descripcion,
            banner_url: esc.banner_url,
            orden: esc.orden,
            contenido_script: esc.contenido_script,
            personajes: esc.personajes
          });
          if (!escErr) scenesCount++;
        }
      }

      showToast(`✔ Se importaron ${importedCount} storyboards y ${scenesCount} escenas`);
      await loadEscenas();
    } catch (err) {
      console.error(err);
      showToast("✖ Error al importar: " + err.message, "error");
    }
  }

  async function exportWorldbuilding() {
    try {
      if (!seccionWBId) {
        showToast("✖ No se ha cargado la sección de Worldbuilding", "error");
        return;
      }
      showToast("⏳ Preparando exportación de Worldbuilding...", "info");

      const { data: conceptosObj, error: cErr } = await sb.from("conceptos")
        .select("*, plantillas_concepto(nombre)")
        .eq("seccion_id", seccionWBId)
        .order("orden", { ascending: true });

      if (cErr) throw cErr;
      if (!conceptosObj || conceptosObj.length === 0) {
        showToast("ℹ No hay conceptos para exportar en este proyecto.", "info");
        return;
      }

      const cIds = conceptosObj.map(c => c.id);
      const { data: contenidosObj, error: ctErr } = await sb.from("contenidos")
        .select("*")
        .in("titulo", cIds)
        .eq("tipo_plantilla", "wb_concepto");

      if (ctErr) throw ctErr;

      let bloquesObj = [];
      if (contenidosObj && contenidosObj.length > 0) {
        const ctIds = contenidosObj.map(ct => ct.id);
        const { data: blks, error: bErr } = await sb.from("bloques")
          .select("*")
          .in("contenido_id", ctIds)
          .order("orden", { ascending: true });
          
        if (bErr) throw bErr;
        bloquesObj = blks || [];
      }

      const { data: relacionesObj, error: rErr } = await sb.from("concepto_relaciones")
        .select("*")
        .in("concepto_origen_id", cIds);

      if (rErr) throw rErr;

      const exportData = {
        type: "reiken_worldbuilding",
        version: 1,
        exportedAt: new Date().toISOString(),
        projectName: ipProjectTitle.textContent,
        conceptos: conceptosObj.map(c => ({
          id: c.id,
          titulo: c.titulo,
          descripcion: c.descripcion || getStoryboardMeta(c.id)?.descripcion || "",
          icono_url: c.icono_url,
          banner_url: c.banner_url || getStoryboardMeta(c.id)?.banner_url || "",
          orden: c.orden,
          plantilla_id: c.plantilla_id,
          plantilla_nombre: c.plantillas_concepto?.nombre || null,
          padre_id: c.padre_id
        })),
        contenidos: contenidosObj.map(ct => ({
          id: ct.id,
          titulo: ct.titulo,
          tipo_plantilla: ct.tipo_plantilla,
          extra_data: ct.extra_data
        })),
        bloques: bloquesObj.map(b => ({
          contenido_id: b.contenido_id,
          tipo: b.tipo,
          data: b.data,
          orden: b.orden
        })),
        relaciones: (relacionesObj || []).map(r => ({
          concepto_origen_id: r.concepto_origen_id,
          concepto_destino_id: r.concepto_destino_id,
          tipo: r.tipo,
          descripcion: r.descripcion
        }))
      };

      downloadJsonFile(exportData, `Worldbuilding_${ipProjectTitle.textContent.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
      showToast("✔ Worldbuilding exportado con éxito");
    } catch (err) {
      console.error(err);
      showToast("✖ Error al exportar: " + err.message, "error");
    }
  }

  async function importWorldbuilding(file) {
    try {
      if (!seccionWBId) {
        throw new Error("No se ha inicializado la sección de Worldbuilding");
      }
      showToast("⏳ Importando Worldbuilding...", "info");
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== "reiken_worldbuilding") {
        throw new Error("El archivo no contiene una sección de Worldbuilding válida.");
      }

      if (!data.conceptos || !data.conceptos.length) {
        showToast("ℹ No hay conceptos válidos en el archivo.", "info");
        return;
      }

      const conceptIdMap = {};
      const { data: currentTemplates } = await sb.from("plantillas_concepto").select("*");
      const templateMap = {};
      if (currentTemplates) {
        currentTemplates.forEach(t => {
          templateMap[t.nombre.toLowerCase()] = t.id;
        });
      }

      let remaining = [...data.conceptos];
      let insertedSome = true;
      let conceptsCount = 0;

      while (remaining.length > 0 && insertedSome) {
        insertedSome = false;
        for (let i = 0; i < remaining.length; i++) {
          const c = remaining[i];
          if (!c.padre_id || conceptIdMap[c.padre_id]) {
            const newParentId = c.padre_id ? conceptIdMap[c.padre_id] : null;
            let newTemplateId = null;
            if (c.plantilla_nombre && templateMap[c.plantilla_nombre.toLowerCase()]) {
              newTemplateId = templateMap[c.plantilla_nombre.toLowerCase()];
            } else if (c.plantilla_id) {
              newTemplateId = c.plantilla_id;
            }

            const payload = {
              seccion_id: seccionWBId,
              plantilla_id: newTemplateId,
              padre_id: newParentId,
              titulo: c.titulo,
              orden: c.orden,
              icono_url: c.icono_url,
              descripcion: c.descripcion || null,
              banner_url: c.banner_url || null
            };

            let newC = null;
            const res = await sb.from("conceptos").insert(payload).select().single();
            if (res.error) {
              const msg = (res.error.message || "").toLowerCase();
              if (msg.includes("banner_url") || msg.includes("descripcion") || msg.includes("column")) {
                delete payload.banner_url;
                delete payload.descripcion;
                const res2 = await sb.from("conceptos").insert(payload).select().single();
                if (!res2.error) newC = res2.data;
              }
            } else {
              newC = res.data;
            }

            if (newC) {
              conceptIdMap[c.id] = newC.id;
              conceptsCount++;
              if (c.plantilla_nombre && c.plantilla_nombre.toLowerCase() === "world") {
                setWorldMeta(newC.id, { descripcion: c.descripcion || "", banner_url: c.banner_url || "" });
              }
            }

            remaining.splice(i, 1);
            i--;
            insertedSome = true;
          }
        }

        if (!insertedSome && remaining.length > 0) {
          for (const c of remaining) {
            let newTemplateId = null;
            if (c.plantilla_nombre && templateMap[c.plantilla_nombre.toLowerCase()]) {
              newTemplateId = templateMap[c.plantilla_nombre.toLowerCase()];
            }
            const payload = {
              seccion_id: seccionWBId,
              plantilla_id: newTemplateId,
              padre_id: null,
              titulo: c.titulo,
              orden: c.orden,
              icono_url: c.icono_url
            };
            const res = await sb.from("conceptos").insert(payload).select().single();
            if (res.data) {
              conceptIdMap[c.id] = res.data.id;
              conceptsCount++;
            }
          }
          remaining = [];
        }
      }

      let contentsCount = 0;
      let blocksCount = 0;

      if (data.contenidos && data.contenidos.length > 0) {
        for (const ct of data.contenidos) {
          const newConceptId = conceptIdMap[ct.titulo];
          if (!newConceptId) continue;

          const { data: newCt, error: ctErr } = await sb.from("contenidos").insert({
            titulo: newConceptId,
            tipo_plantilla: ct.tipo_plantilla,
            extra_data: ct.extra_data
          }).select().single();

          if (ctErr) continue;
          contentsCount++;

          const childBlocks = data.bloques ? data.bloques.filter(b => b.contenido_id === ct.id) : [];
          for (const b of childBlocks) {
            const { error: bErr } = await sb.from("bloques").insert({
              contenido_id: newCt.id,
              tipo: b.tipo,
              data: b.data,
              orden: b.orden
            });
            if (!bErr) blocksCount++;
          }
        }
      }

      let relationsCount = 0;
      if (data.relaciones && data.relaciones.length > 0) {
        for (const r of data.relaciones) {
          const newOriginId = conceptIdMap[r.concepto_origen_id];
          const newDestId = conceptIdMap[r.concepto_destino_id];
          
          if (newOriginId && newDestId) {
            const { error: rErr } = await sb.from("concepto_relaciones").insert({
              concepto_origen_id: newOriginId,
              concepto_destino_id: newDestId,
              tipo: r.tipo,
              descripcion: r.descripcion
            });
            if (!rErr) relationsCount++;
          }
        }
      }

      showToast(`✔ Worldbuilding importado: ${conceptsCount} conceptos, ${contentsCount} fichas, ${blocksCount} bloques y ${relationsCount} relaciones`);
      await loadConceptos();
    } catch (err) {
      console.error(err);
      showToast("✖ Error al importar: " + err.message, "error");
    }
  }

  function initExportImport() {
    const btnExportSB = document.getElementById("btnExportSB");
    const btnImportSB = document.getElementById("btnImportSB");
    const importSBInput = document.getElementById("importSBInput");

    btnExportSB?.addEventListener("click", (e) => {
      e.stopPropagation();
      exportStoryboarding();
    });

    btnImportSB?.addEventListener("click", (e) => {
      e.stopPropagation();
      importSBInput?.click();
    });

    importSBInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        importStoryboarding(file);
      }
      e.target.value = "";
    });

    const btnExportWB = document.getElementById("btnExportWB");
    const btnImportWB = document.getElementById("btnImportWB");
    const importWBInput = document.getElementById("importWBInput");

    btnExportWB?.addEventListener("click", (e) => {
      e.stopPropagation();
      exportWorldbuilding();
    });

    btnImportWB?.addEventListener("click", (e) => {
      e.stopPropagation();
      importWBInput?.click();
    });

    importWBInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        importWorldbuilding(file);
      }
      e.target.value = "";
    });
  }

  // ══════════════════════════════════════════
  // SIDEBAR — Atajos (usando sistema compartido en rk_core.js)
  // ══════════════════════════════════════════

  function goToShortcut(sc) {
    if (!sc?.type) return;
    if (sc.type === "section" && sc.target === "storyboarding") {
      colStoryboarding?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      showToast("✔ Atajo: Storyboarding");
      return;
    }
    if (sc.type === "section" && sc.target === "worldbuilding") {
      colWorldbuilding?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      showToast("✔ Atajo: Worldbuilding");
      return;
    }
    if (sc.type === "concepto" && sc.targetId) {
      const c = conceptosCache.find(x => x.id === sc.targetId);
      if (!c) { showToast("ℹ El elemento ya no existe", "error"); return; }
      let worldId = isWorld(c) ? c.id : null;
      if (!worldId && c.padre_id) {
        const p = conceptosCache.find(x => x.id === c.padre_id);
        if (p && isWorld(p)) worldId = p.id;
      }
      if (worldId) {
        window.location.href = `worldbuilding.html?project_id=${projectId}&world_id=${worldId}${!isWorld(c) ? '&concepto_id=' + c.id : ''}`;
      } else {
        showToast("ℹ No se pudo determinar el mundo", "error");
      }
      return;
    }
    if (sc.type === "escena" && sc.targetId) {
      window.location.href = "escena.html?id=" + sc.targetId;
      return;
    }
  }

  // ── AUTO UPDATER SYSTEM (LAG-FREE) ─────────────────
  async function initAutoUpdater() {
    const isTauri = !!window.__TAURI__?.core;
    const isElectron = !!window.rkUpdater;
    if (!isTauri && !isElectron) return;

    const updateBtn = document.getElementById("updateBtn");
    const modalActualizacion = document.getElementById("modalActualizacion");
    const closeModalUpdate = document.getElementById("closeModalUpdate");
    const cancelModalUpdate = document.getElementById("cancelModalUpdate");
    const startUpdateBtn = document.getElementById("startUpdateBtn");
    const updateVersionTitle = document.getElementById("updateVersionTitle");
    const updateNotes = document.getElementById("updateNotes");
    const updateProgressContainer = document.getElementById("updateProgressContainer");
    const updateProgressBar = document.getElementById("updateProgressBar");
    const updatePercentLabel = document.getElementById("updatePercentLabel");

    let downloadUrl = null;
    let downloadedFilePath = null;

    // 1. Comprobar actualizaciones silenciosamente al arrancar
    try {
      let isNewer = false, latestVersion = '', notes = '', url = '';
      if (isTauri) {
        const updater = window.__TAURI__['plugin-updater'];
        if (updater?.checkUpdate) {
          const result = await updater.checkUpdate();
          isNewer = result?.shouldUpdate || false;
          latestVersion = result?.manifest?.version || '';
          notes = result?.manifest?.body || '';
          url = result?.manifest?.url || '';
        }
      } else {
        const update = await window.rkUpdater.checkForUpdates();
        isNewer = update?.isNewer || false;
        latestVersion = update?.latestVersion || '';
        notes = update?.notes || '';
        url = update?.url || '';
      }
      if (isNewer) {
        window.ANIM.show(updateBtn, 'anim-fade-in');
        downloadUrl = url;
        if (updateVersionTitle) updateVersionTitle.textContent = `Versión ${latestVersion} disponible`;
        if (updateNotes) updateNotes.textContent = notes || "Novedades y correcciones importantes.";
        if (window.RKSound && typeof window.RKSound.play === 'function') {
          window.RKSound.play('notification');
        }
      }
    } catch (e) {
      console.warn("Fallo en chequeo de actualizaciones:", e);
    }

    // 2. Controlar apertura y cierre del modal
    updateBtn?.addEventListener("click", () => {
      window.ANIM.show(modalActualizacion, 'anim-modal-in');
    });

    const hideModal = () => {
      // Si ya empezó la descarga, evitar cerrar el modal para que no se interrumpa
      if (updateProgressContainer && !updateProgressContainer.classList.contains("hidden") && !downloadedFilePath) {
        showToast("ℹ Espera a que termine la descarga de la actualización", "warning");
        return;
      }
      window.ANIM.hide(modalActualizacion, 'anim-modal-out');
    };

    closeModalUpdate?.addEventListener("click", hideModal);
    cancelModalUpdate?.addEventListener("click", hideModal);

    // 3. Flujo de descarga e instalación
    startUpdateBtn?.addEventListener("click", async () => {
      if (downloadedFilePath) {
        startUpdateBtn.textContent = "Instalando...";
        startUpdateBtn.disabled = true;
        if (isTauri) {
          const updater = window.__TAURI__['plugin-updater'];
          if (updater?.installUpdate) {
            try { await updater.installUpdate(); } catch (e) {
              showToast(`Error al instalar: ${e.message}`, "error");
              startUpdateBtn.textContent = "¡REINTENTAR INSTALACIÓN!";
              startUpdateBtn.disabled = false;
            }
          }
        } else {
          const result = await window.rkUpdater.installUpdate(downloadedFilePath);
          if (result?.error) {
            showToast(`Error al instalar: ${result.error}`, "error");
            startUpdateBtn.textContent = "¡REINTENTAR INSTALACIÓN!";
            startUpdateBtn.disabled = false;
          }
        }
        return;
      }

      if (!downloadUrl) {
        showToast("Error: No se encontró URL de descarga", "error");
        return;
      }

      startUpdateBtn.disabled = true;
      startUpdateBtn.textContent = "Descargando...";
      window.ANIM.show(updateProgressContainer, 'anim-fade-in');
      cancelModalUpdate.style.display = "none";
      closeModalUpdate.style.display = "none";

      try {
        if (isTauri) {
          const updater = window.__TAURI__['plugin-updater'];
          if (updater?.downloadUpdate) {
            const unlisten = await updater.onUpdaterEvent((event) => {
              const p = event?.data?.progress || 0;
              const percent = Math.round(p * 100);
              if (updateProgressBar) updateProgressBar.style.width = `${percent}%`;
              if (updatePercentLabel) updatePercentLabel.textContent = `${percent}%`;
            });
            await updater.downloadUpdate();
            unlisten();
            downloadedFilePath = true;
            showToast("Descarga completa. Listo para instalar.");
            startUpdateBtn.disabled = false;
            startUpdateBtn.textContent = "REINICIAR E INSTALAR";
            startUpdateBtn.style.background = "#2ea44f";
            if (updatePercentLabel) updatePercentLabel.textContent = "¡Completado!";
          }
        } else {
          window.rkUpdater.onProgress((progress) => {
            const percent = Math.round(progress * 100);
            if (updateProgressBar) updateProgressBar.style.width = `${percent}%`;
            if (updatePercentLabel) updatePercentLabel.textContent = `${percent}%`;
          });
          const result = await window.rkUpdater.startUpdateDownload(downloadUrl);
          if (result?.success) {
            downloadedFilePath = result.path;
            showToast("Descarga completa. Listo para instalar.");
            startUpdateBtn.disabled = false;
            startUpdateBtn.textContent = "REINICIAR E INSTALAR";
            startUpdateBtn.style.background = "#2ea44f";
            if (updatePercentLabel) updatePercentLabel.textContent = "¡Completado!";
          } else {
            throw new Error(result?.error || "Fallo de conexión");
          }
        }
      } catch (err) {
        showToast(`Error al descargar: ${err.message}`, "error");
        startUpdateBtn.disabled = false;
        startUpdateBtn.textContent = "¡REINTENTAR DESCARGA!";
        window.ANIM.hide(updateProgressContainer, 'anim-fade-out');
        cancelModalUpdate.style.display = "block";
        closeModalUpdate.style.display = "block";
      }
    });
  }

  // (el modal de creación ahora vive en rk_core.js)

  // ── Arrancar ──────────────────────────────
  // Si la caché masiva ya existe y está fresca, arrancamos de inmediato.
  // Si no, esperamos a que el RKPreloader global termine.
  const checkCache = getPrefetchCache();
  if (checkCache && checkCache.sections && checkCache.sections.length > 0) {
    init();
  } else {
    document.addEventListener('rk-cache-ready', init, { once: true });
  }

})();
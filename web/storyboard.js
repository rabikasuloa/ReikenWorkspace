// ==========================
// STORYBOARD PAGE
// ==========================
(function () {
  if (!document.getElementById("storyboardTitle")) return;

  const sb = supabaseClient;

  // ── Leer storyboard_id de la URL ──────────
  const params    = new URLSearchParams(window.location.search);
  const storyboardId = params.get("id");
  if (!storyboardId) {
    window.location.href = "index_projects.html";
    return;
  }

  // ── Elementos DOM ─────────────────────────
  const storyboardTitle  = document.getElementById("storyboardTitle");
  const backBtn          = document.getElementById("backBtn");
  const sidebarToggle    = document.getElementById("sidebarToggle");
  const sidebar          = document.getElementById("sidebar");

  const scenesGrid       = document.getElementById("scenesGrid");
  const scenesEmpty      = document.getElementById("scenesEmpty");
  const btnNuevaEscena   = document.getElementById("openCreateSceneModal");

  // Modal Nueva Escena
  const modalCreateScene     = document.getElementById("createSceneModal");
  const closeCreateScene     = document.getElementById("closeCreateSceneModal");
  const cancelCreateScene    = document.getElementById("cancelCreateSceneModal");
  const saveSceneBtn         = document.getElementById("saveSceneBtn");

  const sceneName        = document.getElementById("sceneName");
  const sceneDesc        = document.getElementById("sceneDesc");
  const scenePanelWidth  = document.getElementById("scenePanelWidth");
  const scenePanelHeight = document.getElementById("scenePanelHeight");
  const scenePanelCount  = document.getElementById("scenePanelCount");

  const sceneBannerBox       = document.getElementById("sceneBannerBox");
  const sceneBannerPreview   = document.getElementById("sceneBannerPreview");
  const sceneBannerHint      = document.getElementById("sceneBannerHint");
  const sceneBannerInput     = document.getElementById("sceneBannerInput");

  const sceneAudioBox        = document.getElementById("sceneAudioBox");
  const sceneAudioHint       = document.getElementById("sceneAudioHint");
  const sceneAudioInput      = document.getElementById("sceneAudioInput");

  // Personajes
  const characterList        = document.getElementById("characterList");
  const charNameInput        = document.getElementById("charNameInput");
  const charColorInput       = document.getElementById("charColorInput");
  const addCharBtn           = document.getElementById("addCharBtn");

  // Estado
  let currentUser   = null;
  let bannerDataURL = null;
  let projectId     = null; // Se obtendrá del storyboard principal
  let currentCharacters = [];

  // ── Sidebar toggle ───────────────────────
  sidebarToggle?.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

  // ── Volver ─────────────────────────────────
  backBtn?.addEventListener("click", () => {
    if (projectId) {
      window.location.href = `index_projects.html?id=${projectId}`;
    } else {
      window.location.href = "projects.html";
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
    document.getElementById("appearanceBtn")?.addEventListener("click", () => {
      window.ANIM.show(document.getElementById("appearanceModal"), 'anim-modal-in');
    });
    document.getElementById("configBtn")?.addEventListener("click", () => {
      window.ANIM.show(document.getElementById("configModal"), 'anim-modal-in');
    });
    const pBtn = document.getElementById("profileBtn");
    pBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.toggleProfileCard) window.toggleProfileCard(pBtn);
    });

    await loadStoryboardDetails();
    await loadUserProfile();
    window.__initShortcuts?.(projectId, goSbShortcut);
    await loadScenes();

    // Hover sounds for sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('mouseenter', playSidebarHoverSound);
    });
  }

  // ── Cargar información del Storyboard ────
  async function loadStoryboardDetails() {
    const { data: sbData, error } = await sb.from("storyboards").select("titulo, proyecto_id").eq("id", storyboardId).single();
    if (error || !sbData) {
      alert("Error: Storyboard no encontrado. Asegúrate de haber ejecutado las consultas SQL en Supabase.");
      window.location.href = "projects.html";
      return;
    }
    projectId = sbData.proyecto_id;
    storyboardTitle.textContent = sbData.titulo || "STORYBOARD";
  }

  // ── Perfil del usuario ────────────────────
  async function loadUserProfile() {
    await window.RKCore.loadGlobalProfile();
  }

  // ── CARGAR ESCENAS ───────────────────────
  async function loadScenes() {
    const cached = window.RKCache.get(`deep_scenes_${storyboardId}`);
    if (cached?.length > 0) {
      console.log("⚡ Scenes from cache");
      renderScenesList(cached);
      // Silent background refresh
      setTimeout(async () => {
        const { data: fresh } = await sb.from("escenas").select("*").eq("storyboard_id", storyboardId).order("orden", { ascending: true });
        if (fresh) yieldRefresh(fresh);
      }, 1000);
      return;
    }

    const { data: escenas, error } = await sb.from("escenas")
      .select("*")
      .eq("storyboard_id", storyboardId)
      .order("orden", { ascending: true });

    if (error) { console.error("Error cargando escenas", error); }
    if (!escenas || escenas.length === 0) {
      scenesEmpty.style.display = "flex";
      return;
    }
    renderScenesList(escenas);
  }

  function renderScenesList(escenas) {
    scenesEmpty.style.display = "none";
    Array.from(scenesGrid.querySelectorAll(".scene-card")).forEach(el => el.remove());
    escenas.forEach(renderSceneCard);
    initDragAndDrop();
    window.RKCache.save(`deep_scenes_${storyboardId}`, escenas, 45);
  }

  function yieldRefresh(fresh) {
    const current = window.RKCache.get(`deep_scenes_${storyboardId}`);
    if (JSON.stringify(current) !== JSON.stringify(fresh)) {
      renderScenesList(fresh);
    }
  }

function renderSceneCard(scene) {
  const card = document.createElement("div");
  card.className = "scene-card ip-escena-card";
  card.dataset.id = scene.id;
  card.draggable = true;
  
  // Icono de script (Cloudinary URL proporcionada)
  const scriptIconObj = "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889740/ylxaonfjgizs41galkqn.png";

  card.innerHTML = `
    <!-- Top Drag Handle -->
    <div class="scene-drag-handle" title="Arrastrar para reordenar">
      <div class="dots-grid">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </div>
    </div>
    
    <!-- Banner -->
    <div class="scene-banner" style="cursor:pointer;" title="Ir a la escena">
      ${scene.banner_url ? `<img src="${scene.banner_url}" alt="">` : `<div class="scene-no-banner">Sin Banner</div>`}
    </div>
    
    <button class="scene-edit-btn" id="sceneEditBtn" title="Editar Escena">
      <img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889747/uf2dd6sd8qypzgkxy6pt.png" alt="" style="width:14px;filter:brightness(0) invert(1);">
    </button>

    <div class="scene-info">
      <h3 class="scene-title">${scene.titulo || "Nueva Escena"}</h3>
      
      <div class="scene-stats">
        <span><img src="icons/iconos/config.png" style="width:12px;filter:invert(1)"> ${scene.ancho_panel || 1920}x${scene.alto_panel || 1080}px</span>
        <span>${scene.cantidad_paneles || 1} pan.</span>
        ${scene.audio_url ? `<span title="Tiene audio">🎵</span>` : ''}
      </div>
      
      <p class="scene-desc">${scene.descripcion || "Sin descripción"}</p>
      
      <button class="scene-script-btn" title="Ir al Script">
        <img src="${scriptIconObj}" alt="Script"> Script
      </button>
    </div>
  `;

  // Event Listeners Card
  // 1. Al dar click al banner, va a escena.html
  card.querySelector('.scene-banner').addEventListener('click', () => {
    window.location.href = `escena.html?id=${scene.id}`;
  });

  // 2. Al dar click a script, va a script.html
  card.querySelector('.scene-script-btn').addEventListener('click', () => {
    window.location.href = `script.html?sceneId=${scene.id}`;
  });

  // 3. Al dar click a editar, abre modal
  card.querySelector('.scene-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditSceneModal(scene);
  });

  scenesGrid.appendChild(card);
}

  // ── Drag & Drop Nativo ───────────────────
  let draggedCard = null;

  function initDragAndDrop() {
    const cards = scenesGrid.querySelectorAll('.scene-card');
    
    cards.forEach(card => {
      // Usar Handle para iniciar drag
      const handle = card.querySelector('.scene-drag-handle');
      
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        setTimeout(() => card.classList.add('dragging'), 0);
      });
      
      card.addEventListener('dragend', async () => {
        draggedCard = null;
        card.classList.remove('dragging');
        
        // Guardar nuevo orden en BD
        await saveNewOrder();
      });
      
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(scenesGrid, e.clientY, e.clientX);
        if (afterElement == null) {
          scenesGrid.appendChild(draggedCard);
        } else {
          scenesGrid.insertBefore(draggedCard, afterElement);
        }
      });
    });
  }
  
  function getDragAfterElement(container, y, x) {
    const draggableElements = [...container.querySelectorAll('.scene-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const centerY = box.top + box.height / 2;
      const centerX = box.left + box.width / 2;
      
      // Heurística simple para grid: calcular distancia
      const distanceY = y - centerY;
      const distanceX = x - centerX;
      
      // Si estamos en la misma "fila", usar el offset X
      if (Math.abs(distanceY) < box.height / 2) {
         if (distanceX < 0 && distanceX > closest.offsetX) {
            return { offset: distanceX, element: child, offsetX: distanceX };
         }
      } else if (distanceY < 0 && distanceY > closest.offsetY) {
         // Fila superior
         return { offset: distanceY, element: child, offsetY: distanceY };
      }
      return closest;
    }, { offsetX: Number.NEGATIVE_INFINITY, offsetY: Number.NEGATIVE_INFINITY }).element;
  }

  async function saveNewOrder() {
    const cards = scenesGrid.querySelectorAll('.scene-card');
    const updates = Array.from(cards).map((card, index) => ({
      id: card.dataset.id,
      orden: index
    }));
    
    if (updates.length > 0) {
      // Supabase no tiene update batch simple por id a menos que hagamos un loop o una rpc
      for (const req of updates) {
        await sb.from("escenas").update({ orden: req.orden }).eq("id", req.id);
      }
      showToast("✔ Orden guardado");
    }
  }

  // ── MODAL NUEVA ESCENA ──────────────────
  btnNuevaEscena?.addEventListener("click", () => {
    sceneName.value = "";
    sceneDesc.value = "";
    sceneBannerInput.value = "";
    sceneAudioInput.value = "";
    bannerDataURL = null;
    
    sceneBannerPreview.src = "";
    sceneBannerPreview.classList.remove("loaded");
    sceneBannerHint.textContent = "Haz clic para subir imagen";
    sceneAudioHint.textContent = "Ningún archivo";

    currentCharacters = [];
    renderCharacters();
    charNameInput.value = "";
    charColorInput.value = "#ff0000";
    
    window.ANIM.show(modalCreateScene, 'anim-modal-in');
  });

  function renderCharacters() {
    characterList.innerHTML = "";
    currentCharacters.forEach((char, index) => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "10px";
      item.style.background = "rgba(255,255,255,0.05)";
      item.style.padding = "6px 12px";
      item.style.borderRadius = "8px";
      
      const colorBox = document.createElement("div");
      colorBox.style.width = "16px";
      colorBox.style.height = "16px";
      colorBox.style.borderRadius = "50%";
      colorBox.style.backgroundColor = char.color;
      
      const nameTxt = document.createElement("span");
      nameTxt.textContent = char.name;
      nameTxt.style.color = "white";
      nameTxt.style.flex = "1";
      nameTxt.style.fontFamily = "'Etna', sans-serif";
      nameTxt.style.fontSize = "14px";
      
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.style.background = "transparent";
      delBtn.style.border = "none";
      delBtn.style.color = "#ff4444";
      delBtn.style.cursor = "pointer";
      delBtn.onclick = () => {
        currentCharacters.splice(index, 1);
        renderCharacters();
      };
      
      item.appendChild(colorBox);
      item.appendChild(nameTxt);
      item.appendChild(delBtn);
      characterList.appendChild(item);
    });
  }

  addCharBtn?.addEventListener("click", () => {
    const name = charNameInput.value.trim();
    const color = charColorInput.value;
    if (name) {
      currentCharacters.push({ name, color });
      renderCharacters();
      charNameInput.value = "";
    }
  });

  closeCreateScene?.addEventListener("click", () => window.ANIM.hide(modalCreateScene, 'anim-modal-out'));
  cancelCreateScene?.addEventListener("click", () => window.ANIM.hide(modalCreateScene, 'anim-modal-out'));
  modalCreateScene?.addEventListener("click", e => { if (e.target === modalCreateScene) window.ANIM.hide(modalCreateScene, 'anim-modal-out'); });

  // Banner input
  sceneBannerBox?.addEventListener('click', () => sceneBannerInput.click());
  sceneBannerInput?.addEventListener('change', async () => {
    const file = sceneBannerInput.files?.[0];
    if (file) {
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) {
        bannerDataURL = cropped;
        sceneBannerPreview.src = bannerDataURL;
        sceneBannerPreview.classList.add("loaded");
        sceneBannerHint.textContent = "Imagen recortada";
      }
    }
  });

  // Audio input
  sceneAudioBox?.addEventListener('click', () => sceneAudioInput.click());
  sceneAudioInput?.addEventListener('change', () => {
    const file = sceneAudioInput.files?.[0];
    if (file) sceneAudioHint.textContent = file.name;
  });

  // GUARDAR
  // ── MODAL EDITAR ESCENA ──────────────────
  const modalEditScene         = document.getElementById("editSceneModal");
  const closeEditScene         = document.getElementById("closeEditSceneModal");
  const cancelEditScene        = document.getElementById("cancelEditSceneModal");
  const editSceneName          = document.getElementById("editSceneName");
  const editSceneDesc          = document.getElementById("editSceneDesc");
  const editScenePanelWidth    = document.getElementById("editScenePanelWidth");
  const editScenePanelHeight   = document.getElementById("editScenePanelHeight");
  const editSceneBannerBox     = document.getElementById("editSceneBannerBox");
  const editSceneBannerInput   = document.getElementById("editSceneBannerInput");
  const editSceneBannerPreview = document.getElementById("editSceneBannerPreview");
  const editSceneBannerHint    = document.getElementById("editSceneBannerHint");
  const editSceneAudioBox      = document.getElementById("editSceneAudioBox");
  const editSceneAudioInput    = document.getElementById("editSceneAudioInput");
  const editSceneAudioHint     = document.getElementById("editSceneAudioHint");
  const editCharacterList      = document.getElementById("editCharacterList");
  const editCharNameInput      = document.getElementById("editCharNameInput");
  const editCharColorInput     = document.getElementById("editCharColorInput");
  const editAddCharBtn         = document.getElementById("editAddCharBtn");
  const saveEditSceneBtn       = document.getElementById("saveEditSceneBtn");
  const deleteSceneBtn         = document.getElementById("deleteSceneBtn");

  let editCurrentCharacters = [];
  let editingSceneId = null;

  function openEditSceneModal(scene) {
    editingSceneId = scene.id;
    editSceneName.value = scene.titulo || "";
    editSceneDesc.value = scene.descripcion || "";
    editScenePanelWidth.value = scene.ancho_panel || 1920;
    editScenePanelHeight.value = scene.alto_panel || 1080;
    
    editSceneBannerPreview.src = scene.banner_url || "";
    editSceneBannerPreview.style.display = scene.banner_url ? "block" : "none";
    editSceneBannerHint.textContent = scene.banner_url ? "Clic para cambiar imagen" : "Haz clic para subir imagen";
    editSceneAudioHint.textContent = scene.audio_url ? "Audio cargado" : "Ningún archivo";

    editCurrentCharacters = Array.isArray(scene.personajes) ? JSON.parse(JSON.stringify(scene.personajes)) : [];
    renderEditCharacters();
    
    window.ANIM.show(modalEditScene, 'anim-modal-in');
  }

  function renderEditCharacters() {
    editCharacterList.innerHTML = "";
    editCurrentCharacters.forEach((char, index) => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "10px";
      item.style.background = "rgba(255,255,255,0.05)";
      item.style.padding = "6px 12px";
      item.style.borderRadius = "8px";
      
      const colorBox = document.createElement("div");
      colorBox.style.width = "16px";
      colorBox.style.height = "16px";
      colorBox.style.borderRadius = "50%";
      colorBox.style.backgroundColor = char.color;
      
      const nameTxt = document.createElement("span");
      nameTxt.textContent = char.name;
      nameTxt.style.color = "white";
      nameTxt.style.flex = "1";
      nameTxt.style.fontFamily = "'Etna', sans-serif";
      nameTxt.style.fontSize = "14px";
      
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.style.background = "transparent";
      delBtn.style.border = "none";
      delBtn.style.color = "#ff4444";
      delBtn.style.cursor = "pointer";
      delBtn.onclick = () => {
        editCurrentCharacters.splice(index, 1);
        renderEditCharacters();
      };
      
      item.appendChild(colorBox);
      item.appendChild(nameTxt);
      item.appendChild(delBtn);
      editCharacterList.appendChild(item);
    });
  }

  editAddCharBtn?.addEventListener("click", () => {
    const name = editCharNameInput.value.trim();
    const color = editCharColorInput.value;
    if (name) {
      editCurrentCharacters.push({ name, color });
      renderEditCharacters();
      editCharNameInput.value = "";
    }
  });

  closeEditScene?.addEventListener("click", () => window.ANIM.hide(modalEditScene, 'anim-modal-out'));
  cancelEditScene?.addEventListener("click", () => window.ANIM.hide(modalEditScene, 'anim-modal-out'));
  modalEditScene?.addEventListener("click", e => { if (e.target === modalEditScene) window.ANIM.hide(modalEditScene, 'anim-modal-out'); });

  editSceneBannerBox?.addEventListener('click', () => editSceneBannerInput.click());
  editSceneBannerInput?.addEventListener('change', async () => {
    const file = editSceneBannerInput.files?.[0];
    if (file) {
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) {
        editSceneBannerPreview.src = cropped;
        editSceneBannerPreview.style.display = "block";
        editSceneBannerHint.textContent = "Imagen recortada";
      }
    }
  });

  editSceneAudioBox?.addEventListener('click', () => editSceneAudioInput.click());
  editSceneAudioInput?.addEventListener('change', () => {
    const file = editSceneAudioInput.files?.[0];
    if (file) editSceneAudioHint.textContent = file.name;
  });

  saveEditSceneBtn?.addEventListener("click", async () => {
    const titulo = editSceneName.value.trim();
    if (!titulo) { showToast("ℹ Escribe un nombre para la escena", "error"); return; }

    saveEditSceneBtn.disabled = true;
    saveEditSceneBtn.textContent = "Guardando...";

    try {
      let bannerUrl = editSceneBannerPreview.src.startsWith("http") ? editSceneBannerPreview.src : null;
      if (editSceneBannerPreview.src.startsWith("data:")) {
        bannerUrl = await uploadToCloudinary(dataURLtoBlob(editSceneBannerPreview.src), "storyboards/escenas_banners");
      }
      
      let audioUrl = null; // En la versión simplificada, se mantiene el previo si no se sube uno nuevo.
      // Sin embargo, para mayor precisión, recuperamos el anterior si no hay archivo:
      const { data: currentS } = await sb.from("escenas").select("audio_url").eq("id", editingSceneId).single();
      audioUrl = currentS.audio_url;

      if (editSceneAudioInput.files?.[0]) {
        audioUrl = await uploadToCloudinary(editSceneAudioInput.files[0], "storyboards/escenas_audio", "raw");
      }
      
      const payload = {
        titulo: titulo,
        descripcion: editSceneDesc.value.trim() || null,
        ancho_panel: parseInt(editScenePanelWidth.value) || 1920,
        alto_panel: parseInt(editScenePanelHeight.value) || 1080,
        banner_url: bannerUrl,
        audio_url: audioUrl,
        personajes: editCurrentCharacters
      };

      const { error } = await sb.from("escenas").update(payload).eq("id", editingSceneId);
      if (error) throw new Error(error.message);

      window.ANIM.hide(modalEditScene, 'anim-modal-out');
      showToast("✔ Escena actualizada exitosamente");
      loadScenes(); // Recargar todo para reflejar cambios
      
    } catch(err) {
      showToast("✖ Error al actualizar: " + err.message, "error");
    } finally {
      saveEditSceneBtn.disabled = false;
      saveEditSceneBtn.textContent = "¡GUARDAR!";
    }
  });

  deleteSceneBtn?.addEventListener("click", async () => {
    if (!confirm("¿Seguro que quieres eliminar esta escena? Se perderán todos sus paneles y dibujos.")) return;
    
    deleteSceneBtn.disabled = true;
    deleteSceneBtn.textContent = "Eliminando...";

    try {
      // 1. Desvincular/eliminar mensajes relacionados a la escena
      await sb.from("mensajes").update({ reply_to_id: null }).eq("escena_id", editingSceneId);
      await sb.from("mensajes").delete().eq("escena_id", editingSceneId);

      // 2. Eliminar paneles vinculados a la escena
      await sb.from("paneles").delete().eq("escena_id", editingSceneId);

      // 3. Eliminar la escena
      const { error } = await sb.from("escenas").delete().eq("id", editingSceneId);
      if (error) throw new Error(error.message);

      showToast("✔ Escena eliminada");
      
      // Limpiar caches
      window.RKCache.remove(`deep_scenes_${storyboardId}`);
      if (projectId) window.RKCache.remove(`prefetch_p_${projectId}`);

      window.ANIM.hide(modalEditScene, 'anim-modal-out');
      loadScenes();
    } catch(err) {
      showToast("✖ Error al eliminar: " + err.message, "error");
    } finally {
      deleteSceneBtn.disabled = false;
      deleteSceneBtn.textContent = "🗑 Eliminar Escena";
    }
  });

  saveSceneBtn?.addEventListener("click", async () => {
    const titulo = sceneName.value.trim();
    if (!titulo) { showToast("ℹ Escribe un nombre para la escena", "error"); return; }

    saveSceneBtn.disabled = true;
    saveSceneBtn.textContent = "Guardando...";

    try {
      // Obtener el count para el orden
      const { count } = await sb.from("escenas").select("*", { count: "exact", head: true }).eq("storyboard_id", storyboardId);
      
      let bannerUrl = null;
      if (bannerDataURL) {
        bannerUrl = await uploadToCloudinary(dataURLtoBlob(bannerDataURL), "storyboards/escenas_banners");
      }
      
      let audioUrl = null;
      if (sceneAudioInput.files?.[0]) {
        audioUrl = await uploadToCloudinary(sceneAudioInput.files[0], "storyboards/escenas_audio", "raw");
      }
      
      const payload = {
        storyboard_id: storyboardId,
        titulo: titulo,
        descripcion: sceneDesc.value.trim() || null,
        ancho_panel: parseInt(scenePanelWidth.value) || 1920,
        alto_panel: parseInt(scenePanelHeight.value) || 1080,
        cantidad_paneles: parseInt(scenePanelCount.value) || 1,
        orden: count || 0,
        banner_url: bannerUrl,
        audio_url: audioUrl,
        personajes: currentCharacters
      };

      const { data: nueva, error } = await sb.from("escenas").insert(payload).select().single();
      if (error) throw new Error(error.message);

      scenesEmpty.style.display = "none";
      renderSceneCard(nueva);
      
      // Play sound with slight pitch variation
      const createSound = new Audio("sounds/create.mp3");
      createSound.playbackRate = 0.9 + Math.random() * 0.3;
      createSound.play().catch(() => {});

      // Reiniciar listeners drag
      initDragAndDrop();
      
      window.ANIM.hide(modalCreateScene, 'anim-modal-out');
      showToast("✔ Escena creada exitosamente");
      
    } catch(err) {
      showToast("✖ Asegúrate de haber ejecutado las consultas de BD. " + err.message, "error");
    } finally {
      saveSceneBtn.disabled = false;
      saveSceneBtn.textContent = "¡CREAR ESCENA!";
    }
  });

  function playSidebarHoverSound() { window.RKSound?.play('hover'); }

  // ══════════════════════════════════════════
  // SIDEBAR — Atajos (comparte sistema con rk_core.js)
  // ══════════════════════════════════════════
  function goSbShortcut(sc) {
    if (!sc?.type) return;
    if (sc.type === "escena" && sc.targetId) {
      window.location.href = "escena.html?id=" + sc.targetId;
      return;
    }
    if (sc.type === "concepto" && sc.targetId) {
      window.location.href = "worldbuilding.html?project_id=" + projectId + "&world_id=" + sc.targetId;
      return;
    }
    if (sc.type === "section") {
      window.location.href = "index_projects.html?id=" + projectId;
      return;
    }
  }

  // ── Manejar escena_id desde URL (navegación directa) ──
  const targetEscenaId = params.get("escena_id");
  if (targetEscenaId) {
    const _origLoadScenes = loadScenes;
    loadScenes = async function() {
      await _origLoadScenes();
      window.location.href = "escena.html?id=" + targetEscenaId;
    };
  }

  // ── EJECUCIÓN INICIAL
  init();


})();

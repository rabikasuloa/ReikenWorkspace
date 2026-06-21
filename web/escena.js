// ==========================
// ESCENA & PANELES PAGE
// ==========================
(function () {
  if (!document.getElementById("sceneTitle")) return;

  const sb = supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get("id");

  if (!sceneId) {
    window.location.href = "storyboard.html";
    return;
  }

  // DOM Elements
  const sceneTitle = document.getElementById("sceneTitle");
  const backBtn = document.getElementById("backBtn");
  const panelsGrid = document.getElementById("panelsGrid");
  const panelsEmpty = document.getElementById("panelsEmpty");
  const addPanelBtn = document.getElementById("addPanelBtn");

  // Enlarged drawing wrapper
  const enlargedModal = document.getElementById("enlargedModal");
  const closeDrawingBtn = document.getElementById("closeDrawingBtn");
  const saveDrawingBtn = document.getElementById("saveDrawingBtn");
  if (saveDrawingBtn) saveDrawingBtn.style.display = "none"; // Ya no hay save manual
  const drawingContainer = document.getElementById("drawingContainer");
  const dialoguesLayer = document.getElementById("dialoguesLayer");
  const canvasZoomWorld = document.getElementById("canvasZoomWorld");

  // Tools
  const brushDropdownBtn = document.getElementById("brushDropdownBtn");
  const brushDropdownMenu = document.getElementById("brushDropdownMenu");
  const brushDropdownLabel = document.getElementById("brushDropdownLabel");
  const brushOptBtns = document.querySelectorAll(".brush-opt-btn");
  const brushPreviewCvs = document.querySelectorAll(".brush-preview-cvs");

  const toolEraser = document.getElementById("toolEraser");
  const toolSize = document.getElementById("toolSize");
  const toolColor = document.getElementById("toolColor");
  const canvasBgColor = document.getElementById("canvasBgColor");

  // Quick Dialogue Bar
  const qdCharBtn = document.getElementById("qdCharBtn");
  const qdCharImg = document.getElementById("qdCharImg");
  const qdInput = document.getElementById("qdInput");
  const qdAddBtn = document.getElementById("qdAddBtn");
  const qdCharDropdown = document.getElementById("qdCharDropdown");
  let qdActiveChar = null;

  // Layers UI
  const canvasDialogueFooter = document.getElementById("canvasDialogueFooter");
  const layersManager = document.getElementById("layersManager");
  const addLayerBtn = document.getElementById("addLayerBtn");
  const layersList = document.getElementById("layersList");
  const layersContainer = document.getElementById("layersContainer");
  const toggleLayersBtn = document.getElementById("toggleLayersBtn");
  const shortcutSettingsBtn = document.getElementById("shortcutSettingsBtn");
  const shortcutModal = document.getElementById("shortcutModal");
  const shortcutListContainer = document.getElementById("shortcutListContainer");
  const closeShortcutModal = document.getElementById("closeShortcutModal");

  const toggleOnionSkinBtn = document.getElementById("toggleOnionSkinBtn");
  const onionSkinCanvas = document.getElementById("onionSkinCanvas");
  const onionCtx = onionSkinCanvas ? onionSkinCanvas.getContext("2d") : null;
  let isOnionSkinActive = false;

  if (toggleOnionSkinBtn) {
    toggleOnionSkinBtn.addEventListener("click", () => {
      isOnionSkinActive = !isOnionSkinActive;
      toggleOnionSkinBtn.style.background = isOnionSkinActive ? "#db6f4e" : "";
      updateOnionSkin();
    });
  }

  function updateOnionSkin() {
    if (!onionCtx || !onionSkinCanvas) return;
    onionCtx.clearRect(0, 0, cWidth, cHeight);

    if (!isOnionSkinActive || !activePanelId) {
      onionSkinCanvas.style.display = "none";
      return;
    }

    const pIndex = panelsData.findIndex(p => p.id === activePanelId);
    if (pIndex > 0) {
      onionSkinCanvas.style.display = "block";
      // Fallback: show a semi-transparent overlay as placeholder
      // (thumbnails from Cloudinary are no longer uploaded; future: load from Yjs)
      onionCtx.fillStyle = "rgba(255,255,255,0.05)";
      onionCtx.fillRect(0, 0, cWidth, cHeight);
    } else {
      onionSkinCanvas.style.display = "none";
    }
  }

  const cursorCanvas = document.getElementById("cursorCanvas");
  const cursorCtx = cursorCanvas.getContext("2d");

  // State
  let currentUser = null;
  let currentScene = null;
  let activePanelId = null;
  let panelsData = [];
  let currentDialogues = [];

  // Canvas dimensions
  let cWidth = 1920;
  let cHeight = 1080;

  const charIconUrl = "https://res.cloudinary.com/dyy6zbkop/image/upload/v1774987836/yx0jtu7jte38qbqwsy68.png";

  // Drawing state
  let isDrawing = false;
  let drawMode = "brush"; // brush, pencil, marker
  let isEraserActive = false;
  let lastX = 0;
  let lastY = 0;
  let stabilizedX = 0;
  let stabilizedY = 0;
  let midX = 0;
  let midY = 0;
  let lastDist = 0;
  let stabilizerValue = 10;
  let brushOpacity = 100;
  let lastDynamicSize = 5;

  // Layers state
  let layersData = [];
  let activeLayerIndex = -1;
  let customZoom = 1.0;
  let undoStack = [];
  let redoStack = [];

  let lastCursorPos = { x: 0, y: 0 };
  let lastStrokePoints = null;  // { points: Float32Array, tool, color, size, opacity } for current stroke

  // Realtime state (shared: presence, cursor, reactions)
  let drawingChannel = null;
  let remoteUsers = {};
  let lastBroadcastTime = 0;

  // ── Animation Helpers ──
  // ANIM is now global: window.ANIM

  // Yjs sync instance
  let panelSync = null;

  // Debounced sync helper
  let _syncTimer = null;
  function syncToYjs() {
    if (!panelSync || !panelSync.ready) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
      if (panelSync && panelSync.ready) {
        panelSync.syncCanvasToYjs(layersData, canvasBgColor.value, currentDialogues);
      }
    }, 100);
  }

  // ── LIVE STROKE BROADCAST ────────────────
  let currentSegment = [];

  function broadcastDrawStep(segment) {
    if (!drawingChannel || !segment || segment.length < 2) return;
    try {
      drawingChannel.send({
        type: 'broadcast',
        event: 'draw-step',
        payload: {
          points: segment,
          color: toolColor.value,
          opacity: brushOpacity / 100,
          composite: isEraserActive ? 'destination-out' : 'source-over',
          drawMode,
          layerId: activeLayerIndex >= 0 ? layersData[activeLayerIndex].id : null
        }
      });
    } catch (e) {}
  }

  // ── TOOL MODE ─────────────────────────────
  // activeTool controla qué hace el pointer: 'draw', 'lasso', 'rectSelect', 'eyedropper', 'move'
  let activeTool = 'draw';

  // ── SELECTION STATE ───────────────────────
  let selectionPath = [];       // Array de {x, y} para el lazo
  let selectionRect = null;     // {x, y, w, h} para selección rect
  let isSelecting = false;
  let selectionImageData = null; // ImageData recortada
  let selectionOffsetX = 0;
  let selectionOffsetY = 0;
  let isMovingSelection = false;
  let moveStartX = 0;
  let moveStartY = 0;
  let clipboardData = null;      // Para copiar/pegar entre paneles
  let clipboardWidth = 0;
  let clipboardHeight = 0;

  // ── FLIP & ROTATE ─────────────────────────
  let isFlipped = false;
  let canvasRotation = 0; // 0 | 90 | 180 | 270

  // ── SPACE PAN ──────────────────────────────
  let isSpaceHeld = false;
  let previousToolBeforePan = 'draw';
  let panStartX = 0, panStartY = 0;
  let isPanning = false;

  // ── COLOR PALETTE ─────────────────────────
  let savedColors = JSON.parse(localStorage.getItem("rkSavedColors")) || Array(12).fill(null);
  let recentColors = JSON.parse(localStorage.getItem("rkRecentColors")) || [];

  // Shortcut customization state
  const defaultShortcuts = {
    brush: 'b',
    pencil: 'n',
    marker: 'm',
    eraser: 'e',
    lasso: 'l',
    rectSelect: 's',
    eyedropper: 'i',
    moveSelection: 'v',
    layers: 'f7',
    onionSkin: 'o',
    flipCanvas: 'h',
    sizeUp: ']',
    sizeDown: '[',
    panelNext: 'arrowright',
    panelPrev: 'arrowleft',
    penLower: 'btn_2',
    penUpper: 'btn_1',
    zoomIn: '=',
    zoomOut: '-',
    zoomReset: '0',
    rotateCW: 'r',
    rotateCCW: 'shift+r'
  };
  let userShortcuts;
  try {
    const saved = localStorage.getItem("rkShortcuts");
    userShortcuts = saved ? JSON.parse(saved) : { ...defaultShortcuts };
  } catch (e) {
    console.warn("Error loading shortcuts, using defaults:", e);
    userShortcuts = { ...defaultShortcuts };
  }
  let recordingShortcutFor = null;

  // Sidebar toggle & Back
  const sidebarEl = document.getElementById("sidebar");
  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    // Bloquear toggle si estamos en modo panel
    if (!enlargedModal.classList.contains("hidden")) return;
    sidebarEl.classList.toggle("collapsed");
    setTimeout(adjustCanvasScale, 300); // readjust canvas after sidebar animation
  });

  backBtn?.addEventListener("click", () => {
    if (currentScene?.storyboard_id) {
      window.location.href = `storyboard.html?id=${currentScene.storyboard_id}`;
    } else {
      window.history.back();
    }
  });

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user;
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user;
    window.currentUser = user;
    // Inyectar modales modulares
    if (window.injectAppearanceModal) window.injectAppearanceModal();
    if (window.injectConfigModal) window.injectConfigModal();

    // Wire Sidebar Buttons
    document.getElementById("appearanceBtn")?.addEventListener("click", () => {
    window.ANIM.show(document.getElementById("appearanceModal"));
  });
  document.getElementById("configBtn")?.addEventListener("click", () => {
    window.ANIM.show(document.getElementById("configModal"));
    });
    const pBtn = document.getElementById("profileBtn");
    pBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.toggleProfileCard) window.toggleProfileCard(pBtn);
    });

    document.getElementById("btnAnimatica")?.addEventListener("click", () => {
      window.location.href = `animatica.html?id=${sceneId}`;
    });

    await loadSceneData();
    await loadUserProfile();
    await loadPanels();

    // Hover sounds for sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('mouseenter', playSidebarHoverSound);
    });
  }

  async function loadUserProfile() {
    await window.RKCore.loadGlobalProfile();
  }

  function playSidebarHoverSound() { window.RKSound?.play('hover'); }


  async function loadSceneData() {
    const { data, error } = await sb.from("escenas").select("*").eq("id", sceneId).single();
    if (error || !data) {
      alert("Error cargando escena.");
      return;
    }
    currentScene = data;
    sceneTitle.textContent = currentScene.titulo || "Escena";

    // Config canvas size
    cWidth = currentScene.ancho_panel || 1920;
    cHeight = currentScene.alto_panel || 1080;

    cursorCanvas.width = cWidth;
    cursorCanvas.height = cHeight;
  }

  async function loadPanels() {
    const { data, error } = await sb.from("paneles").select("*").eq("escena_id", sceneId).order("orden", { ascending: true });

    if (!data || data.length === 0) {
      const generateCount = currentScene.cantidad_paneles || 1;
      panelsData = [];
      for (let i = 0; i < generateCount; i++) {
        panelsData.push(await createNewPanel(i));
      }
    } else {
      panelsData = data;
    }

    renderGrid();
  }

  async function createNewPanel(orden) {
    const payload = { escena_id: sceneId, orden: orden };
    const { data, error } = await sb.from("paneles").insert(payload).select().single();
    if (error) {
      return {
        id: "temp_" + Date.now() + Math.random().toString().slice(2, 8),
        escena_id: sceneId,
        orden: orden,
        imagen_url: null,
        capas: null,
        dialogos: [],
        canvas_bg: "#ffffff"
      };
    }
    return data;
  }

  function renderGrid() {
    const emptyDiv = document.getElementById("panelsEmpty");
    panelsGrid.innerHTML = "";
    panelsGrid.appendChild(emptyDiv);

    if (panelsData.length === 0) {
      emptyDiv.style.display = "flex";
      return;
    }
    emptyDiv.style.display = "none";

    panelsData.forEach((panel, index) => {
      const card = document.createElement("div");
      card.className = "escena-panel-card";
      card.draggable = true;
      card.dataset.id = panel.id;

      const handle = document.createElement("div");
      handle.className = "panel-drag-handle";
      handle.title = "Arrastrar para reordenar";
      handle.innerHTML = `<div class="dots-grid"><span></span><span></span><span></span><span></span><span></span><span></span></div>`;
      card.appendChild(handle);

      const editBtn = document.createElement("div");
      editBtn.className = "panel-edit-btn";
      editBtn.title = "Editar panel";
      editBtn.innerHTML = `<img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889747/uf2dd6sd8qypzgkxy6pt.png" alt="">`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPanelEditModal(panel, card);
      });
      card.appendChild(editBtn);

      // Dialogue Toggle Button
      const diagBtn = document.createElement("div");
      diagBtn.className = "panel-dialogs-btn";
      diagBtn.title = "Ver diálogos";
      diagBtn.innerHTML = `<img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889739/mbqxhbmnu2fgfqok1fta.png" alt="">`;
      card.appendChild(diagBtn);

      const thumb = document.createElement("div");
      thumb.className = "escena-panel-thumb";

      // Intentar cargar la imagen desde canvas_data o desde el campo top-level (compatibilidad)
      const imgUrl = (panel.canvas_data && panel.canvas_data.imagen_url) ? panel.canvas_data.imagen_url : panel.imagen_url;

      if (imgUrl) {
        thumb.style.backgroundImage = `url(${imgUrl})`;
      } else {
        thumb.innerText = "Panel Vacio";
      }

      // Mostrar duración si existe
      const dur = (panel.canvas_data && panel.canvas_data.duracion) ? panel.canvas_data.duracion : "1.0";
      const durTag = document.createElement("div");
      durTag.className = "panel-duration-tag";
      durTag.innerText = `${dur}s`;
      thumb.appendChild(durTag);

      const info = document.createElement("div");
      info.className = "escena-panel-info";
      info.innerText = `Panel ${index + 1}`;

      // Dialogue List Container
      const diagList = document.createElement("div");
      diagList.className = "panel-dialogs-list";
      const dialogos = (panel.canvas_data && panel.canvas_data.dialogos) ? panel.canvas_data.dialogos : [];
      if (dialogos.length > 0) {
        dialogos.forEach(d => {
          const row = document.createElement("div");
          row.className = "pdl-row";
          const charName = d.personaje ? d.personaje.name : "???";
          const charColor = d.personaje ? d.personaje.color : "#ccc";
          const formatActionsPreview = (txt) => {
            let res = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const actionStyle = 'color:#db6f4e; font-style:italic; font-size:0.85em; opacity:0.9;';
            res = res.replace(/\((.*?)\)/g, `<span style="${actionStyle}">($1)</span>`);
            res = res.replace(/\*(.*?)\*/g, `<span style="${actionStyle}">*$1*</span>`);
            return res;
          };
          const formattedText = formatActionsPreview(d.texto || "");
          row.innerHTML = `<span class="pdl-name" style="color:${charColor}">${charName}:</span> <span class="pdl-text">"${formattedText}"</span>`;
          diagList.appendChild(row);
        });
      } else {
        diagList.innerHTML = `<div style="text-align:center; opacity:0.5; padding:4px;">Sin diálogos</div>`;
      }

      diagBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        diagList.classList.toggle("expanded");
        diagBtn.style.background = diagList.classList.contains("expanded") ? "#db6f4e" : "";
      });

      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(diagList);

      card.addEventListener("click", (e) => {
        if (e.target.closest(".panel-drag-handle") || e.target.closest(".panel-dialogs-btn") || e.target.closest(".panel-edit-btn")) return;
        openPanelWorkspace(panel);
      });

      panelsGrid.appendChild(card);
    });

    initPanelsDragAndDrop();
  }

  let draggedPanelCard = null;

  function initPanelsDragAndDrop() {
    const cards = panelsGrid.querySelectorAll('.escena-panel-card');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedPanelCard = card;
        setTimeout(() => card.classList.add('dragging'), 0);
      });

      card.addEventListener('dragend', async () => {
        draggedPanelCard = null;
        card.classList.remove('dragging');
        await savePanelsNewOrder();
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(panelsGrid, e.clientY, e.clientX);
        if (afterElement == null) {
          panelsGrid.appendChild(draggedPanelCard);
        } else {
          panelsGrid.insertBefore(draggedPanelCard, afterElement);
        }
      });
    });
  }

  function getDragAfterElement(container, y, x) {
    const draggableElements = [...container.querySelectorAll('.escena-panel-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const centerY = box.top + box.height / 2;
      const centerX = box.left + box.width / 2;

      const distanceY = y - centerY;
      const distanceX = x - centerX;

      if (Math.abs(distanceY) < box.height / 2) {
        if (distanceX < 0 && distanceX > closest.offsetX) {
          return { offset: distanceX, element: child, offsetX: distanceX };
        }
      } else if (distanceY < 0 && distanceY > closest.offsetY) {
        return { offset: distanceY, element: child, offsetY: distanceY };
      }
      return closest;
    }, { offsetX: Number.NEGATIVE_INFINITY, offsetY: Number.NEGATIVE_INFINITY }).element;
  }

  async function savePanelsNewOrder() {
    const cards = [...panelsGrid.querySelectorAll('.escena-panel-card')];
    const newOrder = cards.map((card, i) => ({
      id: card.dataset.id,
      orden: i
    }));

    // Actualizar localmente primero para feedback instantáneo
    newOrder.forEach(item => {
      const p = panelsData.find(p => p.id === item.id);
      if (p) p.orden = item.orden;
    });
    panelsData.sort((a, b) => a.orden - b.orden);

    // Actualizar etiquetas visuales
    cards.forEach((card, i) => {
      const info = card.querySelector('.escena-panel-info');
      if (info) info.innerText = `Panel ${i + 1}`;
    });

    // Sincronizar con Supabase
    try {
      const promises = newOrder.map(item =>
        sb.from("paneles").update({ orden: item.orden }).eq("id", item.id)
      );
      await Promise.all(promises);
      showToast("✔ Orden de paneles actualizado");
    } catch (err) {
      console.error(err);
      showToast("✖ Error al sincronizar orden", "error");
    }
  }

  // ── MODAL EDITAR / ELIMINAR PANEL ───────────────────────
  function openPanelEditModal(panel, cardEl) {
    // Build the modal dynamically so it matches the create-scene style
    let overlay = document.getElementById("panelEditOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "panelEditOverlay";
      overlay.className = "modal-overlay";
      overlay.style.zIndex = "9999";
      document.body.appendChild(overlay);
    }

    const currentDur = (panel.canvas_data && panel.canvas_data.duracion) ? panel.canvas_data.duracion : "1.0";

    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2>Editar Panel</h2>
          <button class="modal-close" id="pem-close">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;margin-top:10px;">
          <div>
            <label style="color:white;font-family:'Etna';font-size:12px;display:block;margin-bottom:6px;">Duración (segundos)</label>
            <input id="pem-dur" type="number" step="0.1" min="0.1" value="${currentDur}"
              class="modal-input" style="width:100%;box-sizing:border-box;">
          </div>

          <div>
            <label style="color:white;font-family:'Etna';font-size:12px;display:block;margin-bottom:6px;">Imagen del panel (reemplazar)</label>
            <div class="modal-file-box" id="pem-img-box">
              <div class="modal-file-left">
                <div class="modal-file-thumb">
                  <img id="pem-img-preview" src="${(panel.canvas_data && panel.canvas_data.imagen_url) ? panel.canvas_data.imagen_url : ''}" alt="" style="${(panel.canvas_data && panel.canvas_data.imagen_url) ? 'display:block' : 'display:none'}">
                </div>
                <div class="modal-file-meta">
                  <p class="modal-file-title">Imagen del panel</p>
                  <p class="modal-file-hint" id="pem-img-hint">${(panel.canvas_data && panel.canvas_data.imagen_url) ? 'Clic para cambiar' : 'Haz clic para subir imagen'}</p>
                </div>
              </div>
              <div class="modal-file-action">+</div>
            </div>
            <input type="file" id="pem-img-input" accept="image/*" style="display:none;">
          </div>

          <div>
            <label style="color:white;font-family:'Etna';font-size:12px;display:block;margin-bottom:6px;">Voice Over (reemplazar)</label>
            <div class="modal-file-box" id="pem-vo-box">
              <div class="modal-file-left">
                <div class="modal-file-thumb"></div>
                <div class="modal-file-meta">
                  <p class="modal-file-title">Pista de audio</p>
                  <p class="modal-file-hint" id="pem-vo-hint">${(panel.voiceover_url) ? 'Audio cargado — clic para cambiar' : 'Ningún archivo'}</p>
                </div>
              </div>
              <div class="modal-file-action">+</div>
            </div>
            <input type="file" id="pem-vo-input" accept="audio/*" style="display:none;">
          </div>
        </div>

        <div class="modal-footer" style="margin-top:18px;justify-content:space-between;">
          <button id="pem-delete"
            class="button-secondary"
            style="background:rgba(168,34,33,0.25);border-color:rgba(168,34,33,0.6);color:#ff6b6b;">
            🗑 Eliminar Panel
          </button>
          <div style="display:flex;gap:10px;">
            <button class="button-secondary" id="pem-cancel">Cancelar</button>
            <button class="button-main modal-save-btn" id="pem-save">¡GUARDAR!</button>
          </div>
        </div>
      </div>
    `;

    overlay.style.display = "flex";
    window.ANIM.show(overlay, 'anim-modal-in');

    // Refs
    const imgBox = overlay.querySelector("#pem-img-box");
    const imgInput = overlay.querySelector("#pem-img-input");
    const imgHint = overlay.querySelector("#pem-img-hint");
    const imgPreview = overlay.querySelector("#pem-img-preview");
    const voBox = overlay.querySelector("#pem-vo-box");
    const voInput = overlay.querySelector("#pem-vo-input");
    const voHint = overlay.querySelector("#pem-vo-hint");
    const durInput = overlay.querySelector("#pem-dur");

    let newImgFile = null;
    let newVoFile = null;

    imgBox.addEventListener("click", () => imgInput.click());
    imgInput.addEventListener("change", () => {
      const f = imgInput.files?.[0];
      if (!f) return;
      newImgFile = f;
      imgHint.textContent = f.name;
      const reader = new FileReader();
      reader.onload = ev => {
        imgPreview.src = ev.target.result;
        imgPreview.style.display = "block";
      };
      reader.readAsDataURL(f);
    });

    voBox.addEventListener("click", () => voInput.click());
    voInput.addEventListener("change", () => {
      const f = voInput.files?.[0];
      if (f) { newVoFile = f; voHint.textContent = f.name; }
    });

    const closeModal = () => {
      window.ANIM.hide(overlay, 'anim-modal-out');
    };

    overlay.querySelector("#pem-close").onclick = closeModal;
    overlay.querySelector("#pem-cancel").onclick = closeModal;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

    // ── Guardar cambios ──
    overlay.querySelector("#pem-save").onclick = async () => {
      const saveBtn = overlay.querySelector("#pem-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando...";

      try {
        const durNum = parseFloat(durInput.value.replace(",", "."));
        const newDur = (!isNaN(durNum) && durNum > 0) ? durNum.toFixed(1) : "1.0";

        let imageUrl = (panel.canvas_data && panel.canvas_data.imagen_url) || null;
        if (newImgFile) {
          imageUrl = await uploadToCloudinary(newImgFile, "paneles/imagenes");
        }

        let voiceoverUrl = panel.voiceover_url || null;
        if (newVoFile) {
          voiceoverUrl = await uploadToCloudinary(newVoFile, "paneles/voiceovers", "raw");
        }

        const newCanvasData = { ...(panel.canvas_data || {}), duracion: newDur, imagen_url: imageUrl };
        const updatePayload = { canvas_data: newCanvasData, voiceover_url: voiceoverUrl };

        const { data: updated, error } = await sb.from("paneles").update(updatePayload).eq("id", panel.id).select().single();
        if (error) throw error;

        // Update in memory
        const idx = panelsData.findIndex(p => p.id === panel.id);
        if (idx !== -1) panelsData[idx] = updated;

        renderGrid();
        closeModal();
        showToast("✔ Panel actualizado");
      } catch (err) {
        showToast("✖ Error: " + err.message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "¡GUARDAR!";
      }
    };

    // ── Eliminar panel ──
    overlay.querySelector("#pem-delete").onclick = async () => {
      const totalPanels = panelsData.length;
      if (totalPanels <= 1) {
        showToast("ℹ No puedes eliminar el único panel de la escena", "error");
        return;
      }

      const panelIdx = panelsData.findIndex(p => p.id === panel.id) + 1;
      if (!confirm(`¿Eliminar Panel ${panelIdx}?\n\nSe perderá el dibujo guardado en este panel.`)) return;

      const delBtn = overlay.querySelector("#pem-delete");
      delBtn.disabled = true;
      delBtn.textContent = "Eliminando...";

      try {
        const { error } = await sb.from("paneles").delete().eq("id", panel.id);
        if (error) throw error;

        panelsData = panelsData.filter(p => p.id !== panel.id);
        renderGrid();
        closeModal();
        showToast("✔ Panel eliminado");
      } catch (err) {
        showToast("✖ Error: " + err.message, "error");
        delBtn.disabled = false;
        delBtn.textContent = "🗑 Eliminar Panel";
      }
    };
  }

  async function updatePanelDuration(panel) {
    const modal = document.getElementById("durationModal");
    const input = document.getElementById("durationInput");
    const btnSave = document.getElementById("btnSaveDuration");
    const btnCancel = document.getElementById("btnCancelDuration");

    if (!modal || !input) return;

    await window.ANIM.show(modal, 'anim-scale-in');
    const currentDur = (panel.canvas_data && panel.canvas_data.duracion) ? panel.canvas_data.duracion : "1.0";
    input.value = currentDur;
    input.focus();

    // Limpiar listeners previos para evitar duplicados
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnCancel.onclick = () => window.ANIM.hide(modal, 'anim-scale-out');

    newBtnSave.onclick = async () => {
      const durNum = parseFloat(input.value.replace(",", "."));
      if (isNaN(durNum) || durNum <= 0) {
        showToast("ℹ Duración inválida", "error");
        return;
      }

      const cleanDur = durNum.toFixed(1);
      newBtnSave.disabled = true;
      newBtnSave.innerText = "...";

      try {
        const newCanvasData = { ...(panel.canvas_data || {}), duracion: cleanDur };
        const { data, error } = await sb.from("paneles").update({ canvas_data: newCanvasData }).eq("id", panel.id).select().single();

        if (error) throw error;

        const idx = panelsData.findIndex(p => p.id === panel.id);
        if (idx !== -1) panelsData[idx] = data;

        renderGrid();
        showToast(`✔ Duración: ${cleanDur}s`);
        await window.ANIM.hide(modal, 'anim-scale-out');
      } catch (err) {
        console.error(err);
        showToast("✖ Error al guardar", "error");
      } finally {
        newBtnSave.disabled = false;
        newBtnSave.innerText = "GUARDAR";
      }
    };
  }

  addPanelBtn?.addEventListener("click", async () => {
    panelsData.push(await createNewPanel(panelsData.length));

    // Play sound with slight pitch variation
    const createSound = new Audio("sounds/create.mp3");
    createSound.playbackRate = 0.9 + Math.random() * 0.3;
    createSound.play().catch(() => { });

    renderGrid();
  });

  // ── DRAWING WORKSPACE LOGIC ───────────────

  async function openPanelWorkspace(panel) {
    activePanelId = panel.id;

    layersContainer.innerHTML = "";
    layersData = [];
    activeLayerIndex = -1;
    undoStack = [];
    redoStack = [];
    customZoom = 0.85;

    // Init Realtime channel (presence, cursor, reactions)
    setupRealtimeChannel(panel.id);

    // Init Yjs sync (ReikenPanelSync). Si falla (Yjs CDN, tabla paneles_doc), cae a legacy.
    if (panelSync) { panelSync.destroy(); panelSync = null; }
    let yState = null;
    try {
      if (typeof ReikenPanelSync !== 'undefined') {
        panelSync = new ReikenPanelSync(panel.id, cWidth, cHeight, drawingChannel);
        await panelSync.init();
        yState = panelSync.applyToCanvas();
      }
    } catch (e) {
      console.warn('[openPanelWorkspace] Yjs init failed, using legacy data:', e);
      if (panelSync) { panelSync.destroy(); panelSync = null; }
      yState = null;
    }

    // Load state from Yjs or create defaults

    let bg = '#ffffff';
    if (yState && yState.layers.length > 0) {
      // Render layers from Yjs
      yState.layers.forEach(l => {
        createLayer(l.id, l.opacity, l.dataUrl);
      });
      activeLayerIndex = layersData.length > 0 ? layersData.length - 1 : -1;
      bg = yState.bgColor || '#ffffff';
      currentDialogues = yState.dialogues || [];
    } else {
      // Create default layers
      const data = panel.canvas_data || {};
      currentDialogues = data.dialogos || panel.dialogos || [];
      bg = data.bg || '#ffffff';

      createLayer('Fondo', 1.0);
      layersData[0].ctx.fillStyle = '#ffffff';
      layersData[0].ctx.fillRect(0, 0, cWidth, cHeight);

      createLayer('Capa 1', 1.0);
      activeLayerIndex = 1;

      // Sync defaults to Yjs immediately
      syncToYjs();
    }

    canvasBgColor.value = bg;
    layersContainer.style.backgroundColor = bg;

    renderLayersUI();
    renderDialogues();
    updateLayerCanvasTransforms();
    updatePreviews();

    // Animate: fade out grid, show workspace
    await window.ANIM.hide(panelsGrid, 'anim-fade-out');
    enlargedModal.classList.remove("hidden");
    enlargedModal.classList.add('anim-fade-in');
    await new Promise(r => {
      enlargedModal.addEventListener('animationend', () => {
        enlargedModal.classList.remove('anim-fade-in');
        r();
      }, { once: true });
    });

    // Colapsar sidebar y bloquearla
    sidebarEl?.classList.add("collapsed");
    setTimeout(adjustCanvasScale, 300);
    const info = adjustCanvasScale();
    if (info) {
      const containerWidth = drawingContainer.clientWidth;
      const containerHeight = drawingContainer.clientHeight;
      drawingContainer.scrollLeft = info.marginLeft - (containerWidth / 2) + (cWidth * info.scale / 2);
      drawingContainer.scrollTop = info.marginTop - (containerHeight / 2) + (cHeight * info.scale / 2);
    }

    // Configurar transformaciones del onion skin
    if (onionSkinCanvas) {
      onionSkinCanvas.width = cWidth;
      onionSkinCanvas.height = cHeight;
    }
    updateOnionSkin();

    // Listen for remote Yjs updates → re-render canvas
    if (panelSync) panelSync.onRemoteUpdate(() => {
      if (!panelSync || !panelSync.ready) return;
      const state = panelSync.applyToCanvas();
      if (!state) return;
      // Apply remote layers to canvas
      state.layers.forEach((l, i) => {
        if (i >= layersData.length) return;
        if (!l.dataUrl) return;
        const img = new Image();
        img.onload = () => {
          const layer = layersData[i];
          layer.ctx.globalCompositeOperation = 'source-over';
          layer.ctx.clearRect(0, 0, cWidth, cHeight);
          layer.ctx.drawImage(img, 0, 0);
          layer.baseCanvas.getContext('2d').clearRect(0, 0, cWidth, cHeight);
          layer.baseCanvas.getContext('2d').drawImage(img, 0, 0);
        };
        img.src = l.dataUrl;
      });
      if (state.bgColor) {
        canvasBgColor.value = state.bgColor;
        layersContainer.style.backgroundColor = state.bgColor;
      }
      if (state.dialogues) {
        currentDialogues = state.dialogues;
        renderDialogues();
      }
    });

  }

  function setupRealtimeChannel(panelId) {
    if (drawingChannel) {
      sb.removeChannel(drawingChannel);
    }

    drawingChannel = sb.channel(`drawing:${panelId}`);

    // Init References
    if (window.RKReference) {
      window.RKReference.init(panelId, currentUser);
      window.RKReference.setChannel(drawingChannel);
    }

    if (window.RKPresence) {
      window.RKPresence.setChannel(drawingChannel);
    }

    drawingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = drawingChannel.presenceState();
        const activeUserIds = new Set(Object.keys(state));
        const removedUsers = [];
        for (const uid in remoteUsers) {
          if (!activeUserIds.has(uid)) {
            removedUsers.push(remoteUsers[uid].alias || uid);
            delete remoteUsers[uid];
          }
        }
        removedUsers.forEach(alias => showToast(`${alias} abandonó el panel`));
        const activeUsers = [];
        for (const id in state) {
          activeUsers.push(state[id][0]);
        }
        if (window.RKPresence) window.RKPresence.renderAvatars(activeUsers);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        handleRemoteCursor(payload);
      })
      .on('broadcast', { event: 'ref-sync' }, ({ payload }) => {
        if (window.RKReference) window.RKReference.handleRemoteSync(payload);
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (window.RKPresence) window.RKPresence.showReaction(payload);
      })
      .on('broadcast', { event: 'draw-step' }, ({ payload }) => {
        handleRemoteDrawStep(payload);
      })
      .on('broadcast', { event: 'canvas-sync' }, ({ payload }) => {
        handleCanvasSync(payload);
      })
      .on('broadcast', { event: 'dialogues-sync' }, ({ payload }) => {
        handleRemoteDialoguesSync(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to drawing:${panelId}`);
          await drawingChannel.track({
            id: currentUser.id,
            alias: document.getElementById("sidebarAlias")?.textContent || "Tú",
            colorAlias: document.getElementById("sidebarAlias")?.style.color || "#fff",
            avatarUrl: document.getElementById("sidebarAvatarImg")?.src || "icons/Tu.png"
          });
        }
      });

  }

  function handleRemoteCursor(payload) {
    const { userId, x, y, alias, colorAlias } = payload;
    if (userId === currentUser.id) return;

    if (!remoteUsers[userId]) remoteUsers[userId] = { alias, colorAlias };
    remoteUsers[userId].x = x;
    remoteUsers[userId].y = y;

    requestAnimationFrame(() => drawAllCursors());
  }

  function handleRemoteDrawStep(payload) {
    const { points, color, opacity, composite, layerId } = payload;
    if (!points || points.length < 2) return;
    const idx = layersData.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const ctx = layersData[idx].ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineWidth = points[0].s || 2;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      ctx.lineTo(p.x, p.y);
      if (p.s) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = p.s; }
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  function broadcastCanvasSync() {
    if (!drawingChannel) return;
    try {
      const c = document.createElement('canvas');
      c.width = cWidth; c.height = cHeight;
      const tc = c.getContext('2d');
      tc.fillStyle = canvasBgColor.value;
      tc.fillRect(0, 0, c.width, c.height);
      layersData.forEach(l => {
        tc.globalAlpha = l.opacity;
        tc.drawImage(l.canvas, 0, 0);
      });
      drawingChannel.send({
        type: 'broadcast',
        event: 'canvas-sync',
        payload: { dataUrl: c.toDataURL('image/jpeg', 0.6), bgColor: canvasBgColor.value }
      });
    } catch (e) {}
  }

  function handleCanvasSync(payload) {
    if (!payload || !payload.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      layersData.forEach(l => {
        l.ctx.globalCompositeOperation = 'source-over';
        l.ctx.clearRect(0, 0, cWidth, cHeight);
        l.baseCanvas.getContext('2d').clearRect(0, 0, cWidth, cHeight);
      });
      if (layersData.length > 0) {
        layersData[0].ctx.drawImage(img, 0, 0);
        layersData[0].baseCanvas.getContext('2d').drawImage(img, 0, 0);
      }
      if (payload.bgColor) {
        canvasBgColor.value = payload.bgColor;
        layersContainer.style.backgroundColor = payload.bgColor;
      }
      renderLayersUI();
    };
    img.src = payload.dataUrl;
  }

  function broadcastDialoguesSync() {
    if (!drawingChannel) return;
    try {
      drawingChannel.send({
        type: 'broadcast',
        event: 'dialogues-sync',
        payload: { dialogues: currentDialogues }
      });
    } catch (e) {}
  }

  function handleRemoteDialoguesSync(payload) {
    if (!payload || !payload.dialogues) return;
    currentDialogues = payload.dialogues;
    renderDialogues();
  }

  async function closePanelWorkspace() {
    stopMarchingAnts();
    clearSelection();

    // Sync final state to Yjs and persist
    if (panelSync && panelSync.ready) {
      panelSync.syncCanvasToYjs(layersData, canvasBgColor.value, currentDialogues);
      await panelSync.persist();
    }

    broadcastCanvasSync();

    // Generar thumbnail para la galería
    const thumbDataUrl = (() => {
      try {
        const c = document.createElement('canvas');
        const maxSize = 200;
        const s = Math.min(maxSize / cWidth, maxSize / cHeight);
        c.width = Math.round(cWidth * s);
        c.height = Math.round(cHeight * s);
        const tc = c.getContext('2d');
        tc.fillStyle = canvasBgColor.value;
        tc.fillRect(0, 0, c.width, c.height);
        layersData.forEach(l => {
          tc.globalAlpha = l.opacity;
          tc.drawImage(l.canvas, 0, 0, c.width, c.height);
        });
        return c.toDataURL('image/jpeg', 0.3);
      } catch (e) { return null; }
    })();

    const pIdx = panelsData.findIndex(p => p.id === activePanelId);
    if (pIdx >= 0) {
      panelsData[pIdx].canvas_data = panelsData[pIdx].canvas_data || {};
      if (thumbDataUrl) panelsData[pIdx].canvas_data.imagen_url = thumbDataUrl;
      panelsData[pIdx].canvas_data.dialogos = currentDialogues;
      supabaseClient.from('paneles').update({
        canvas_data: panelsData[pIdx].canvas_data
      }).eq('id', activePanelId).then();
    }

    if (drawingChannel) {
      sb.removeChannel(drawingChannel);
      drawingChannel = null;
    }
    remoteUsers = {};
    cursorCtx.clearRect(0, 0, cWidth, cHeight);

    if (panelSync) { panelSync.destroy(); panelSync = null; }

    // Animate back to grid
    enlargedModal.classList.add('anim-fade-out');
    await new Promise(r => {
      enlargedModal.addEventListener('animationend', () => {
        enlargedModal.classList.remove('anim-fade-out');
        enlargedModal.classList.add('hidden');
        panelsGrid.classList.remove('hidden');
        panelsGrid.classList.add('anim-fade-in');
        panelsGrid.addEventListener('animationend', () => {
          panelsGrid.classList.remove('anim-fade-in');
          r();
        }, { once: true });
      }, { once: true });
    });
    window.ANIM.hide(layersManager, 'anim-fade-out');
    if (selectionActionsBar) window.ANIM.hide(selectionActionsBar, 'anim-fade-out');
    isFlipped = false;
    canvasRotation = 0;
    if (toolFlipCanvas) toolFlipCanvas.style.background = "";
    if (toolRotateCW) toolRotateCW.style.background = "";
    if (toolRotateCCW) toolRotateCCW.style.background = "";
    setActiveTool('draw');

    activePanelId = null;

    // Restaurar sidebar
    sidebarEl?.classList.remove("collapsed");

    // Re-renderizar galería
    renderGrid();
  }

  closeDrawingBtn?.addEventListener("click", async () => {
    await closePanelWorkspace();
  });

  // Resize handling
  window.addEventListener("resize", adjustCanvasScale);

  function adjustCanvasScale() {
    if (enlargedModal.classList.contains("hidden")) return null;
    const containerWidth = drawingContainer.clientWidth;
    const containerHeight = drawingContainer.clientHeight;

    const scaleX = containerWidth / cWidth;
    const scaleY = containerHeight / cHeight;
    const baseScale = Math.min(scaleX, scaleY) * 0.95;
    const scale = baseScale * customZoom;

    if (typeof cachedRect !== 'undefined') cachedRect = null;
    if (typeof cachedInverseMatrix !== 'undefined') cachedInverseMatrix = null;

    const cw = `${cWidth}px`;
    const ch = `${cHeight}px`;

    // Apply scaling + rotation + flip
    let transform = `scale(${scale})`;
    if (canvasRotation) transform += ` rotate(${canvasRotation}deg)`;
    if (isFlipped) transform += ` scaleX(-1)`;
    canvasZoomWorld.style.width = cw;
    canvasZoomWorld.style.height = ch;
    canvasZoomWorld.style.transform = transform;

    // Calculate buffers (2x canvas size)
    const bufferW = cWidth * scale * 2;
    const bufferH = cHeight * scale * 2;

    // Centering within the viewport (if canvas is small)
    const centX = Math.max(0, (containerWidth - (cWidth * scale)) / 2);
    const centY = Math.max(0, (containerHeight - (cHeight * scale)) / 2);

    const nml = bufferW + centX;
    const nmt = bufferH + centY;

    // Apply margins to the world to create scrollable space on all sides
    canvasZoomWorld.style.marginLeft = nml + "px";
    canvasZoomWorld.style.marginTop = nmt + "px";
    canvasZoomWorld.style.marginRight = bufferW + centX + "px";
    canvasZoomWorld.style.marginBottom = bufferH + centY + "px";

    return { scale, marginLeft: nml, marginTop: nmt };
  }

  // Scroll to Zoom (centrado en ratón)
  drawingContainer.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = drawingContainer.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Obtener estado actual (antes del zoom)
    const oldInfo = adjustCanvasScale();
    if (!oldInfo) return;

    // Calcular punto en el "mundo" antes del zoom
    const canvasX = (mx + drawingContainer.scrollLeft - oldInfo.marginLeft) / oldInfo.scale;
    const canvasY = (my + drawingContainer.scrollTop - oldInfo.marginTop) / oldInfo.scale;

    // Aplicar zoom
    if (e.deltaY < 0) customZoom *= 1.12;
    else customZoom /= 1.12;

    if (customZoom < 0.1) customZoom = 0.1;
    if (customZoom > 20) customZoom = 20;

    // Aplicar nueva escala
    const newInfo = adjustCanvasScale();
    if (!newInfo) return;

    // Ajustar scroll para mantener el punto bajo el ratón
    drawingContainer.scrollLeft = canvasX * newInfo.scale - mx + newInfo.marginLeft;
    drawingContainer.scrollTop = canvasY * newInfo.scale - my + newInfo.marginTop;
  }, { passive: false });

  // ── ZOOM HELPERS (Keyboard) ─────────────────
  function zoomAtCenter(factor) {
    const container = drawingContainer;
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const oldInfo = adjustCanvasScale();
    if (!oldInfo) return;

    const canvasX = (cx + container.scrollLeft - oldInfo.marginLeft) / oldInfo.scale;
    const canvasY = (cy + container.scrollTop - oldInfo.marginTop) / oldInfo.scale;

    customZoom *= factor;
    if (customZoom < 0.1) customZoom = 0.1;
    if (customZoom > 20) customZoom = 20;

    const newInfo = adjustCanvasScale();
    if (!newInfo) return;

    container.scrollLeft = canvasX * newInfo.scale - cx + newInfo.marginLeft;
    container.scrollTop = canvasY * newInfo.scale - cy + newInfo.marginTop;
  }

  function zoomReset() {
    customZoom = 1.0;
    const info = adjustCanvasScale();
    if (!info) return;
    const container = drawingContainer;
    container.scrollLeft = info.marginLeft - (container.clientWidth / 2) + (cWidth * info.scale / 2);
    container.scrollTop = info.marginTop - (container.clientHeight / 2) + (cHeight * info.scale / 2);
  }

  // ── LAYERS LOGIC ────────────────────────────────

  function createLayer(name, opacity = 1.0, dataUrl = null) {
    const cvs = document.createElement("canvas");
    cvs.width = cWidth;
    cvs.height = cHeight;
    cvs.style.position = "absolute";
    cvs.style.top = "0";
    cvs.style.left = "0";
    cvs.style.pointerEvents = "none"; // handled by cursor
    cvs.style.opacity = opacity;

    const ctx = cvs.getContext("2d");

    const baseCvs = document.createElement("canvas");
    baseCvs.width = cWidth;
    baseCvs.height = cHeight;
    const baseCtx = baseCvs.getContext("2d");

    if (dataUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        baseCtx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    } else {
      // transparent background
      ctx.clearRect(0, 0, cWidth, cHeight);
    }

    layersContainer.appendChild(cvs);
    layersData.push({ id: name, canvas: cvs, ctx: ctx, opacity: opacity, baseCanvas: baseCvs });
    activeLayerIndex = layersData.length - 1;
    renderLayersUI();
  }

  function moveLayer(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= layersData.length) return;

    // Swap in array
    const temp = layersData[index];
    layersData[index] = layersData[newIndex];
    layersData[newIndex] = temp;

    // If active layer was moved, update index
    if (activeLayerIndex === index) activeLayerIndex = newIndex;
    else if (activeLayerIndex === newIndex) activeLayerIndex = index;

    // Re-order physically in DOM (simpler to re-append all)
    layersContainer.innerHTML = "";
    layersData.forEach(layer => {
      layersContainer.appendChild(layer.canvas);
    });

    syncToYjs();
    renderLayersUI();
  }

  function renderLayersUI() {
    layersList.innerHTML = "";

    // Render reversed so top layer is top of list
    const reversed = [...layersData].reverse();

    reversed.forEach((layer, revIdx) => {
      const actualIdx = layersData.length - 1 - revIdx;

      const el = document.createElement("div");
      el.className = `layer-item ${actualIdx === activeLayerIndex ? "active" : ""}`;
      el.onclick = () => {
        activeLayerIndex = actualIdx;
        renderLayersUI();
      };

      const topRow = document.createElement("div");
      topRow.className = "layer-item-top";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = layer.id;
      nameSpan.contentEditable = "true";
      nameSpan.setAttribute("spellcheck", "false");
      nameSpan.className = "layer-name-editable";
      nameSpan.onclick = (e) => e.stopPropagation();
      nameSpan.onblur = () => {
        const oldId = layer.id;
        layer.id = nameSpan.textContent.trim() || "Capa";
        if (oldId !== layer.id) syncToYjs();
      };
      nameSpan.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); nameSpan.blur(); } };

      const actionsWrap = document.createElement("div");
      actionsWrap.style.display = "flex"; actionsWrap.style.gap = "4px";

      const upBtn = document.createElement("button");
      upBtn.className = "layer-action-btn";
      upBtn.innerHTML = "▲";
      upBtn.disabled = actualIdx === layersData.length - 1;
      upBtn.onclick = (e) => { e.stopPropagation(); moveLayer(actualIdx, 1); };

      const downBtn = document.createElement("button");
      downBtn.className = "layer-action-btn";
      downBtn.innerHTML = "▼";
      downBtn.disabled = actualIdx === 0;
      downBtn.onclick = (e) => { e.stopPropagation(); moveLayer(actualIdx, -1); };

      actionsWrap.appendChild(upBtn);
      actionsWrap.appendChild(downBtn);

      topRow.appendChild(nameSpan);
      topRow.appendChild(actionsWrap);

      const delBtn = document.createElement("button");
      delBtn.className = "layer-del-btn";
      delBtn.innerHTML = "🗑";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (layersData.length === 1) return alert("No puedes borrar la última capa");
        layersContainer.removeChild(layer.canvas);
        layersData.splice(actualIdx, 1);
        if (activeLayerIndex >= layersData.length) activeLayerIndex = layersData.length - 1;
        renderLayersUI();
        syncToYjs();
      };
      topRow.appendChild(delBtn);

      const opRange = document.createElement("input");
      opRange.type = "range";
      opRange.className = "layer-opacity-slider";
      opRange.min = 0; opRange.max = 1; opRange.step = 0.05;
      opRange.value = layer.opacity;
      opRange.title = "Opacidad";
      opRange.onclick = (e) => e.stopPropagation();
      opRange.oninput = (e) => {
        layer.opacity = parseFloat(e.target.value);
        layer.canvas.style.opacity = layer.opacity;
      };

      const slideWrap = document.createElement("div");
      slideWrap.style.display = "flex"; slideWrap.style.gap = "8px"; slideWrap.style.alignItems = "center";
      slideWrap.innerHTML = `<span style="color:#aaa; font-size:10px;">Opacidad</span>`;
      slideWrap.appendChild(opRange);

      el.appendChild(topRow);
      el.appendChild(slideWrap);
      layersList.appendChild(el);
    });
  }

  toggleLayersBtn.addEventListener("click", () => layersManager.classList.toggle("hidden"));
  addLayerBtn.addEventListener("click", () => { createLayer(`Capa ${layersData.length + 1}`); syncToYjs(); });

  function updateLayerCanvasTransforms() {
    layersData.forEach(l => {
      l.canvas.width = cWidth; l.canvas.height = cHeight;
    });
  }

  // ── BRUSH PREVIEWS & DROPDOWN ────────────────────

  function updatePreviews() {
    brushPreviewCvs.forEach(cvs => {
      const ptx = cvs.getContext("2d");
      ptx.clearRect(0, 0, cvs.width, cvs.height);
      const toolType = cvs.parentElement.dataset.tool;

      ptx.beginPath();
      ptx.moveTo(5, cvs.height / 2);
      ptx.bezierCurveTo(20, -5, 40, 30, 75, cvs.height / 2);

      let baseSize = parseInt(toolSize.value) * 0.15; // scaled down for 80px preview
      if (baseSize < 1) baseSize = 1;
      if (baseSize > 12) baseSize = 12;

      ptx.lineWidth = baseSize;
      ptx.lineCap = "round";
      ptx.strokeStyle = toolColor.value;

      const opc = brushOpacity / 100;
      if (toolType === "pencil") {
        ptx.globalAlpha = 0.5 * opc; ptx.globalCompositeOperation = "source-over";
      } else if (toolType === "marker") {
        ptx.globalAlpha = 0.3 * opc; ptx.globalCompositeOperation = "screen";
      } else {
        ptx.globalAlpha = 1.0 * opc; ptx.globalCompositeOperation = "source-over";
      }
      ptx.stroke();
      ptx.globalAlpha = 1; ptx.globalCompositeOperation = "source-over";
    });
  }

  function setTool(type) {
    // Switching to any brush/eraser tool automatically returns to draw mode
    activeTool = 'draw';
    cursorCanvas.style.cursor = "none";
    drawAllCursors(lastCursorPos.x, lastCursorPos.y, 0.5);

    // Reset all tool button states (including new selection tools)
    brushOptBtns.forEach(b => b.classList.remove("active"));
    toolEraser.classList.remove("active");
    document.getElementById("toolLasso")?.classList.remove("active");
    document.getElementById("toolRectSelect")?.classList.remove("active");
    document.getElementById("toolMove")?.classList.remove("active");
    document.getElementById("toolEyedropper")?.classList.remove("active");

    if (type === "eraser") {
      isEraserActive = true;
      toolEraser.classList.add("active");
    } else {
      isEraserActive = false;
      drawMode = type;
      // Mark the correct button in the dropdown as active
      brushOptBtns.forEach(b => {
        if (b.dataset.tool === type) b.classList.add("active");
      });
      // Update the main dropdown label
      const labels = { brush: "Pincel", pencil: "Lápiz", marker: "Marcador" };
      if (brushDropdownLabel) brushDropdownLabel.textContent = labels[type] || "Pincel";
    }
    updatePreviews();
  }

  brushDropdownBtn.addEventListener("pointerdown", async (e) => {
    e.stopPropagation();
    if (brushDropdownMenu.classList.contains("hidden")) {
      await window.ANIM.show(brushDropdownMenu, 'anim-slide-up');
      updatePreviews();
    } else {
      window.ANIM.hide(brushDropdownMenu, 'anim-slide-down-out');
    }
  });

  // Ocultar dropdown al tocar fuera
  window.addEventListener("pointerdown", () => {
    if (!brushDropdownMenu.classList.contains("hidden")) {
      window.ANIM.hide(brushDropdownMenu, 'anim-slide-down-out');
    }
  });
  brushDropdownMenu.addEventListener("pointerdown", (e) => e.stopPropagation());

  brushOptBtns.forEach(btn => {
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      setTool(btn.dataset.tool);
      window.ANIM.hide(brushDropdownMenu, 'anim-slide-down-out');
    });
  });

  toolEraser.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    setTool("eraser");
  });

  toolSize.addEventListener("input", () => {
    const sizeVal = document.getElementById("sizeVal");
    if (sizeVal) sizeVal.textContent = toolSize.value + "px";
    updatePreviews();
  });
  toolColor.addEventListener("input", updatePreviews);

  const toolStabilizer = document.getElementById("toolStabilizer");
  const stabilizerVal = document.getElementById("stabilizerVal");
  if (toolStabilizer) {
    toolStabilizer.addEventListener("input", (e) => {
      stabilizerValue = parseInt(e.target.value);
      if (stabilizerVal) stabilizerVal.textContent = stabilizerValue;
    });
  }

  const toolOpacity = document.getElementById("toolOpacity");
  const opacityVal = document.getElementById("opacityVal");
  if (toolOpacity) {
    toolOpacity.addEventListener("input", (e) => {
      brushOpacity = parseInt(e.target.value);
      if (opacityVal) opacityVal.textContent = brushOpacity + "%";
      updatePreviews();
    });
  }

  // Cambiar color de fondo en vivo
  canvasBgColor.addEventListener("input", (e) => {
    layersContainer.style.backgroundColor = e.target.value;
    syncToYjs();
  });

  // ── LAG-FREE DRAWING LOGIC (Pointer Events & Undo) ────

  function saveUndoState() {
    if (activeLayerIndex < 0) return;
    const layer = layersData[activeLayerIndex];

    // Bake current strokes before taking snapshot
    if (!layer.baseCanvas) {
      layer.baseCanvas = document.createElement('canvas');
      layer.baseCanvas.width = cWidth; layer.baseCanvas.height = cHeight;
    }
    layer.baseCanvas.getContext('2d').clearRect(0, 0, cWidth, cHeight);
    layer.baseCanvas.getContext('2d').drawImage(layer.canvas, 0, 0);

    // No limit on undoStack as requested (unlimited undo/redo)

    // Store in-memory canvas instead of dataURL for real-time remote updating
    const memCvs = document.createElement('canvas');
    memCvs.width = cWidth;
    memCvs.height = cHeight;
    const memCtx = memCvs.getContext('2d');
    memCtx.drawImage(layer.canvas, 0, 0);

    undoStack.push({
      layerIndex: activeLayerIndex,
      canvas: memCvs,
      ctx: memCtx
    });
    const UNDO_LIMIT = 150;
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  // ── SHORTCUT MATCHING ──
  function matchesShortcut(e, name) {
    const val = userShortcuts[name] || defaultShortcuts[name];
    if (!val) return false;
    if (typeof val === 'string' && val.startsWith('ctrl+')) {
      const key = val.slice(5);
      return e.ctrlKey && e.key.toLowerCase() === key.toLowerCase();
    }
    if (typeof val === 'string' && val.startsWith('shift+')) {
      const key = val.slice(6);
      return e.shiftKey && e.key.toLowerCase() === key.toLowerCase();
    }
    return !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === val.toLowerCase();
  }

  window.addEventListener("keydown", (e) => {
    // Keyboard Shortcuts (Artist Workflow)
    // Only trigger if we are in drawing workspace and NOT typing in an input
    const isEditingText = document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA";
    const isWorkspaceOpen = !enlargedModal.classList.contains("hidden");

    if (isWorkspaceOpen && !isEditingText) {
      const key = e.key.toLowerCase();

      // If we are recording a new shortcut
      if (recordingShortcutFor) {
        e.preventDefault();
        // Prevent system keys
        if (['alt', 'meta', 'escape'].includes(key)) return;
        if (key === 'shift' || key === 'control') return;

        if (e.shiftKey) {
          userShortcuts[recordingShortcutFor] = 'shift+' + e.key;
        } else if (e.ctrlKey) {
          userShortcuts[recordingShortcutFor] = 'ctrl+' + e.key;
        } else {
          userShortcuts[recordingShortcutFor] = key;
        }

        try {
          localStorage.setItem("rkShortcuts", JSON.stringify(userShortcuts));
          if (typeof showToast === 'function') showToast("✔ Atajo guardado");
        } catch (e) {
          console.error("Error saving shortcuts:", e);
          if (typeof showToast === 'function') showToast("✖ Error al guardar atajo", "error");
        }
        recordingShortcutFor = null;
        renderShortcutSettings();
        return;
      }

      if (key === userShortcuts.brush) { e.preventDefault(); setActiveTool('draw'); setTool("brush"); }
      if (key === userShortcuts.pencil) { e.preventDefault(); setActiveTool('draw'); setTool("pencil"); }
      if (key === userShortcuts.marker) { e.preventDefault(); setActiveTool('draw'); setTool("marker"); }
      if (key === userShortcuts.eraser) { e.preventDefault(); setActiveTool('draw'); setTool("eraser"); }
      if (key === userShortcuts.lasso) { e.preventDefault(); clearSelection(); setActiveTool('lasso'); }
      if (key === userShortcuts.rectSelect) { e.preventDefault(); clearSelection(); setActiveTool('rectSelect'); }
      if (key === userShortcuts.eyedropper) { e.preventDefault(); setActiveTool('eyedropper'); }
      if (key === userShortcuts.moveSelection) { e.preventDefault(); setActiveTool('move'); }
      if (key === userShortcuts.layers) { e.preventDefault(); toggleLayersBtn.click(); }
      if (key === userShortcuts.onionSkin && toggleOnionSkinBtn) { e.preventDefault(); toggleOnionSkinBtn.click(); }
      if (key === userShortcuts.flipCanvas) { e.preventDefault(); toggleFlip(); }
      if (matchesShortcut(e, 'rotateCW')) { e.preventDefault(); rotateCW(); }
      if (matchesShortcut(e, 'rotateCCW')) { e.preventDefault(); rotateCCW(); }

      // Panel Navigation
      if (key === userShortcuts.panelNext) { e.preventDefault(); navigateToPanel(1); }
      if (key === userShortcuts.panelPrev) { e.preventDefault(); navigateToPanel(-1); }

      // Brush sizing
      if (key === userShortcuts.sizeDown) {
        e.preventDefault();
        toolSize.value = Math.max(1, parseInt(toolSize.value) - 1);
        toolSize.dispatchEvent(new Event('input'));
      }
      if (key === userShortcuts.sizeUp) {
        e.preventDefault();
        toolSize.value = Math.min(100, parseInt(toolSize.value) + 1);
        toolSize.dispatchEvent(new Event('input'));
      }

      // Selection actions
      if (key === 'delete') { e.preventDefault(); selectionDelete(); }

      // Close modal / Deselect on escape
      if (key === 'escape') {
        if (selectionPath.length || selectionRect) {
          clearSelection(); stopMarchingAnts(); cursorCtx.clearRect(0, 0, cWidth, cHeight);
        }
        window.ANIM.hide(shortcutModal, 'anim-fade-out');
        recordingShortcutFor = null;
      }

      // Space bar → Hand/pan mode (temporary)
      if (e.key === ' ') {
        e.preventDefault();
        if (!isSpaceHeld) {
          isSpaceHeld = true;
          previousToolBeforePan = activeTool;
          cursorCanvas.style.cursor = "grab";
        }
      }
    }

    // Ctrl + Z: Undo
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();

      // Snapshot-based undo
      if (undoStack.length === 0) return;
      if (activeLayerIndex >= 0) {
        const layer = layersData[activeLayerIndex];
        const memCvs = document.createElement('canvas');
        memCvs.width = cWidth; memCvs.height = cHeight;
        const memCtx = memCvs.getContext('2d');
        memCtx.drawImage(layer.canvas, 0, 0);
        redoStack.push({ layerIndex: activeLayerIndex, canvas: memCvs, ctx: memCtx });
      }
      const last = undoStack.pop();
      if (last.layerIndex >= layersData.length) return;
      const layer = layersData[last.layerIndex];
      layer.ctx.globalCompositeOperation = "source-over";
      layer.ctx.clearRect(0, 0, cWidth, cHeight);
      layer.ctx.drawImage(last.canvas, 0, 0);
      layer.baseCanvas.getContext('2d').clearRect(0, 0, cWidth, cHeight);
      layer.baseCanvas.getContext('2d').drawImage(last.canvas, 0, 0);
      syncToYjs();
      broadcastCanvasSync();
    }

    // Ctrl + Shift + Z or Ctrl + Y: Redo
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
      e.preventDefault();

      // Snapshot-based redo
      if (redoStack.length === 0) return;
      if (activeLayerIndex >= 0) {
        const layer = layersData[activeLayerIndex];
        const memCvs = document.createElement('canvas');
        memCvs.width = cWidth; memCvs.height = cHeight;
        const memCtx = memCvs.getContext('2d');
        memCtx.drawImage(layer.canvas, 0, 0);
        undoStack.push({ layerIndex: activeLayerIndex, canvas: memCvs, ctx: memCtx });
      }
      const last = redoStack.pop();
      if (last.layerIndex >= layersData.length) return;
      const layer = layersData[last.layerIndex];
      layer.ctx.globalCompositeOperation = "source-over";
      layer.ctx.clearRect(0, 0, cWidth, cHeight);
      layer.ctx.drawImage(last.canvas, 0, 0);
      layer.baseCanvas.getContext('2d').clearRect(0, 0, cWidth, cHeight);
      layer.baseCanvas.getContext('2d').drawImage(last.canvas, 0, 0);
      syncToYjs();
      broadcastCanvasSync();
    }

    // Ctrl + C: Copy
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      selectionCopy();
    }
    // Ctrl + X: Cut
    if (e.ctrlKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      selectionCut();
    }
    // Ctrl + V: Paste
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      selectionPaste();
    }
    // Ctrl + D: Deselect
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      clearSelection(); stopMarchingAnts(); cursorCtx.clearRect(0, 0, cWidth, cHeight);
    }

    // Ctrl + S: Sync to Yjs (ya no hay save manual)
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      syncToYjs();
      showToast('✔ Sincronizado');
    }

    // Zoom shortcuts (customizable via userShortcuts)
    if (matchesShortcut(e, 'zoomIn')) {
      e.preventDefault();
      if (!enlargedModal.classList.contains("hidden")) zoomAtCenter(1.12);
    }
    if (matchesShortcut(e, 'zoomOut')) {
      e.preventDefault();
      if (!enlargedModal.classList.contains("hidden")) zoomAtCenter(1 / 1.12);
    }
    if (matchesShortcut(e, 'zoomReset')) {
      e.preventDefault();
      if (!enlargedModal.classList.contains("hidden")) zoomReset();
    }
  });

  // ── KEYUP: Liberar Space Pan ──────────────
  window.addEventListener("keyup", (e) => {
    if (e.key === ' ' && isSpaceHeld) {
      isSpaceHeld = false;
      isPanning = false;
      activeTool = previousToolBeforePan;
      // Restaurar cursor según la herramienta original
      if (activeTool === 'move') cursorCanvas.style.cursor = "grab";
      else if (activeTool === 'eyedropper') cursorCanvas.style.cursor = "crosshair";
      else if (activeTool === 'lasso' || activeTool === 'rectSelect') cursorCanvas.style.cursor = "crosshair";
      else cursorCanvas.style.cursor = "none";
    }
  });

  let cachedRect = null;
  let cachedScaleX = 1;
  let cachedScaleY = 1;
  let cachedInverseMatrix = null;

  function buildCanvasMatrix(screenRect) {
    // Build forward matrix: canvas coords → screen coords
    const cx = screenRect.left + screenRect.width / 2;
    const cy = screenRect.top + screenRect.height / 2;
    const scale = screenRect.width / cWidth;
    let m = new DOMMatrix()
      .translate(cx, cy)
      .scale(scale);
    if (canvasRotation) m = m.rotate(canvasRotation);
    if (isFlipped) m = m.scale(-1, 1);
    m = m.translate(-cWidth / 2, -cHeight / 2);
    return m;
  }

  function updateCanvasRect() {
    cachedRect = cursorCanvas.getBoundingClientRect();
    cachedScaleX = cWidth / cachedRect.width;
    cachedScaleY = cHeight / cachedRect.height;
    cachedInverseMatrix = buildCanvasMatrix(cachedRect).inverse();
  }

  function getCoordinates(e) {
    if (!cachedRect || !cachedInverseMatrix) updateCanvasRect();
    const pt = cachedInverseMatrix.transformPoint(new DOMPoint(e.clientX, e.clientY));
    const x = Math.max(0, Math.min(cWidth, pt.x));
    const y = Math.max(0, Math.min(cHeight, pt.y));
    lastCursorPos = { x, y };
    return {
      x, y,
      pressure: e.pressure || 0.5,
      pointerType: e.pointerType
    };
  }

  function drawAllCursors(localX, localY, localPressure) {
    cursorCtx.clearRect(0, 0, cWidth, cHeight);

    // Phase 2 Optimization: Skip expensive shadow effects in Modo Pobre
    const isLowPerf = document.body.classList.contains("low-perf");

    Object.keys(remoteUsers).forEach(id => {
      const u = remoteUsers[id];
      if (u.x === undefined) return;

      cursorCtx.beginPath();
      cursorCtx.arc(u.x, u.y, 5, 0, Math.PI * 2);
      cursorCtx.fillStyle = u.colorAlias || "#db6f4e";
      cursorCtx.fill();

      cursorCtx.font = "bold 14px Arial";
      cursorCtx.fillStyle = "white";

      if (!isLowPerf) {
        cursorCtx.shadowBlur = 4;
        cursorCtx.shadowColor = "black";
      }

      cursorCtx.fillText(u.alias || "Artista", u.x + 10, u.y + 5);

      if (!isLowPerf) {
        cursorCtx.shadowBlur = 0;
      }
    });

    if (localX !== undefined) {
      const size = parseInt(toolSize.value);
      const finalPressure = (isDrawing && localPressure > 0.01) ? localPressure : 0.5;
      const dynamicSize = size * (0.2 + finalPressure * 1.5);
      cursorCtx.beginPath();
      cursorCtx.arc(localX, localY, Math.max(0, dynamicSize / 2), 0, Math.PI * 2);
      cursorCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      cursorCtx.lineWidth = 2;
      cursorCtx.stroke();
      cursorCtx.beginPath();
      cursorCtx.arc(localX, localY, Math.max(0, dynamicSize / 2 - 1), 0, Math.PI * 2);
      cursorCtx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      cursorCtx.lineWidth = 1;
      cursorCtx.stroke();
    }
  }

  // Prevent right-click context menu (which Windows Ink triggers on press-and-hold)
  cursorCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // Canvas button/tool switching logic (Pen Barrel Buttons)
  function handlePenShortcuts(e) {
    if (e.button !== 0) {
      const btnId = `btn_${e.button}`;
      if (btnId === userShortcuts.penLower) {
        setTool("eraser");
      } else if (btnId === userShortcuts.penUpper) {
        setTool("marker");
      }
    }
  }

  cursorCanvas.addEventListener("pointerdown", (e) => {
    cachedRect = null; cachedInverseMatrix = null; // Refrescar cache de coordenadas al empezar a dibujar

    const { x, y, pressure } = getCoordinates(e);
    cursorCanvas.setPointerCapture(e.pointerId);

    // ── SPACE PAN ──
    if (isSpaceHeld) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      cursorCanvas.style.cursor = "grabbing";
      return;
    }

    // ── TOOL DISPATCH ──

    // Alt+Click: Eyedropper temporal (CSP style)
    if (e.altKey && activeTool === 'draw') {
      pickColorAt(x, y);
      return;
    }

    if (activeTool === 'eyedropper') {
      pickColorAt(x, y);
      return;
    }

    if (activeTool === 'lasso') {
      isSelecting = true;
      selectionPath = [{ x, y }];
      selectionRect = null;
      stopMarchingAnts();
      return;
    }

    if (activeTool === 'rectSelect') {
      isSelecting = true;
      selectionRect = { x, y, w: 0, h: 0 };
      selectionPath = [];
      moveStartX = x;
      moveStartY = y;
      stopMarchingAnts();
      return;
    }

    if (activeTool === 'move') {
      const bounds = getSelectionBounds();
      if (bounds && selectionImageData === null) {
        // Extraer la selección para moverla
        const data = extractSelection();
        if (data) {
          saveUndoState();
          selectionImageData = data.imageData;
          selectionOffsetX = data.x;
          selectionOffsetY = data.y;
          // Borrar el contenido original
          const layer = layersData[activeLayerIndex];
          layer.ctx.clearRect(data.x, data.y, data.w, data.h);
        }
      }
      isMovingSelection = true;
      moveStartX = x;
      moveStartY = y;
      cursorCanvas.style.cursor = "grabbing";
      return;
    }

    // ── DRAWING MODE (default) ──
    handlePenShortcuts(e);

    if (activeLayerIndex < 0) return;
    redoStack = [];
    saveUndoState();
    isDrawing = true;
    lastX = x;
    lastY = y;
    stabilizedX = x;
    stabilizedY = y;
    midX = x;
    midY = y;
    lastDist = 0;

    currentSegment = [{ x: midX, y: midY, s: lastDynamicSize }];
    drawAllCursors(x, y, pressure);
  });

  cursorCanvas.addEventListener("pointermove", (e) => {
    // ── SPACE PAN ──
    if (isPanning) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      drawingContainer.scrollLeft -= dx;
      drawingContainer.scrollTop -= dy;
      panStartX = e.clientX;
      panStartY = e.clientY;
      return;
    }

    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const lastEvent = events[events.length - 1];
    const { x: lastX_move, y: lastY_move } = getCoordinates(lastEvent);

    // ── TOOL DISPATCH (non-draw tools) ──
    if (activeTool === 'lasso' && isSelecting) {
      selectionPath.push({ x: lastX_move, y: lastY_move });
      cursorCtx.clearRect(0, 0, cWidth, cHeight);
      // Dibujar path en progreso
      cursorCtx.save();
      cursorCtx.setLineDash([4, 4]);
      cursorCtx.strokeStyle = "rgba(255,255,255,0.8)";
      cursorCtx.lineWidth = 1;
      cursorCtx.beginPath();
      cursorCtx.moveTo(selectionPath[0].x, selectionPath[0].y);
      for (let i = 1; i < selectionPath.length; i++) {
        cursorCtx.lineTo(selectionPath[i].x, selectionPath[i].y);
      }
      cursorCtx.stroke();
      cursorCtx.restore();
      return;
    }

    if (activeTool === 'rectSelect' && isSelecting) {
      selectionRect.w = lastX_move - selectionRect.x;
      selectionRect.h = lastY_move - selectionRect.y;
      cursorCtx.clearRect(0, 0, cWidth, cHeight);
      cursorCtx.save();
      cursorCtx.setLineDash([4, 4]);
      cursorCtx.strokeStyle = "rgba(255,255,255,0.8)";
      cursorCtx.lineWidth = 1;
      cursorCtx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      cursorCtx.restore();
      return;
    }

    if (activeTool === 'move' && isMovingSelection && selectionImageData) {
      const dx = lastX_move - moveStartX;
      const dy = lastY_move - moveStartY;
      selectionOffsetX += dx;
      selectionOffsetY += dy;
      moveStartX = lastX_move;
      moveStartY = lastY_move;
      // Redibujar el imageData en la nueva posición (en cursorCanvas para preview)
      cursorCtx.clearRect(0, 0, cWidth, cHeight);
      cursorCtx.putImageData(selectionImageData, Math.round(selectionOffsetX), Math.round(selectionOffsetY));
      return;
    }

    if (activeTool === 'eyedropper') {
      // Solo mostrar cursor crosshair, no dibujar
      return;
    }

    // ── DRAW MODE ──
    events.forEach(event => {
      const { x, y, pressure, pointerType } = getCoordinates(event);

      if (event === events[events.length - 1]) {
        drawAllCursors(x, y, pressure);
        const now = Date.now();
        if (drawingChannel && now - lastBroadcastTime > 30) {
          drawingChannel.send({
            type: 'broadcast',
            event: 'cursor',
            payload: {
              userId: currentUser.id,
              x, y,
              alias: document.getElementById("sidebarAlias")?.textContent,
              colorAlias: document.getElementById("sidebarAlias")?.style.color
            }
          });
          lastBroadcastTime = now;
        }
      }

      if (!isDrawing || activeLayerIndex < 0) return;
      const layer = layersData[activeLayerIndex];
      if (layer.opacity === 0) return;
      const actx = layer.ctx;

      // 1. Stabilization (EMA) CSP Style
      // Una curva exponencial para el estabilizador:
      // Valores bajos (1-3) son casi instantáneos. Valores altos (20-40) se vuelven muy pesados.
      const smoothFactor = Math.pow(stabilizerValue - 1, 1.8) * 0.05;
      const alpha = stabilizerValue <= 1 ? 1.0 : (1 / (1 + smoothFactor));

      stabilizedX = stabilizedX + (x - stabilizedX) * alpha;
      stabilizedY = stabilizedY + (y - stabilizedY) * alpha;

      // 2. Velocity calculation for tapering
      const dist = Math.sqrt((stabilizedX - lastX) ** 2 + (stabilizedY - lastY) ** 2);
      const easedDist = lastDist + (dist - lastDist) * 0.2; // slow down size changes
      lastDist = easedDist;

      // 3. Pressure curve & Tapering (before segment push so each point carries its own size)
      const finalPressure = (pointerType === "mouse") ? 0.5 : Math.pow(Math.max(0.05, pressure), 1.3);
      const velocityScale = Math.min(1.4, 0.7 + (easedDist / 15));
      const baseSize = parseInt(toolSize.value);
      const dynamicSize = baseSize * (0.3 + finalPressure * 1.2) * velocityScale;
      lastDynamicSize = dynamicSize;

      currentSegment.push({ x: stabilizedX, y: stabilizedY, s: dynamicSize });

      // 4. Smooth Geometry (Midpoint Quadratic)
      const currentMidX = (lastX + stabilizedX) / 2;
      const currentMidY = (lastY + stabilizedY) / 2;

      actx.beginPath();
      actx.moveTo(midX, midY);
      actx.quadraticCurveTo(lastX, lastY, currentMidX, currentMidY);
      actx.lineCap = "round"; actx.lineJoin = "round";
      actx.lineWidth = dynamicSize;

      if (isEraserActive) {
        actx.globalCompositeOperation = "destination-out";
        actx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        actx.strokeStyle = toolColor.value;
        const opc = brushOpacity / 100;
        if (drawMode === "pencil") actx.globalAlpha = 0.5 * opc;
        else if (drawMode === "marker") actx.globalAlpha = 0.3 * opc;
        else actx.globalAlpha = 1.0 * opc;
        actx.globalCompositeOperation = "source-over";
      }

      actx.stroke();
      actx.globalAlpha = 1.0;
      actx.globalCompositeOperation = "source-over";

      lastX = stabilizedX;
      lastY = stabilizedY;
      midX = currentMidX;
      midY = currentMidY;
    });
  });

  cursorCanvas.addEventListener("pointerup", (e) => {
    // ── SPACE PAN ──
    if (isPanning) {
      isPanning = false;
      cursorCanvas.style.cursor = "grab";
      return;
    }

    const { x, y } = getCoordinates(e);
    cursorCanvas.releasePointerCapture(e.pointerId);

    // ── TOOL DISPATCH ──
    if (activeTool === 'lasso' && isSelecting) {
      isSelecting = false;
      if (selectionPath.length > 5) {
        // Normalizar el rect para getSelectionBounds
        startMarchingAnts();
        showSelectionActions();
      } else {
        clearSelection();
      }
      return;
    }

    if (activeTool === 'rectSelect' && isSelecting) {
      isSelecting = false;
      // Normalizar rect (manejar selecciones invertidas)
      if (selectionRect.w < 0) { selectionRect.x += selectionRect.w; selectionRect.w = Math.abs(selectionRect.w); }
      if (selectionRect.h < 0) { selectionRect.y += selectionRect.h; selectionRect.h = Math.abs(selectionRect.h); }
      if (selectionRect.w > 3 && selectionRect.h > 3) {
        startMarchingAnts();
        showSelectionActions();
      } else {
        clearSelection();
      }
      return;
    }

    if (activeTool === 'move' && isMovingSelection) {
      isMovingSelection = false;
      cursorCanvas.style.cursor = "grab";
      // Compositar el imageData movido de vuelta a la capa permanente
      if (selectionImageData && activeLayerIndex >= 0) {
        const layer = layersData[activeLayerIndex];
        layer.ctx.putImageData(selectionImageData, Math.round(selectionOffsetX), Math.round(selectionOffsetY));
        selectionImageData = null;
        syncToYjs();
        cursorCtx.clearRect(0, 0, cWidth, cHeight);
      }
      return;
    }

    // ── DRAWING MODE ──
    if (isDrawing && activeLayerIndex >= 0) {
      const layer = layersData[activeLayerIndex];
      const actx = layer.ctx;
      actx.beginPath();
      actx.moveTo(midX, midY);
      actx.lineTo(stabilizedX, stabilizedY);
      actx.lineCap = "round";
      actx.lineJoin = "round";
      actx.lineWidth = lastDynamicSize;
      if (isEraserActive) {
        actx.globalCompositeOperation = "destination-out";
        actx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        actx.strokeStyle = toolColor.value;
        const opc = brushOpacity / 100;
        actx.globalAlpha = (drawMode === "pencil") ? 0.5 * opc : (drawMode === "marker" ? 0.3 * opc : 1.0 * opc);
        actx.globalCompositeOperation = "source-over";
      }
      actx.stroke();
      actx.globalAlpha = 1.0;
      actx.globalCompositeOperation = "source-over";

      if (!isEraserActive) addRecentColor(toolColor.value);

      // Sync this stroke to Yjs (persist)
      syncToYjs();

      // Broadcast live draw-step to other users
      broadcastDrawStep(currentSegment);

      currentSegment = [];
    }

    isDrawing = false;
    drawAllCursors(x, y, 0.5);
  });

  cursorCanvas.addEventListener("pointerleave", () => {
    isDrawing = false;
    cursorCtx.clearRect(0, 0, cWidth, cHeight);
  });

  cursorCanvas.addEventListener("pointercancel", () => {
    isDrawing = false;
    cursorCtx.clearRect(0, 0, cWidth, cHeight);
  });

  // ── DIALOGUES ──────────────────────────────────
  function addDialogue(text = "", pChar = null) {
    currentDialogues.push({
      id: "diag_" + Date.now(),
      x: cWidth / 2 - 125,
      y: cHeight / 2 - 50,
      personaje: pChar,
      texto: text
    });

    // Play sound with slight pitch variation
    const createSound = new Audio("sounds/create.mp3");
    createSound.playbackRate = 0.9 + Math.random() * 0.3; // De 0.9 a 1.2
    createSound.play().catch(() => { });

    syncToYjs();
    renderDialogues();
    broadcastDialoguesSync();
  }

  qdAddBtn.onclick = () => {
    const text = qdInput.value.trim();
    if (!text) return;
    addDialogue(text, qdActiveChar);
    qdInput.value = "";
    qdInput.focus();
  };

  qdInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      qdAddBtn.click();
    }
  };

  qdCharBtn.onclick = async (e) => {
    e.stopPropagation();
    if (qdCharDropdown.classList.contains("hidden")) {
      renderQDCharDropdown();
      await window.ANIM.show(qdCharDropdown, 'anim-slide-up');
    } else {
      window.ANIM.hide(qdCharDropdown, 'anim-slide-down-out');
    }
  };

  function renderQDCharDropdown() {
    qdCharDropdown.innerHTML = "";
    const list = [{ name: "Ninguno", color: "#aaa" }, ...(currentScene?.personajes || [])];
    list.forEach(p => {
      const opt = document.createElement("div");
      opt.className = "qd-char-opt";
      opt.innerHTML = `<span class="qd-char-dot" style="background:${p.color}"></span><span>${p.name}</span>`;
      opt.onclick = () => {
        qdActiveChar = p.name === "Ninguno" ? null : p;
        if (qdActiveChar) {
          qdCharBtn.style.borderColor = p.color;
        } else {
          qdCharBtn.style.borderColor = "#db6f4e";
        }
        window.ANIM.hide(qdCharDropdown, 'anim-slide-down-out');
      };
      qdCharDropdown.appendChild(opt);
    });
  }

  // Cloase qd dropdown on click outside
  window.addEventListener("click", () => {
    if (!qdCharDropdown.classList.contains("hidden")) {
      window.ANIM.hide(qdCharDropdown, 'anim-slide-down-out');
    }
  });
  qdCharDropdown.onclick = (e) => e.stopPropagation();


  function renderDialogues() {
    if (!canvasDialogueFooter) return;
    canvasDialogueFooter.innerHTML = "";

    // Ocultar la capa vieja si existe
    if (dialoguesLayer) dialoguesLayer.style.display = "none";

    currentDialogues.forEach((diag, index) => {
      const entry = document.createElement("div");
      entry.className = "cdf-entry";
      entry.draggable = true;
      entry.dataset.index = index;

      // Drag Handle
      const handle = document.createElement("div");
      handle.className = "cdf-drag-handle";
      handle.innerHTML = `<div class="dots-grid"><span></span><span></span><span></span><span></span><span></span><span></span></div>`;
      entry.appendChild(handle);

      const nameSpan = document.createElement("span");
      nameSpan.className = "cdf-name";
      if (diag.personaje) {
        nameSpan.innerText = `${diag.personaje.name}:`;
        nameSpan.style.color = diag.personaje.color;
      } else {
        nameSpan.innerText = "S/P:";
        nameSpan.style.color = "#888";
      }

      const textInput = document.createElement("div");
      textInput.className = "cdf-text";
      textInput.contentEditable = "true";
      // Añadir algo de CSS base para que funcione como un input
      textInput.style.minHeight = "24px";
      textInput.style.padding = "8px";
      textInput.style.outline = "none";
      textInput.style.whiteSpace = "pre-wrap";

      const renderFormattedText = (text) => {
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const actionStyle = 'color:#db6f4e; font-style:italic; font-size:0.9em; background:rgba(219,111,78,0.1); padding:1px 4px; border-radius:4px;';
        html = html.replace(/\((.*?)\)/g, `<span style="${actionStyle}">($1)</span>`);
        html = html.replace(/\*(.*?)\*/g, `<span style="${actionStyle}">*$1*</span>`);
        return html;
      };

      textInput.innerHTML = renderFormattedText(diag.texto || "");

      let _diagSyncTimer;
      let _diagBroadcastTimer;
      textInput.oninput = (e) => {
        diag.texto = e.target.innerText;
        clearTimeout(_diagSyncTimer);
        _diagSyncTimer = setTimeout(syncToYjs, 1500);
        clearTimeout(_diagBroadcastTimer);
        _diagBroadcastTimer = setTimeout(broadcastDialoguesSync, 300);
      };

      textInput.onblur = (e) => {
        // Formatear visualmente al salir para no perder el cursor mientras escribe
        e.target.innerHTML = renderFormattedText(diag.texto || "");
      };

      const delBtn = document.createElement("button");
      delBtn.className = "cdf-del";
      delBtn.innerHTML = "&times;";
      delBtn.title = "Eliminar diálogo";
      delBtn.onclick = () => {
        currentDialogues = currentDialogues.filter(d => d.id !== diag.id);
        syncToYjs();
        renderDialogues();
        broadcastDialoguesSync();
      };

      const voBtn = document.createElement("button");
      voBtn.className = "cdf-vo-btn";
      if (diag.voice_url) voBtn.classList.add("has-audio");
      voBtn.title = diag.voice_url ? "Escuchar / Editar Voice Over" : "Grabar / Importar Voice Over";
      voBtn.innerHTML = `<img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774987840/v82sxbpab5fjepi7nfd4.png" alt="VO">`;
      voBtn.onclick = () => openVoiceModal(diag);

      entry.appendChild(nameSpan);
      entry.appendChild(textInput);
      entry.appendChild(voBtn);
      entry.appendChild(delBtn);

      // Drag Events
      entry.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", index);
        entry.classList.add("dragging");
      });
      entry.addEventListener("dragend", () => {
        entry.classList.remove("dragging");
        // For safety, clear all drag-overs
        canvasDialogueFooter.querySelectorAll(".cdf-entry").forEach(el => el.classList.remove("drag-over"));
      });
      entry.addEventListener("dragenter", (e) => {
        e.preventDefault();
        entry.classList.add("drag-over");
      });
      entry.addEventListener("dragleave", () => {
        entry.classList.remove("drag-over");
      });
      entry.addEventListener("dragover", (e) => {
        e.preventDefault();
      });
      entry.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        const toIndex = index;

        // Final cleanup
        canvasDialogueFooter.querySelectorAll(".cdf-entry").forEach(el => el.classList.remove("drag-over"));

        if (fromIndex !== toIndex) {
          const item = currentDialogues.splice(fromIndex, 1)[0];
          currentDialogues.splice(toIndex, 0, item);
          syncToYjs();
          renderDialogues();
          broadcastDialoguesSync();
        }
      });

      canvasDialogueFooter.appendChild(entry);
    });

    // Auto-scroll to bottom when adding new dialogues
    canvasDialogueFooter.scrollTop = canvasDialogueFooter.scrollHeight;
  }

  // ── Sincronización Yjs (reemplaza save/auto-save) ──

  async function navigateToPanel(direction) {
    const currentIndex = panelsData.findIndex(p => p.id === activePanelId);
    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= panelsData.length) return;

    const targetPanel = panelsData[nextIndex];

    // Sincronizar estado actual a Yjs antes de navegar
    if (panelSync && panelSync.ready) {
      panelSync.syncCanvasToYjs(layersData, canvasBgColor.value, currentDialogues);
      await panelSync.persist();
    }

    // Sincronizar diálogos a paneles table para animatica.js y grilla
    const curPanel = panelsData[currentIndex];
    if (curPanel) {
      curPanel.canvas_data = curPanel.canvas_data || {};
      curPanel.canvas_data.dialogos = currentDialogues;
      sb.from('paneles').update({ canvas_data: curPanel.canvas_data }).eq('id', curPanel.id).then();
    }

    // Animation
    canvasZoomWorld.classList.remove("canvas-switching");
    void canvasZoomWorld.offsetWidth;
    canvasZoomWorld.classList.add("canvas-switching");

    // Open next panel
    openPanelWorkspace(targetPanel);
  }

  // ── SHORTCUT SETTINGS ─────────────────────

  let activeShortcutCategory = 'dibujo';

  const shortcutCategories = {
    dibujo: {
      label: '🖌️ Dibujo',
      keys: ['brush', 'pencil', 'marker', 'eraser']
    },
    seleccion: {
      label: '✂️ Selección',
      keys: ['lasso', 'rectSelect', 'eyedropper', 'moveSelection']
    },
    trazo: {
      label: '✏️ Trazo',
      keys: ['sizeUp', 'sizeDown']
    },
    vista: {
      label: '👁️ Vista',
      keys: ['layers', 'onionSkin', 'flipCanvas', 'rotateCW', 'rotateCCW', 'zoomIn', 'zoomOut', 'zoomReset']
    },
    navegacion: {
      label: '🧭 Navegación',
      keys: ['panelNext', 'panelPrev']
    },
    hardware: {
      label: '🖊️ Hardware',
      keys: ['penLower', 'penUpper']
    }
  };

  const shortcutLabels = {
    brush: "Pincel",
    pencil: "Lápiz",
    marker: "Marcador",
    eraser: "Borrador",
    lasso: "Lazo",
    rectSelect: "Selección Rectangular",
    eyedropper: "Cuentagotas",
    moveSelection: "Mover Selección",
    layers: "Panel de Capas",
    onionSkin: "Papel Cebolla",
    flipCanvas: "Voltear Lienzo",
    sizeUp: "Aumentar Grosor",
    sizeDown: "Reducir Grosor",
    panelNext: "Panel Siguiente",
    panelPrev: "Panel Anterior",
    penLower: "Botón Inferior del Lápiz",
    penUpper: "Botón Superior del Lápiz",
    zoomIn: "Acercar (Zoom In)",
    zoomOut: "Alejar (Zoom Out)",
    zoomReset: "Restablecer Zoom",
    rotateCW: "Rotar 90° →",
    rotateCCW: "Rotar 90° ←"
  };

  function renderShortcutSettings() {
    shortcutListContainer.innerHTML = "";

    // ── Sidebar de categorías ──
    const catSidebar = document.createElement("div");
    catSidebar.className = "sc-categories";

    Object.keys(shortcutCategories).forEach(catId => {
      const cat = shortcutCategories[catId];
      const catBtn = document.createElement("button");
      catBtn.className = "sc-cat-btn" + (activeShortcutCategory === catId ? " active" : "");
      catBtn.textContent = cat.label;
      catBtn.onclick = () => {
        activeShortcutCategory = catId;
        renderShortcutSettings();
      };
      catSidebar.appendChild(catBtn);
    });

    // Botón restablecer al final del sidebar
    const resetBtn = document.createElement("button");
    resetBtn.className = "sc-cat-btn sc-reset-btn";
    resetBtn.textContent = "🔄 Restablecer";
    resetBtn.onclick = () => {
      userShortcuts = { ...defaultShortcuts };
      try {
        localStorage.setItem("rkShortcuts", JSON.stringify(userShortcuts));
        showToast("✔ Atajos restablecidos");
      } catch (e) {
        console.error("Error resetting shortcuts:", e);
        showToast("✖ Error al restablecer", "error");
      }
      renderShortcutSettings();
    };
    catSidebar.appendChild(resetBtn);

    // ── Panel de contenido ──
    const contentPanel = document.createElement("div");
    contentPanel.className = "sc-content";

    const activeCat = shortcutCategories[activeShortcutCategory];
    if (activeCat) {
      const catTitle = document.createElement("div");
      catTitle.className = "sc-content-title";
      catTitle.textContent = activeCat.label;
      contentPanel.appendChild(catTitle);

      activeCat.keys.forEach(id => {
        const row = document.createElement("div");
        row.className = "shortcut-row";

        const label = document.createElement("span");
        label.className = "shortcut-label";
        label.textContent = shortcutLabels[id] || id;

        const btn = document.createElement("button");
        btn.className = "shortcut-key-btn" + (recordingShortcutFor === id ? " recording" : "");
        const val = userShortcuts[id];
        const isButton = val && String(val).startsWith('btn_');
        const isCtrl = val && String(val).startsWith('ctrl+');
        btn.textContent = recordingShortcutFor === id
          ? "Presiona una tecla..."
          : isButton
            ? `Botón ${val.split('_')[1]}`
            : isCtrl
              ? 'Ctrl+' + val.slice(5).toUpperCase()
              : (val || "—").toUpperCase();
        btn.onclick = () => {
          recordingShortcutFor = id;
          renderShortcutSettings();
        };

        row.appendChild(label);
        row.appendChild(btn);
        contentPanel.appendChild(row);
      });
    }

    shortcutListContainer.appendChild(catSidebar);
    shortcutListContainer.appendChild(contentPanel);
  }

  // To capture mouse/pen buttons while recording
  window.addEventListener("pointerdown", (e) => {
    if (recordingShortcutFor && e.button !== 0) {
      e.preventDefault();
      e.stopPropagation();
      userShortcuts[recordingShortcutFor] = `btn_${e.button}`;
      try {
        localStorage.setItem("rkShortcuts", JSON.stringify(userShortcuts));
        if (typeof showToast === 'function') showToast("✔ Atajo guardado");
      } catch (err) {
        console.error("Error saving shortcuts:", err);
        if (typeof showToast === 'function') showToast("✖ Error al guardar atajo", "error");
      }
      recordingShortcutFor = null;
      renderShortcutSettings();
    }
  }, true);

  shortcutSettingsBtn?.addEventListener("click", async () => {
    if (shortcutModal.classList.contains("hidden")) {
      await window.ANIM.show(shortcutModal, 'anim-scale-in');
      renderShortcutSettings();
    } else {
      await window.ANIM.hide(shortcutModal, 'anim-fade-out');
      recordingShortcutFor = null;
    }
  });

  closeShortcutModal?.addEventListener("click", () => {
    window.ANIM.hide(shortcutModal, 'anim-fade-out');
    recordingShortcutFor = null;
  });

  // ══════════════════════════════════════════
  // PHASE 1+2: NEW TOOL SYSTEMS
  // ══════════════════════════════════════════

  // ── DOM refs for new tools ──
  const toolLasso = document.getElementById("toolLasso");
  const toolRectSelect = document.getElementById("toolRectSelect");
  const toolMove = document.getElementById("toolMove");
  const toolEyedropper = document.getElementById("toolEyedropper");
  const toolFlipCanvas = document.getElementById("toolFlipCanvas");
  const toolRotateCW = document.getElementById("toolRotateCW");
  const toolRotateCCW = document.getElementById("toolRotateCCW");
  const selectionActionsBar = document.getElementById("selectionActionsBar");
  const selCopy = document.getElementById("selCopy");
  const selCut = document.getElementById("selCut");
  const selPaste = document.getElementById("selPaste");
  const selDelete = document.getElementById("selDelete");
  const selDeselect = document.getElementById("selDeselect");
  const paletteSavedEl = document.getElementById("paletteSaved");
  const paletteRecentEl = document.getElementById("paletteRecent");

  // ── Set Active Tool ──
  function setActiveTool(tool) {
    activeTool = tool;
    // Resetear estados visuales
    const allToolBtns = [toolLasso, toolRectSelect, toolMove, toolEyedropper];
    allToolBtns.forEach(b => b?.classList.remove("active"));

    if (tool === 'lasso') { toolLasso?.classList.add("active"); }
    else if (tool === 'rectSelect') { toolRectSelect?.classList.add("active"); }
    else if (tool === 'move') { toolMove?.classList.add("active"); }
    else if (tool === 'eyedropper') { toolEyedropper?.classList.add("active"); }
    else {
      // 'draw' mode — reset to current brush/eraser
      isEraserActive ? toolEraser.classList.add("active") : null;
    }

    // Cambiar cursor
    if (tool === 'eyedropper') cursorCanvas.style.cursor = "crosshair";
    else if (tool === 'move') cursorCanvas.style.cursor = "grab";
    else if (tool === 'lasso' || tool === 'rectSelect') cursorCanvas.style.cursor = "crosshair";
    else cursorCanvas.style.cursor = "none";
    if (tool === 'draw') drawAllCursors(lastCursorPos.x, lastCursorPos.y, 0.5);
  }

  toolLasso?.addEventListener("click", () => { clearSelection(); setActiveTool('lasso'); });
  toolRectSelect?.addEventListener("click", () => { clearSelection(); setActiveTool('rectSelect'); });
  toolMove?.addEventListener("click", () => setActiveTool('move'));
  toolEyedropper?.addEventListener("click", () => setActiveTool('eyedropper'));

  // ── SELECTION SYSTEM ──────────────────────

  function clearSelection() {
    selectionPath = [];
    selectionRect = null;
    isSelecting = false;
    selectionImageData = null;
    isMovingSelection = false;
    if (selectionActionsBar) window.ANIM.hide(selectionActionsBar, 'anim-fade-out');
    // Limpiar visual de selección del cursorCanvas
    drawAllCursors();
  }

  function showSelectionActions() {
    if (selectionActionsBar) window.ANIM.show(selectionActionsBar, 'anim-fade-in');
  }

  function getSelectionBounds() {
    if (selectionRect) return selectionRect;
    if (selectionPath.length < 3) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectionPath.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    return { x: Math.floor(minX), y: Math.floor(minY), w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
  }

  function extractSelection() {
    if (activeLayerIndex < 0) return null;
    const bounds = getSelectionBounds();
    if (!bounds || bounds.w < 1 || bounds.h < 1) return null;
    const layer = layersData[activeLayerIndex];
    const x = Math.max(0, bounds.x);
    const y = Math.max(0, bounds.y);
    const w = Math.min(bounds.w, cWidth - x);
    const h = Math.min(bounds.h, cHeight - y);
    if (w < 1 || h < 1) return null;
    return { imageData: layer.ctx.getImageData(x, y, w, h), x, y, w, h };
  }

  function drawSelectionOutline() {
    // Dibujar contorno de selección animado (marching ants) en cursorCanvas
    const offset = (Date.now() / 80) % 16;
    cursorCtx.save();
    cursorCtx.setLineDash([6, 4]);
    cursorCtx.lineDashOffset = -offset;
    cursorCtx.strokeStyle = "white";
    cursorCtx.lineWidth = 1.5;

    if (selectionRect) {
      cursorCtx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      // Sombra
      cursorCtx.setLineDash([6, 4]);
      cursorCtx.lineDashOffset = -offset + 3;
      cursorCtx.strokeStyle = "rgba(0,0,0,0.5)";
      cursorCtx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    } else if (selectionPath.length > 2) {
      cursorCtx.beginPath();
      cursorCtx.moveTo(selectionPath[0].x, selectionPath[0].y);
      for (let i = 1; i < selectionPath.length; i++) {
        cursorCtx.lineTo(selectionPath[i].x, selectionPath[i].y);
      }
      cursorCtx.closePath();
      cursorCtx.stroke();
      // Sombra
      cursorCtx.setLineDash([6, 4]);
      cursorCtx.lineDashOffset = -offset + 3;
      cursorCtx.strokeStyle = "rgba(0,0,0,0.5)";
      cursorCtx.beginPath();
      cursorCtx.moveTo(selectionPath[0].x, selectionPath[0].y);
      for (let i = 1; i < selectionPath.length; i++) {
        cursorCtx.lineTo(selectionPath[i].x, selectionPath[i].y);
      }
      cursorCtx.closePath();
      cursorCtx.stroke();
    }
    cursorCtx.restore();
  }

  // Animar marching ants
  let marchingAntsRAF = null;
  function animateMarchingAnts() {
    if (!selectionPath.length && !selectionRect) {
      marchingAntsRAF = null;
      return;
    }
    cursorCtx.clearRect(0, 0, cWidth, cHeight);
    drawSelectionOutline();
    marchingAntsRAF = requestAnimationFrame(animateMarchingAnts);
  }

  function startMarchingAnts() {
    if (marchingAntsRAF) cancelAnimationFrame(marchingAntsRAF);
    animateMarchingAnts();
  }

  function stopMarchingAnts() {
    if (marchingAntsRAF) { cancelAnimationFrame(marchingAntsRAF); marchingAntsRAF = null; }
  }

  // ── SELECTION ACTIONS ─────────────────────

  selCopy?.addEventListener("click", () => selectionCopy());
  selCut?.addEventListener("click", () => selectionCut());
  selPaste?.addEventListener("click", () => selectionPaste());
  selDelete?.addEventListener("click", () => selectionDelete());
  selDeselect?.addEventListener("click", () => { clearSelection(); stopMarchingAnts(); cursorCtx.clearRect(0, 0, cWidth, cHeight); });

  function selectionCopy() {
    const data = extractSelection();
    if (!data) return;
    clipboardData = data.imageData;
    clipboardWidth = data.w;
    clipboardHeight = data.h;
    showToast("✔ Copiado al portapapeles");
  }

  function selectionCut() {
    const data = extractSelection();
    if (!data) return;
    clipboardData = data.imageData;
    clipboardWidth = data.w;
    clipboardHeight = data.h;
    // Borrar el área de la capa
    saveUndoState();
    const layer = layersData[activeLayerIndex];
    layer.ctx.clearRect(data.x, data.y, data.w, data.h);
    syncToYjs();
    clearSelection(); stopMarchingAnts();
    cursorCtx.clearRect(0, 0, cWidth, cHeight);
    showToast("✔ Cortado");
  }

  function selectionPaste() {
    if (!clipboardData || activeLayerIndex < 0) {
      showToast("ℹ No hay nada en el portapapeles", "error");
      return;
    }
    saveUndoState();
    const layer = layersData[activeLayerIndex];
    // Pegar centrado
    const px = Math.round((cWidth - clipboardWidth) / 2);
    const py = Math.round((cHeight - clipboardHeight) / 2);
    layer.ctx.putImageData(clipboardData, px, py);
    syncToYjs();
    showToast("✔ Pegado");
  }

  function selectionDelete() {
    const bounds = getSelectionBounds();
    if (!bounds || activeLayerIndex < 0) return;
    saveUndoState();
    const layer = layersData[activeLayerIndex];
    layer.ctx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
    syncToYjs();
    clearSelection(); stopMarchingAnts();
    cursorCtx.clearRect(0, 0, cWidth, cHeight);
    showToast("✔ Selección eliminada");
  }

  // ── EYEDROPPER ────────────────────────────

  function pickColorAt(x, y) {
    if (activeLayerIndex < 0) return;
    const px = Math.max(0, Math.min(Math.floor(x), cWidth - 1));
    const py = Math.max(0, Math.min(Math.floor(y), cHeight - 1));
    let hex = '#000000';

    // Read directly from active layer canvas
    const layer = layersData[activeLayerIndex];
    const pixel = layer.ctx.getImageData(px, py, 1, 1).data;
    hex = "#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join("");
    toolColor.value = hex;
    updatePreviews();
    showToast(`Color: ${hex}`);
  }

  // ── FLIP CANVAS ───────────────────────────

  toolFlipCanvas?.addEventListener("click", () => toggleFlip());

  function toggleFlip() {
    const container = drawingContainer;
    const info = adjustCanvasScale();
    const pt = _viewportCenteredCanvasPoint(container, info);

    isFlipped = !isFlipped;
    toolFlipCanvas.style.background = isFlipped ? "#db6f4e" : "";
    cachedRect = null;
    const newInfo = adjustCanvasScale();

    const sc = _scrollToCenterCanvasPoint(container, pt.x, pt.y, newInfo);
    container.scrollLeft = sc.scrollLeft;
    container.scrollTop = sc.scrollTop;
  }

  // ── ROTATE CANVAS ──────────────────────────

  toolRotateCW?.addEventListener("click", () => rotateCW());
  toolRotateCCW?.addEventListener("click", () => rotateCCW());

  function _viewportCenteredCanvasPoint(container, info) {
    const vpCX = container.clientWidth / 2;
    const vpCY = container.clientHeight / 2;
    const angle = canvasRotation * Math.PI / 180;
    const F = isFlipped ? -1 : 1;
    const S = info.scale;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const b1 = vpCX + container.scrollLeft - info.marginLeft;
    const b2 = vpCY + container.scrollTop - info.marginTop;
    return {
      x: (b1 * cosA + b2 * sinA) / (S * F),
      y: (cosA * b2 - sinA * b1) / S
    };
  }

  function _scrollToCenterCanvasPoint(container, cx, cy, info) {
    const angle = canvasRotation * Math.PI / 180;
    const F = isFlipped ? -1 : 1;
    const S = info.scale;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const vpCX = container.clientWidth / 2;
    const vpCY = container.clientHeight / 2;
    return {
      scrollLeft: (cx * F * cosA - cy * sinA) * S + info.marginLeft - vpCX,
      scrollTop: (cx * F * sinA + cy * cosA) * S + info.marginTop - vpCY
    };
  }

  function rotateCW() {
    const container = drawingContainer;
    const info = adjustCanvasScale();
    const pt = _viewportCenteredCanvasPoint(container, info);

    canvasRotation = (canvasRotation + 90) % 360;
    updateRotationUI();
    cachedRect = null;
    const newInfo = adjustCanvasScale();

    const sc = _scrollToCenterCanvasPoint(container, pt.x, pt.y, newInfo);
    container.scrollLeft = sc.scrollLeft;
    container.scrollTop = sc.scrollTop;
  }

  function rotateCCW() {
    const container = drawingContainer;
    const info = adjustCanvasScale();
    const pt = _viewportCenteredCanvasPoint(container, info);

    canvasRotation = (canvasRotation - 90 + 360) % 360;
    updateRotationUI();
    cachedRect = null;
    const newInfo = adjustCanvasScale();

    const sc = _scrollToCenterCanvasPoint(container, pt.x, pt.y, newInfo);
    container.scrollLeft = sc.scrollLeft;
    container.scrollTop = sc.scrollTop;
  }

  function updateRotationUI() {
    toolRotateCW.style.background = canvasRotation ? "#db6f4e" : "";
    toolRotateCCW.style.background = canvasRotation ? "#db6f4e" : "";
  }

  // ── COLOR PALETTE ─────────────────────────

  function renderColorPalette() {
    if (!paletteSavedEl || !paletteRecentEl) return;
    paletteSavedEl.innerHTML = "";
    paletteRecentEl.innerHTML = "";

    // Saved colors (12 slots)
    savedColors.forEach((color, i) => {
      const swatch = document.createElement("div");
      swatch.className = "palette-swatch" + (color ? "" : " empty");
      if (color) swatch.style.background = color;
      swatch.addEventListener("click", () => {
        if (color) { toolColor.value = color; updatePreviews(); }
      });
      swatch.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        savedColors[i] = toolColor.value;
        localStorage.setItem("rkSavedColors", JSON.stringify(savedColors));
        renderColorPalette();
        showToast("✔ Color guardado en slot " + (i + 1));
      });
      paletteSavedEl.appendChild(swatch);
    });

    // Recent colors (últimos 6)
    for (let i = 0; i < 6; i++) {
      const swatch = document.createElement("div");
      const color = recentColors[i];
      swatch.className = "palette-swatch" + (color ? "" : " empty");
      if (color) swatch.style.background = color;
      swatch.addEventListener("click", () => {
        if (color) { toolColor.value = color; updatePreviews(); }
      });
      paletteRecentEl.appendChild(swatch);
    }
  }

  function addRecentColor(hex) {
    if (!hex) return;
    const normalized = hex.toLowerCase();
    recentColors = recentColors.filter(c => c !== normalized);
    recentColors.unshift(normalized);
    if (recentColors.length > 6) recentColors.pop();
    localStorage.setItem("rkRecentColors", JSON.stringify(recentColors));
    renderColorPalette();
  }

  // ── REDO SYSTEM ───────────────────────────

  // ── Sincronización Yjs activa (no hay auto-save ni indicador) ──

  // ── RENDER PALETTE ON LOAD ────────────────
  renderColorPalette();

  init();

})();
let mediaRecorder;
let audioChunks = [];
let recordInterval;
let recordingStartTime;

async function openVoiceModal(diag) {
  const modal = document.getElementById("voiceModal");
  const recordBtn = document.getElementById("voRecordBtn");
  const timer = document.getElementById("voTimer");
  const status = document.getElementById("voStatus");
  const preview = document.getElementById("voPreview");
  const importInput = document.getElementById("voImportInput");
  const cancelBtn = document.getElementById("voCancelBtn");
  const saveBtn = document.getElementById("voSaveBtn");

  await window.ANIM.show(modal, 'anim-scale-in');
  status.innerText = diag.voice_url ? "Audio existente cargado" : "Listo para grabar";
  preview.style.display = diag.voice_url ? "block" : "none";
  if (diag.voice_url) preview.src = diag.voice_url;

  let currentAudioBlob = null;

  // Reset button state
  recordBtn.classList.remove("recording");
  recordBtn.innerText = "●";
  timer.innerText = "00:00";

  const updateTimer = () => {
    const now = Date.now();
    const diff = Math.floor((now - recordingStartTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    timer.innerText = `${mins}:${secs}`;
  };

  recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(currentAudioBlob);
          preview.src = url;
          preview.style.display = "block";
          status.innerText = "Grabación lista";
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        recordInterval = setInterval(updateTimer, 1000);
        recordBtn.classList.add("recording");
        recordBtn.innerText = "■";
        status.innerText = "Grabando...";
      } catch (err) {
        showToast("✖ Error al acceder al micrófono", "error");
      }
    } else {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      clearInterval(recordInterval);
      recordBtn.classList.remove("recording");
      recordBtn.innerText = "●";
    }
  };

  importInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      currentAudioBlob = file;
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.style.display = "block";
      status.innerText = "Archivo importado: " + file.name;
    }
  };

  cancelBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      clearInterval(recordInterval);
    }
    window.ANIM.hide(modal, 'anim-scale-out');
  };

  saveBtn.onclick = async () => {
    if (!currentAudioBlob && !diag.voice_url) {
      showToast("ℹ No hay audio para guardar", "error");
      return;
    }

    if (!currentAudioBlob) {
      await window.ANIM.hide(modal, 'anim-scale-out');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = "...";
    status.innerText = "Subiendo audio...";

    try {
      const audioUrl = await uploadToCloudinary(currentAudioBlob, "storyboards/voiceovers", "video");
      diag.voice_url = audioUrl;
      syncToYjs();
      renderDialogues();
      broadcastDialoguesSync();
      showToast("✔ Voice-Over guardado");
      await window.ANIM.hide(modal, 'anim-scale-out');
    } catch (err) {
      console.error(err);
      showToast("✖ Error al subir audio", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = "GUARDAR";
    }
  };

  // ── EXPORT GLOBALS FOR PLUGINS ──
  window.RKActiveTool = () => typeof activeTool !== 'undefined' ? activeTool : null;
  window.RKApplyColor = (hex) => {
    const toolColor = document.getElementById("toolColor");
    if (toolColor) {
      toolColor.value = hex;
      toolColor.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof showToast !== 'undefined') showToast(`Color: ${hex}`);
    }
  };
}

// ============================================================
// TUTORIAL INTERACTIVO (LUNA) — fuera del IIFE para máxima fiabilidad
// ============================================================
(function () {
  const btnGrid = document.getElementById("btnTutorialEscenaGrid");
  const btnCanvas = document.getElementById("btnTutorialEscenaCanvas");
  if (!btnGrid && !btnCanvas) return; // No estamos en escena.html

  // ── GRID (Storyboard) Tutorial ──────────────────────────
  const tutorialLinesGrid = [
    // 0: Intro
    { text: "Vaya, al fin llegas a los paneles. Soy Luna, por si ya lo olvidaste.", mood: "neutral" },
    // 1: Choice menu
    { text: "¿Qué quieres aprender de la vista de paneles?", mood: "neutral",
      choices: [
        { label: "Añadir paneles", goTo: 2, color: "#a2ff7e" },
        { label: "Ver diálogos", goTo: 4, color: "#7ecbff" },
        { label: "Editar paneles", goTo: 7, color: "#7ecbff" },
        { label: "Explícamelo todo", goTo: 2, isFullMode: true, color: "#db6f4e" },
        { label: "Nada, ya sé lo que hago", goTo: "close", color: "#ff6b6b" }
      ]
    },
    // ── Sección: Añadir paneles (2-3) ──
    // 2:
    {
      text: "Haz clic en el botón ~'+'~ para añadir un lienzo vacío, o haz clic en uno existente para entrar a dibujar.",
      mood: "neutral",
      spotlight: "#addPanelBtn",
      spotlightPadding: 8
    },
    // 3: End of section
    { text: "¿Quieres aprender algo más de esta vista?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Ver diálogos", goTo: 4, color: "#7ecbff" },
        { label: "Editar paneles", goTo: 7, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 10, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Diálogos de panel (4-6) ──
    // 4:
    {
      text: "Puedes ver los ^diálogos^ de cada panel rápidamente con su ícono de mensaje. Mira el primer panel.",
      mood: "neutral",
      onShow: () => {
        const firstCard = document.querySelector(".escena-panel-card");
        const firstPanelList = document.querySelector(".panel-dialogs-list");
        const firstPanelBtn = document.querySelector(".panel-dialogs-btn");
        if (firstPanelList) {
          if (!firstPanelList.hasChildNodes()) {
            const demoRow = document.createElement("div");
            demoRow.className = "pdl-row demo-row";
            demoRow.innerHTML = `<strong style="color: #db6f4e">Luna:</strong> <span>¿Ves? Aquí aparecerán los diálogos de tu panel.</span>`;
            firstPanelList.appendChild(demoRow);
          }
          firstPanelList.classList.add("expanded");
        }
        if (firstPanelBtn) firstPanelBtn.style.cssText = "background: rgba(219, 111, 78, 0.4); opacity: 1;";
        if (firstCard && window.RKTutorial) {
          window.RKTutorial.spotlight(firstCard, 8);
          setTimeout(() => window.RKTutorial.spotlight(firstCard, 8), 320);
        }
      },
      onHide: () => {
        const firstCard = document.querySelector(".escena-panel-card");
        const firstPanelList = document.querySelector(".panel-dialogs-list");
        const firstPanelBtn = document.querySelector(".panel-dialogs-btn");
        if (firstPanelList) {
          firstPanelList.classList.remove("expanded");
          setTimeout(() => {
            const demo = firstPanelList.querySelector(".demo-row");
            if (demo) demo.remove();
          }, 300);
        }
        if (firstPanelBtn) firstPanelBtn.style.cssText = "";
        if (firstCard && window.RKTutorial) {
          setTimeout(() => {
            if (document.getElementById("tutorialSpotlight")?.classList.contains("active")) {
              window.RKTutorial.spotlight(firstCard, 8);
            }
          }, 320);
        }
      }
    },
    // 5:
    { text: "También puedes ^arrastrarlos^ para reordenarlos... Intenta mantener el orden, ¿sí?", mood: "neutral" },
    // 6: End of section
    { text: "¿Algo más que quieras saber?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Añadir paneles", goTo: 2, color: "#a2ff7e" },
        { label: "Editar paneles", goTo: 7, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 10, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Editar paneles (7-9) ──
    // 7:
    {
      text: "Con el ícono del ^lápiz^ puedes editar la información de cada panel. Ahí le pones nombre, duración, o lo que necesites.",
      mood: "neutral",
      onShow: () => {
        const firstCard = document.querySelector(".escena-panel-card");
        const editBtn = document.querySelector(".panel-edit-btn");
        if (editBtn) editBtn.style.cssText = "background: #db6f4e; border-color: white; opacity: 1; transform: scale(1.1);";
        if (firstCard && window.RKTutorial) window.RKTutorial.spotlight(firstCard, 8);
      },
      onHide: () => {
        const editBtn = document.querySelector(".panel-edit-btn");
        if (editBtn) editBtn.style.cssText = "";
      }
    },
    // 8:
    { text: "Recuerda: cada panel representa un ^lienzo de dibujo^. Si quieres dibujar, solo haz clic en la miniatura.", mood: "neutral" },
    // 9: End of section
    { text: "¿Te sigo explicando?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Añadir paneles", goTo: 2, color: "#a2ff7e" },
        { label: "Ver diálogos", goTo: 4, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 10, color: "#ff6b6b" }
      ]
    },
    // 10: Closing
    { text: "En fin, eso es todo por aquí. ^¡A trabajar!^", mood: "ashamed_blush" }
  ];

  // ── CANVAS (Drawing) Tutorial ───────────────────────────
  const tutorialLinesCanvas = [
    // 0: Intro
    { text: "¿Vas a dibujar? Espero que tengas buen pulso.", mood: "neutral" },
    // 1: Choice menu
    { text: "El lienzo es bastante completo. ¿Qué quieres que te explique?", mood: "neutral",
      choices: [
        { label: "Pinceles y herramientas", goTo: 2, color: "#a2ff7e" },
        { label: "Capas y ajustes", goTo: 5, color: "#7ecbff" },
        { label: "Atajos y guardado", goTo: 8, color: "#7ecbff" },
        { label: "Diálogos rápidos", goTo: 11, color: "#7ecbff" },
        { label: "Explícamelo todo", goTo: 2, isFullMode: true, color: "#db6f4e" },
        { label: "Déjame en paz", goTo: "close", color: "#ff6b6b" }
      ]
    },
    // ── Sección: Pinceles y herramientas (2-4) ──
    // 2:
    {
      text: "A tu izquierda tienes los ~pinceles~, borrador, herramientas de selección y la paleta de color. Lo esencial.",
      mood: "neutral",
      spotlight: [".drawing-dock-left", "#brushDropdownMenu"],
      spotlightPadding: 6,
      onShow: () => {
        const brushMenu = document.getElementById("brushDropdownMenu");
        if (brushMenu) {
          brushMenu.classList.remove("hidden");
          brushMenu.style.cssText = "left: 60px; top: -20px; opacity: 1; transform: scale(1); pointer-events: none;";
          setTimeout(() => { if (window.RKTutorial) window.RKTutorial.spotlight([".drawing-dock-left", "#brushDropdownMenu"], 6); }, 50);
        }
      },
      onHide: () => {
        const brushMenu = document.getElementById("brushDropdownMenu");
        if (brushMenu) {
          brushMenu.classList.add("hidden");
          brushMenu.style.cssText = "left: 60px; top: -20px;";
        }
      }
    },
    // 3:
    { text: "Si ves cursores de otros miembros flotando por aquí, también puedes ver y enviar ^reacciones^ dándole al ícono de tu avatar en el lateral derecho.", mood: "neutral" },
    // 4: End of section
    { text: "¿Quieres aprender algo más del lienzo?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Capas y ajustes", goTo: 5, color: "#7ecbff" },
        { label: "Atajos y guardado", goTo: 8, color: "#7ecbff" },
        { label: "Diálogos rápidos", goTo: 11, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 14, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Capas y ajustes (5-7) ──
    // 5:
    {
      text: "Arriba puedes ajustar el ^grosor^, ^opacidad^ y ^estabilizador^. También están Flip, Papel Cebolla, ~Capas~ y Referencias.",
      mood: "neutral",
      spotlight: [".drawing-dock-top", "#layersManager"],
      spotlightPadding: 6,
      onShow: () => {
        const layersMgr = document.getElementById("layersManager");
        const btn = document.getElementById("toggleLayersBtn");
        if (layersMgr) {
          layersMgr.classList.remove("hidden");
          layersMgr.style.cssText = "display: flex; position: absolute; top: 80px; left: 50%; transform: translateX(-50%); z-index: 2100; pointer-events: none;";
          setTimeout(() => { if (window.RKTutorial) window.RKTutorial.spotlight([".drawing-dock-top", "#layersManager"], 6); }, 50);
        }
        if (btn) btn.classList.add("active");
      },
      onHide: () => {
        const layersMgr = document.getElementById("layersManager");
        const btn = document.getElementById("toggleLayersBtn");
        if (layersMgr) {
          layersMgr.classList.add("hidden");
          layersMgr.style.cssText = "";
        }
        if (btn) btn.classList.remove("active");
      }
    },
    // 6:
    { text: "Las ~capas~ son como hojas transparentes apiladas. Puedes dibujar en cada una por separado y reorganizarlas como quieras.", mood: "neutral" },
    // 7: End of section
    { text: "¿Algo más que quieras explorar?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Pinceles y herramientas", goTo: 2, color: "#a2ff7e" },
        { label: "Atajos y guardado", goTo: 8, color: "#7ecbff" },
        { label: "Diálogos rápidos", goTo: 11, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 14, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Atajos y guardado (8-10) ──
    // 8:
    {
      text: "A la derecha tienes el botón de ^atajos personalizados^ y el sagrado botón ~Guardar~.",
      mood: "neutral",
      spotlight: [".drawing-dock-right", "#shortcutModal"],
      spotlightPadding: 6,
      onShow: () => {
        const shortcutModal = document.getElementById("shortcutModal");
        if (shortcutModal) {
          shortcutModal.classList.remove("hidden");
          shortcutModal.style.pointerEvents = "none";
          setTimeout(() => { if (window.RKTutorial) window.RKTutorial.spotlight([".drawing-dock-right", "#shortcutModal"], 6); }, 50);
        }
      },
      onHide: () => {
        const shortcutModal = document.getElementById("shortcutModal");
        if (shortcutModal) {
          shortcutModal.classList.add("hidden");
          shortcutModal.style.pointerEvents = "auto";
        }
      }
    },
    // 9:
    { text: "Puedes configurar tus propios atajos de teclado desde ahí. Así no tienes que buscar cada herramienta con el ratón.", mood: "neutral" },
    // 10: End of section
    { text: "¿Quieres seguir aprendiendo?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Pinceles y herramientas", goTo: 2, color: "#a2ff7e" },
        { label: "Capas y ajustes", goTo: 5, color: "#7ecbff" },
        { label: "Diálogos rápidos", goTo: 11, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 14, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Diálogos rápidos (11-13) ──
    // 11:
    {
      text: "¿Ves la barra de abajo? Puedes escribir ^diálogos rápidos^ directamente desde ahí sin salir del lienzo.",
      mood: "neutral",
      spotlight: ".quick-dialog-bar",
      spotlightPadding: 8,
      onShow: () => {
        const box = document.getElementById("tutorialScriptBox");
        if (box) box.style.setProperty("bottom", "120px", "important");
        const bar = document.getElementById("quickDialogBar");
        if (bar) {
          bar.classList.remove("hidden");
          setTimeout(() => { if (window.RKTutorial) window.RKTutorial.spotlight(".quick-dialog-bar", 8); }, 50);
        }
      },
      onHide: () => {
        const box = document.getElementById("tutorialScriptBox");
        if (box) box.style.setProperty("bottom", "30px", "important");
        const bar = document.getElementById("quickDialogBar");
        if (bar) bar.classList.add("hidden");
      }
    },
    // 12:
    { text: "Es perfecto para cuando estás dibujando y se te ocurre un diálogo. No pierdas la inspiración.", mood: "neutral" },
    // 13: End of section
    { text: "¿Te enseño algo más?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Pinceles y herramientas", goTo: 2, color: "#a2ff7e" },
        { label: "Capas y ajustes", goTo: 5, color: "#7ecbff" },
        { label: "Atajos y guardado", goTo: 8, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "Ya es suficiente", goTo: 14, color: "#ff6b6b" }
      ]
    },
    // 14: Closing
    { text: "Más te vale no olvidar ~guardar~ tu trabajo... ^¡No es que me importe si lo pierdes!^", mood: "ashamed_blush" }
  ];

  btnGrid?.addEventListener("click", () => {
    if (window.RKTutorial) window.RKTutorial.toggle(tutorialLinesGrid);
  });

  btnCanvas?.addEventListener("click", () => {
    if (window.RKTutorial) window.RKTutorial.toggle(tutorialLinesCanvas);
  });

  // ══════════════════════════════════════════
  // SIDEBAR — Atajos (comparte localStorage con index_projects)
  // ══════════════════════════════════════════
  let escProjectId = null;
  (async function initEscShortcuts() {
    try {
      const { data: story } = await sb.from('storyboards').select('proyecto_id').eq('id', sceneId).single();
      escProjectId = story?.proyecto_id || null;
    } catch (e) { escProjectId = null; }
    window.__initShortcuts?.(escProjectId, goEscShortcut);
  })();

  function goEscShortcut(sc) {
    if (!sc?.type) return;
    if (sc.type === "escena" && sc.targetId) {
      window.location.href = "escena.html?id=" + sc.targetId;
      return;
    }
    if (sc.type === "concepto" && sc.targetId) {
      const pid = escProjectId || '';
      window.location.href = "worldbuilding.html?project_id=" + pid + "&world_id=" + sc.targetId;
      return;
    }
    if (sc.type === "section") {
      window.location.href = "index_projects.html";
      return;
    }
  }
})();

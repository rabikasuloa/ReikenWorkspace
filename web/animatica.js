/* ============================================================
   REIKEN WORKSPACE - MOTOR DE ANIMÁTICA Y LÍNEA DE TIEMPO
   ============================================================ */

(function () {
  const sb = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get("id");

  if (!sceneId) {
    window.location.href = "storyboard.html";
    return;
  }

  // ── CONSTANTES DE ESCALA ──────────────────────────────────
  const PX_PER_SEC = 100; // 1 segundo = 100 píxeles

  // ── ELEMENTOS DOM ─────────────────────────────────────────
  const animaticTitle = document.getElementById("animaticTitle");
  const backBtn = document.getElementById("backBtn");
  const saveIndicator = document.getElementById("saveIndicator");
  const saveIndicatorText = document.getElementById("saveIndicatorText");
  const btnSaveNow = document.getElementById("btnSaveNow");

  // Reproductor
  const playerViewport = document.getElementById("playerViewport");
  const playerFrameImg = document.getElementById("playerFrameImg");
  const playerEmpty = document.getElementById("playerEmpty");
  const subtitleOverlay = document.getElementById("subtitleOverlay");
  
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnStop = document.getElementById("btnStop");
  const btnLoop = document.getElementById("btnLoop");
  const btnMute = document.getElementById("btnMute");
  const timeDisplay = document.getElementById("timeDisplay");

  // Ajustes Lateral - Paneles
  const panelConfigArea = document.getElementById("panelConfigArea");
  const panelConfigEmpty = document.getElementById("panelConfigEmpty");
  const selectedPanelLabel = document.getElementById("selectedPanelLabel");
  const panelDurInput = document.getElementById("panelDurInput");

  // Cámara Sliders
  const camEnabledToggle = document.getElementById("camEnabledToggle");
  const cameraControlsArea = document.getElementById("cameraControlsArea");
  const camStartZoom = document.getElementById("camStartZoom");
  const camStartZoomVal = document.getElementById("camStartZoomVal");
  const camStartX = document.getElementById("camStartX");
  const camStartXVal = document.getElementById("camStartXVal");
  const camStartY = document.getElementById("camStartY");
  const camStartYVal = document.getElementById("camStartYVal");
  
  const camEndZoom = document.getElementById("camEndZoom");
  const camEndZoomVal = document.getElementById("camEndZoomVal");
  const camEndX = document.getElementById("camEndX");
  const camEndXVal = document.getElementById("camEndXVal");
  const camEndY = document.getElementById("camEndY");
  const camEndYVal = document.getElementById("camEndYVal");
  const btnTestCamera = document.getElementById("btnTestCamera");

  // SFX e Inputs heredados (ocultos o reutilizados)
  const btnUploadSFX = document.getElementById("btnUploadSFX");
  const sfxFileInput = document.getElementById("sfxFileInput");
  const sfxFileHint = document.getElementById("sfxFileHint");
  const sfxProperties = document.getElementById("sfxProperties");
  const sfxVolume = document.getElementById("sfxVolume");
  const sfxVolumeVal = document.getElementById("sfxVolumeVal");
  const btnDeleteSFX = document.getElementById("btnDeleteSFX");

  // VO e Inputs heredados
  const btnUploadVO = document.getElementById("btnUploadVO");
  const voFileInput = document.getElementById("voFileInput");
  const voFileHint = document.getElementById("voFileHint");
  const btnDeleteVO = document.getElementById("btnDeleteVO");

  // Ajustes Lateral - Audios (Nuevo)
  const audioConfigArea = document.getElementById("audioConfigArea");
  const selectedAudioLabel = document.getElementById("selectedAudioLabel");
  const audioNameInput = document.getElementById("audioNameInput");
  const audioStartInput = document.getElementById("audioStartInput");
  const audioDurationInput = document.getElementById("audioDurationInput");
  const audioVolumeSlider = document.getElementById("audioVolumeSlider");
  const audioVolumeVal = document.getElementById("audioVolumeVal");
  const audioRowSelect = document.getElementById("audioRowSelect");
  const audioLoopToggle = document.getElementById("audioLoopToggle");
  const btnDeleteAudioClip = document.getElementById("btnDeleteAudioClip");

  // Botones de añadir clips en barra de herramientas
  const btnAddVoClip = document.getElementById("btnAddVoClip");
  const btnAddSfxClip = document.getElementById("btnAddSfxClip");
  const btnAddGeneralClip = document.getElementById("btnAddGeneralClip");
  // Inputs de subida exclusivos de la toolbar (separados de los inputs del panel)
  const voFileInputTimeline = document.getElementById("voFileInputTimeline");
  const sfxFileInputTimeline = document.getElementById("sfxFileInputTimeline");
  const generalFileInputTimeline = document.getElementById("generalFileInputTimeline");

  // Línea de tiempo
  const sceneTotalTimeLabel = document.getElementById("sceneTotalTimeLabel");
  const timelineScrollArea = document.getElementById("timelineScrollArea");
  const timeRuler = document.getElementById("timeRuler");
  const tracksContainer = document.getElementById("tracksContainer");
  const playhead = document.getElementById("playhead");
  const playheadHandle = document.getElementById("playheadHandle");
  
  const panelsTrack = document.getElementById("panelsTrack");
  const voTrack = document.getElementById("voTrack");
  const sfxTrack = document.getElementById("sfxTrack");
  const generalTrack = document.getElementById("generalTrack");

  const btnUploadSceneAudio = document.getElementById("btnUploadSceneAudio");
  const sceneAudioFileInput = document.getElementById("sceneAudioFileInput");
  const sceneAudioFileHint = document.getElementById("sceneAudioFileHint");
  const btnDeleteSceneAudio = document.getElementById("btnDeleteSceneAudio");

  // ── ESTADO GLOBAL DE LA APLICACIÓN ───────────────────────
  let projectId = null;
  let sceneData = null;
  let panels = [];
  let selectedPanel = null;
  let selectedAudioClip = null; // Audio clip seleccionado
  
  // Audios multicanal
  let audioClips = []; // Contiene { id, name, url, type, startTime, duration, volume, trackRow, loop }
  let activeAudioElements = {}; // clipId -> HTML5 Audio Element

  // Reproducción
  let isPlaying = false;
  let isMuted = false;
  let isLooping = false;
  let currentTime = 0; // segundos
  let totalDuration = 0; // segundos
  let animationFrameId = null;
  let lastFrameTime = 0;
  
  // Guardado
  let isSaving = false;
  let hasUnsaved = false;

  // ── INICIALIZACIÓN ────────────────────────────────────────
  async function init() {
    // Sincronizar perfil global de Reiken
    if (window.RKCore) await window.RKCore.loadGlobalProfile();
    
    // Inyectar modales modulares de Apariencia/Config si existen
    if (window.injectAppearanceModal) window.injectAppearanceModal();
    if (window.injectConfigModal) window.injectConfigModal();

    // Vincular botones laterales
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

    // Sidebar Toggle
    const sidebar = document.getElementById("sidebar");
    document.getElementById("sidebarToggle")?.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });

    // Cargar datos
    await loadData();
    setupEventListeners();
    if (projectId) window.__initShortcuts?.(projectId, goAnimShortcut);
  }

  function goAnimShortcut(sc) {
    if (!sc?.type) return;
    if (sc.type === 'escena' && sc.targetId) {
      window.location.href = 'escena.html?id=' + sc.targetId;
    } else if (sc.type === 'concepto' && sc.targetId) {
      window.location.href = 'worldbuilding.html?project_id=' + projectId + '&world_id=' + sc.targetId;
    } else if (sc.type === 'section') {
      window.location.href = 'index_projects.html?id=' + projectId;
    }
  }

  // ── CARGAR DATOS DESDE SUPABASE ─────────────────────────
  async function loadData() {
    try {
      // 1. Datos de Escena
      const { data: scene, error: sceneErr } = await sb.from("escenas").select("*").eq("id", sceneId).single();
      if (sceneErr || !scene) throw new Error("No se pudo cargar la escena.");
      sceneData = scene;

      if (sceneData.storyboard_id) {
        const { data: sbData } = await sb.from("storyboards").select("proyecto_id").eq("id", sceneData.storyboard_id).single();
        if (sbData) projectId = sbData.proyecto_id;
      }
      animaticTitle.textContent = `🎬 Animática - ${sceneData.titulo || 'Sin título'}`;

      // 2. Paneles
      const { data: panelsList, error: panelsErr } = await sb.from("paneles").select("*").eq("escena_id", sceneId).order("orden", { ascending: true });
      if (panelsErr) throw new Error("No se pudieron cargar los paneles.");
      
      panels = panelsList.map(p => {
        const canvas_data = p.canvas_data || {};
        if (!canvas_data.duracion) canvas_data.duracion = "1.0";
        if (!canvas_data.camera) {
          canvas_data.camera = {
            enabled: false,
            start: { zoom: 1, x: 0, y: 0 },
            end: { zoom: 1.2, x: 0, y: 0 }
          };
        }
        if (!canvas_data.sfx) {
          canvas_data.sfx = { url: null, volume: 0.8, name: null };
        }
        p.canvas_data = canvas_data;
        return p;
      });

      // Recalcular offsets temporales de paneles
      recalcTimes();

      // Cargar y migrar audios multicanal
      loadAndMigrateAudio();

      renderTimeline();
      updatePlayerView();
    } catch (err) {
      console.error(err);
      window.showToast("Error cargando datos: " + err.message, "error");
    }
  }

  // ── CARGA Y MIGRACIÓN DE AUDIO A MULTICANAL ──────────────
  function loadAndMigrateAudio() {
    audioClips = [];
    let isMigrated = false;
    const urlVal = sceneData.audio_url;

    if (urlVal && urlVal.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(urlVal);
        if (parsed && parsed.is_multitrack) {
          audioClips = parsed.clips || [];
          return;
        }
      } catch (e) {
        console.warn("Error parsing audio_url as JSON, treating as raw URL", e);
      }
    }

    // Si llegamos aquí, es formato antiguo o nulo. Procedemos a migrar.
    // 1. Banda sonora general heredada
    if (urlVal && urlVal.trim().length > 0 && !urlVal.trim().startsWith("{")) {
      audioClips.push({
        id: "clip_legacy_general_" + Date.now(),
        name: "Banda Sonora Original",
        url: urlVal,
        type: "general",
        startTime: 0,
        duration: Math.max(120, totalDuration),
        volume: 0.5,
        trackRow: 0,
        loop: true
      });
      isMigrated = true;
    }

    // 2. Audios individuales heredados de los paneles
    panels.forEach(p => {
      // Voice Over antiguo
      if (p.voiceover_url) {
        audioClips.push({
          id: "clip_migrated_vo_" + p.id,
          name: `Voz Panel ${p._index + 1}`,
          url: p.voiceover_url,
          type: "vo",
          startTime: p._start,
          duration: parseFloat(p.canvas_data.duracion || 1.0),
          volume: 1.0,
          trackRow: 0,
          loop: false
        });
        isMigrated = true;
      }

      // SFX antiguo
      if (p.canvas_data.sfx && p.canvas_data.sfx.url) {
        audioClips.push({
          id: "clip_migrated_sfx_" + p.id,
          name: p.canvas_data.sfx.name || `SFX Panel ${p._index + 1}`,
          url: p.canvas_data.sfx.url,
          type: "sfx",
          startTime: p._start,
          duration: 3.0,
          volume: p.canvas_data.sfx.volume || 0.8,
          trackRow: 0,
          loop: false
        });
        isMigrated = true;
      }
    });

    if (isMigrated) {
      saveSceneAudioClips();
    }
  }

  // Guarda los clips multicanal en Supabase
  async function saveSceneAudioClips() {
    updateSaveIndicatorState("saving");
    try {
      const payload = {
        is_multitrack: true,
        clips: audioClips
      };
      const jsonStr = JSON.stringify(payload);
      const { error } = await sb.from("escenas").update({ audio_url: jsonStr }).eq("id", sceneId);
      if (error) throw error;
      updateSaveIndicatorState("saved");
    } catch (e) {
      console.error(e);
      updateSaveIndicatorState("unsaved");
    }
  }

  // ── RENDERIZAR LÍNEA DE TIEMPO ──────────────────────────
  function renderTimeline() {
    panelsTrack.innerHTML = "";
    
    // Render panels track
    panels.forEach((panel, index) => {
      const duration = parseFloat(panel.canvas_data.duracion || 1.0);
      const width = duration * PX_PER_SEC;
      const left = panel._start * PX_PER_SEC;

      const pBlock = document.createElement("div");
      pBlock.className = "timeline-block panel-block";
      pBlock.style.left = `${left}px`;
      pBlock.style.width = `${width}px`;
      pBlock.dataset.id = panel.id;

      if (selectedPanel && selectedPanel.id === panel.id) {
        pBlock.classList.add("selected");
      }

      // Miniatura
      const imgUrl = (panel.canvas_data && panel.canvas_data.imagen_url) ? panel.canvas_data.imagen_url : panel.imagen_url;
      const thumb = document.createElement("div");
      thumb.className = "panel-block-thumb";
      if (imgUrl) thumb.style.backgroundImage = `url(${imgUrl})`;
      else thumb.textContent = "Sin Dibujo";
      pBlock.appendChild(thumb);

      // Info
      const info = document.createElement("div");
      info.className = "panel-block-info";
      
      const title = document.createElement("span");
      title.className = "panel-block-title";
      title.textContent = `Panel ${index + 1}`;
      
      const dur = document.createElement("span");
      dur.className = "panel-block-duration";
      dur.textContent = `${duration.toFixed(1)}s`;

      info.appendChild(title);
      info.appendChild(dur);
      pBlock.appendChild(info);

      // Tirador para redimensionar (estirar duración)
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "resize-handle";
      pBlock.appendChild(resizeHandle);

      // Clic para seleccionar
      pBlock.addEventListener("click", (e) => {
        if (e.target.classList.contains("resize-handle")) return;
        selectPanel(panel);
      });

      // Lógica de arrastre de duración
      resizeHandle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const startX = e.clientX;
        const startWidth = width;

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const newWidth = Math.max(25, startWidth + deltaX); // Min 0.25s
          const newDuration = Math.round((newWidth / PX_PER_SEC) * 10) / 10;

          pBlock.style.width = `${newDuration * PX_PER_SEC}px`;
          dur.textContent = `${newDuration.toFixed(1)}s`;
          panel.canvas_data.duracion = newDuration.toString();
        };

        const onMouseUp = async () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          recalcTimes();
          renderTimeline();
          updatePlayerView();
          
          await savePanelChanges(panel);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      panelsTrack.appendChild(pBlock);
    });

    // Renderizar las 3 pistas de audio con sub-filas dinámicas
    renderAudioTrack(voTrack, "vo");
    renderAudioTrack(sfxTrack, "sfx");
    renderAudioTrack(generalTrack, "general");

    sceneTotalTimeLabel.textContent = `Duración Total: ${totalDuration.toFixed(1)}s`;
    
    // Redimensionar regla y contenedor
    const totalWidth = totalDuration * PX_PER_SEC;
    timeRuler.style.width = `${totalWidth + 400}px`;
    tracksContainer.style.width = `${totalWidth + 400}px`;

    // Renderizar marcas de la regla
    renderRuler();
  }

  // Renderiza una pista de audio específica de forma multicanal
  function renderAudioTrack(trackEl, type) {
    trackEl.innerHTML = "";
    
    const clips = audioClips.filter(c => c.type === type);
    
    // Calcular el número máximo de trackRow
    let maxRow = 0;
    clips.forEach(c => {
      if (c.trackRow > maxRow) maxRow = c.trackRow;
    });
    
    // Ajustar altura de la pista
    const subRowHeight = 35;
    const padding = 10;
    const trackHeight = Math.max(1, maxRow + 1) * subRowHeight + padding;
    trackEl.style.height = `${trackHeight}px`;

    // Dibujar líneas de guía
    for (let r = 0; r <= maxRow; r++) {
      const line = document.createElement("div");
      line.className = "track-row-sub-line";
      line.style.top = `${r * subRowHeight + padding / 2 + 15}px`;
      trackEl.appendChild(line);
    }

    // Dibujar cada clip
    clips.forEach(clip => {
      const left = clip.startTime * PX_PER_SEC;
      const width = clip.duration * PX_PER_SEC;
      const top = clip.trackRow * subRowHeight + padding / 2;

      const block = document.createElement("div");
      block.className = `timeline-block audio-block ${clip.type}`;
      block.style.left = `${left}px`;
      block.style.width = `${width}px`;
      block.style.top = `${top}px`;
      block.dataset.id = clip.id;

      if (selectedAudioClip && selectedAudioClip.id === clip.id) {
        block.classList.add("selected");
      }

      // Título
      const label = document.createElement("span");
      label.className = "audio-block-title";
      const icon = clip.type === 'vo' ? '🗣 ' : clip.type === 'sfx' ? '💥 ' : '🎵 ';
      label.textContent = icon + (clip.name || "Audio");
      block.appendChild(label);

      // Meta (Volumen / Loop)
      const meta = document.createElement("span");
      meta.className = "audio-block-meta";
      meta.innerHTML = `${clip.loop ? '🔁' : ''} ${Math.round(clip.volume * 100)}%`;
      block.appendChild(meta);

      // Clic para seleccionar
      block.addEventListener("click", (e) => {
        e.stopPropagation();
        selectAudioClip(clip);
      });

      // Arrastrar audio
      block.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        selectAudioClip(clip);

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = left;
        const originalStartTime = clip.startTime;
        const originalTrackRow = clip.trackRow;

        const onMouseMove = (moveEvent) => {
          // Desplazamiento horizontal (Tiempo)
          const deltaX = moveEvent.clientX - startX;
          const newLeft = Math.max(0, startLeft + deltaX);
          const newStartTime = Math.round((newLeft / PX_PER_SEC) * 10) / 10;
          
          block.style.left = `${newStartTime * PX_PER_SEC}px`;
          clip.startTime = newStartTime;

          // Desplazamiento vertical (Fila de superposición)
          const deltaY = moveEvent.clientY - startY;
          const newRow = Math.max(0, Math.min(3, originalTrackRow + Math.round(deltaY / subRowHeight)));
          block.style.top = `${newRow * subRowHeight + padding / 2}px`;
          clip.trackRow = newRow;

          // Sincronizar tiempo de audio interactivo
          if (activeAudioElements[clip.id]) {
            const relTime = currentTime - clip.startTime;
            if (relTime >= 0 && relTime < clip.duration) {
              activeAudioElements[clip.id].currentTime = relTime;
            }
          }
        };

        const onMouseUp = async () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          renderTimeline();
          await saveSceneAudioClips();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      trackEl.appendChild(block);
    });
  }

  // Recalcula los tiempos acumulados de los paneles
  function recalcTimes() {
    let offset = 0;
    panels.forEach((p, index) => {
      const d = parseFloat(p.canvas_data.duracion || 1.0);
      p._start = offset;
      p._end = offset + d;
      p._index = index;
      offset += d;
    });
    totalDuration = offset;
  }

  // Dibuja las marcas en la regla
  function renderRuler() {
    timeRuler.innerHTML = "";
    const secondsToRender = Math.max(30, Math.ceil(totalDuration) + 5);
    const totalTicks = secondsToRender * 10;

    for (let i = 0; i <= totalTicks; i++) {
      const timeVal = i / 10;
      const left = timeVal * PX_PER_SEC;
      const tick = document.createElement("div");
      tick.className = "ruler-tick";
      tick.style.left = `${left}px`;

      if (i % 10 === 0) {
        tick.classList.add("major");
        
        const label = document.createElement("div");
        label.className = "ruler-label";
        label.style.left = `${left}px`;
        label.textContent = `${timeVal.toFixed(0)}s`;
        timeRuler.appendChild(label);
      } else if (i % 5 === 0) {
        tick.style.height = "12px";
        tick.style.backgroundColor = "rgba(255,255,255,0.25)";
      }

      timeRuler.appendChild(tick);
    }
  }

  // ── SELECCIONAR ELEMENTOS Y CONFIGURACIONES ───────────────
  function selectPanel(panel) {
    selectedPanel = panel;
    selectedAudioClip = null;

    // Resaltar en la línea de tiempo
    document.querySelectorAll(".panel-block").forEach(el => {
      el.classList.remove("selected");
      if (el.dataset.id === panel.id) el.classList.add("selected");
    });
    document.querySelectorAll(".audio-block").forEach(el => el.classList.remove("selected"));

    audioConfigArea.style.display = "none";
    panelConfigEmpty.style.display = "none";
    panelConfigArea.style.display = "block";

    selectedPanelLabel.textContent = `Configurar Panel #${panel._index + 1}`;
    panelDurInput.value = parseFloat(panel.canvas_data.duracion || 1.0).toFixed(1);

    // Ajustar Cámara Dinámica
    const cam = panel.canvas_data.camera;
    camEnabledToggle.checked = cam.enabled;
    
    camStartZoom.value = cam.start.zoom;
    camStartZoomVal.textContent = `${parseFloat(cam.start.zoom).toFixed(2)}x`;
    camStartX.value = cam.start.x;
    camStartXVal.textContent = `${cam.start.x}%`;
    camStartY.value = cam.start.y;
    camStartYVal.textContent = `${cam.start.y}%`;

    camEndZoom.value = cam.end.zoom;
    camEndZoomVal.textContent = `${parseFloat(cam.end.zoom).toFixed(2)}x`;
    camEndX.value = cam.end.x;
    camEndXVal.textContent = `${cam.end.x}%`;
    camEndY.value = cam.end.y;
    camEndYVal.textContent = `${cam.end.y}%`;

    toggleCameraUI(cam.enabled);

    // SFX
    const sfx = panel.canvas_data.sfx;
    if (sfx && sfx.url) {
      sfxFileHint.textContent = sfx.name || "Sonido cargado";
      sfxVolume.value = sfx.volume || 0.8;
      sfxVolumeVal.textContent = `${Math.round(sfx.volume * 100)}%`;
      sfxProperties.style.display = "grid";
    } else {
      sfxFileHint.textContent = "Ninguno";
      sfxProperties.style.display = "none";
    }

    // VO
    if (panel.voiceover_url) {
      voFileHint.textContent = panel.voiceover_url.split('/').pop().substring(0, 30) + "...";
      btnDeleteVO.style.display = "block";
    } else {
      voFileHint.textContent = "Ninguno";
      btnDeleteVO.style.display = "none";
    }

    seekTo(panel._start);
  }

  function selectAudioClip(clip) {
    selectedAudioClip = clip;
    selectedPanel = null;

    document.querySelectorAll(".panel-block").forEach(el => el.classList.remove("selected"));
    document.querySelectorAll(".audio-block").forEach(el => {
      el.classList.remove("selected");
      if (el.dataset.id === clip.id) el.classList.add("selected");
    });

    panelConfigArea.style.display = "none";
    panelConfigEmpty.style.display = "none";
    audioConfigArea.style.display = "block";

    selectedAudioLabel.textContent = `Ajustes: ${clip.type.toUpperCase()}`;
    audioNameInput.value = clip.name || "";
    audioStartInput.value = clip.startTime.toFixed(1);
    audioDurationInput.value = clip.duration.toFixed(1);
    audioVolumeSlider.value = clip.volume;
    audioVolumeVal.textContent = `${Math.round(clip.volume * 100)}%`;
    audioRowSelect.value = clip.trackRow.toString();
    audioLoopToggle.checked = clip.loop;

    seekTo(clip.startTime);
  }

  function toggleCameraUI(enabled) {
    if (enabled) {
      cameraControlsArea.style.opacity = "1";
      cameraControlsArea.style.pointerEvents = "auto";
    } else {
      cameraControlsArea.style.opacity = "0.5";
      cameraControlsArea.style.pointerEvents = "none";
    }
  }

  // ── REPRODUCCIÓN Y MEZCLA DE SONIDO ───────────────────────
  function startPlayback() {
    if (totalDuration <= 0) return;
    isPlaying = true;
    btnPlayPause.textContent = "⏸";
    lastFrameTime = performance.now();

    // Sincronizar mezcla
    syncAudiosOnTick();

    animationFrameId = requestAnimationFrame(playbackTick);
    if (window.RKSound) window.RKSound.play('clickconcept');
  }

  function stopPlayback() {
    isPlaying = false;
    btnPlayPause.textContent = "▶";
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    stopCurrentVoices();
  }

  function stopCurrentVoices() {
    Object.keys(activeAudioElements).forEach(id => {
      activeAudioElements[id].pause();
      delete activeAudioElements[id];
    });
  }

  function playbackTick(now) {
    if (!isPlaying) return;

    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    currentTime += delta;

    if (currentTime >= totalDuration) {
      if (isLooping) {
        currentTime = 0;
        stopCurrentVoices();
      } else {
        currentTime = totalDuration;
        stopPlayback();
      }
    }

    seekTo(currentTime);

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(playbackTick);
    }
  }

  function seekTo(time) {
    currentTime = Math.max(0, Math.min(totalDuration, time));
    
    // Mover playhead
    const leftPx = currentTime * PX_PER_SEC;
    playhead.style.left = `${leftPx}px`;

    const formatTime = (t) => {
      const min = Math.floor(t / 60);
      const sec = Math.floor(t % 60);
      const ms = Math.floor((t % 1) * 10);
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms}`;
    };
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;

    // Auto-scroll timeline
    const viewWidth = timelineScrollArea.clientWidth;
    const scrollLeft = timelineScrollArea.scrollLeft;
    if (leftPx > scrollLeft + viewWidth - 50) {
      timelineScrollArea.scrollLeft = leftPx - viewWidth + 100;
    } else if (leftPx < scrollLeft + 50) {
      timelineScrollArea.scrollLeft = Math.max(0, leftPx - 100);
    }

    updatePlayerView();
    syncAudiosOnTick();
  }

  // Mezclador de audio interactivo multicanal
  function syncAudiosOnTick() {
    if (isMuted) {
      stopCurrentVoices();
      return;
    }

    audioClips.forEach(clip => {
      const isWithinRange = (currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration));

      if (isWithinRange) {
        const relTime = currentTime - clip.startTime;
        
        if (isPlaying) {
          if (!activeAudioElements[clip.id]) {
            const audio = new Audio(clip.url);
            audio.volume = clip.volume;
            audio.loop = clip.loop;
            audio.muted = isMuted;
            audio.currentTime = relTime;
            audio.play().catch(e => console.warn("Error playing mix audio", e));
            activeAudioElements[clip.id] = audio;
          } else {
            const audio = activeAudioElements[clip.id];
            audio.volume = clip.volume;
            audio.loop = clip.loop;
            audio.muted = isMuted;
            
            if (audio.paused) {
              audio.currentTime = relTime;
              audio.play().catch(e => console.warn(e));
            } else if (Math.abs(audio.currentTime - relTime) > 0.25) {
              audio.currentTime = relTime;
            }
          }
        } else {
          const audio = activeAudioElements[clip.id];
          if (audio && !audio.paused) {
            audio.pause();
          }
        }
      } else {
        const audio = activeAudioElements[clip.id];
        if (audio) {
          audio.pause();
          delete activeAudioElements[clip.id];
        }
      }
    });
  }

  function getPanelAtTime(time) {
    return panels.find(p => time >= p._start && time < p._end) || panels[panels.length - 1];
  }

  function updatePlayerView() {
    if (panels.length === 0) {
      playerFrameImg.style.display = "none";
      playerEmpty.style.display = "flex";
      subtitleOverlay.style.display = "none";
      return;
    }

    playerEmpty.style.display = "none";
    playerFrameImg.style.display = "block";

    const activePanel = getPanelAtTime(currentTime);
    if (!activePanel) return;

    // Cargar imagen
    const imgUrl = (activePanel.canvas_data && activePanel.canvas_data.imagen_url) ? activePanel.canvas_data.imagen_url : activePanel.imagen_url;
    if (imgUrl) {
      if (playerFrameImg.src !== imgUrl) {
        playerFrameImg.src = imgUrl;
      }
    } else {
      playerFrameImg.src = "";
      playerFrameImg.style.display = "none";
    }

    // Subtítulos
    const dialogs = (activePanel.canvas_data && activePanel.canvas_data.dialogos) ? activePanel.canvas_data.dialogos : [];
    if (dialogs.length > 0) {
      const fullText = dialogs.map(d => {
        const charName = d.personaje ? d.personaje.name : "???";
        return `<strong>${charName}:</strong> "${d.texto || ''}"`;
      }).join("<br>");
      subtitleOverlay.innerHTML = fullText;
      subtitleOverlay.style.display = "block";
    } else {
      subtitleOverlay.style.display = "none";
    }

    applyCameraTransform(activePanel);
  }

  function applyCameraTransform(panel) {
    const cam = panel.canvas_data.camera;
    if (!cam || !cam.enabled) {
      playerFrameImg.style.transform = "scale(1) translate(0px, 0px)";
      return;
    }

    const duration = parseFloat(panel.canvas_data.duracion || 1.0);
    const relTime = currentTime - panel._start;
    const t = Math.max(0, Math.min(1, relTime / duration));

    const zoom = parseFloat(cam.start.zoom) + t * (parseFloat(cam.end.zoom) - parseFloat(cam.start.zoom));
    const x = parseFloat(cam.start.x) + t * (parseFloat(cam.end.x) - parseFloat(cam.start.x));
    const y = parseFloat(cam.start.y) + t * (parseFloat(cam.end.y) - parseFloat(cam.start.y));

    playerFrameImg.style.transform = `scale(${zoom}) translate(${x}%, ${y}%)`;
  }

  // ── CONFIGURACIÓN DE EVENT LISTENERS ──────────────────────
  function setupEventListeners() {
    backBtn.addEventListener("click", () => {
      stopPlayback();
      window.location.href = `escena.html?id=${sceneId}`;
    });

    btnSaveNow.addEventListener("click", async () => {
      btnSaveNow.disabled = true;
      btnSaveNow.textContent = "Guardando...";
      try {
        await saveAllData();
        window.showToast("✔ Cambios guardados con éxito.");
      } catch (e) {
        window.showToast("✖ Error guardando: " + e.message, "error");
      } finally {
        btnSaveNow.disabled = false;
        btnSaveNow.textContent = "Guardar Ahora";
      }
    });

    // Controles de Playback
    btnPlayPause.addEventListener("click", () => {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });

    btnStop.addEventListener("click", () => {
      stopPlayback();
      seekTo(0);
    });

    btnLoop.addEventListener("click", () => {
      isLooping = !isLooping;
      btnLoop.classList.toggle("active", isLooping);
    });

    btnMute.addEventListener("click", () => {
      isMuted = !isMuted;
      btnMute.classList.toggle("active", isMuted);
      btnMute.textContent = isMuted ? "🔇" : "🔊";
      
      // Aplicar volumen 0 a los audios activos si se silencia
      Object.keys(activeAudioElements).forEach(id => {
        activeAudioElements[id].volume = isMuted ? 0 : audioClips.find(c => c.id === id).volume;
      });
    });

    // Barra espaciadora para reproducir/pausar
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        if (isPlaying) stopPlayback();
        else startPlayback();
      }
    });

    // Scrubbing en regla
    timeRuler.addEventListener("mousedown", (e) => {
      const onMouseMove = (moveEvent) => {
        const rect = timeRuler.getBoundingClientRect();
        const offsetX = moveEvent.clientX - rect.left;
        seekTo(Math.max(0, offsetX / PX_PER_SEC));
      };
      
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      
      const rect = timeRuler.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      seekTo(offsetX / PX_PER_SEC);
    });

    // Ajuste de duración de panel manual
    panelDurInput.addEventListener("change", async () => {
      if (!selectedPanel) return;
      const val = Math.max(0.1, parseFloat(panelDurInput.value) || 1.0);
      panelDurInput.value = val.toFixed(1);
      selectedPanel.canvas_data.duracion = val.toString();
      
      recalcTimes();
      renderTimeline();
      updatePlayerView();
      await savePanelChanges(selectedPanel);
    });

    // Cámara dinámica Toggle
    camEnabledToggle.addEventListener("change", async () => {
      if (!selectedPanel) return;
      selectedPanel.canvas_data.camera.enabled = camEnabledToggle.checked;
      toggleCameraUI(camEnabledToggle.checked);
      updatePlayerView();
      await savePanelChanges(selectedPanel);
    });

    // Sliders de Cámara
    const onCamSliderChange = async () => {
      if (!selectedPanel) return;
      const cam = selectedPanel.canvas_data.camera;
      
      cam.start.zoom = parseFloat(camStartZoom.value);
      camStartZoomVal.textContent = `${cam.start.zoom.toFixed(2)}x`;
      cam.start.x = parseInt(camStartX.value);
      camStartXVal.textContent = `${cam.start.x}%`;
      cam.start.y = parseInt(camStartY.value);
      camStartYVal.textContent = `${cam.start.y}%`;

      cam.end.zoom = parseFloat(camEndZoom.value);
      camEndZoomVal.textContent = `${cam.end.zoom.toFixed(2)}x`;
      cam.end.x = parseInt(camEndX.value);
      camEndXVal.textContent = `${cam.end.x}%`;
      cam.end.y = parseInt(camEndY.value);
      camEndYVal.textContent = `${cam.end.y}%`;

      updatePlayerView();
    };

    const saveCamSettingsDebounced = debounce(async () => {
      if (selectedPanel) await savePanelChanges(selectedPanel);
    }, 1000);

    const sliders = [camStartZoom, camStartX, camStartY, camEndZoom, camEndX, camEndY];
    sliders.forEach(slider => {
      slider.addEventListener("input", () => {
        onCamSliderChange();
        saveCamSettingsDebounced();
      });
    });

    // Previsualización de cámara en el panel
    btnTestCamera.addEventListener("click", () => {
      if (!selectedPanel) return;
      stopPlayback();
      seekTo(selectedPanel._start);
      
      isPlaying = true;
      btnPlayPause.textContent = "⏸";
      lastFrameTime = performance.now();
      
      const testLoop = (now) => {
        if (!isPlaying) return;
        const delta = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        
        currentTime += delta;
        if (currentTime >= selectedPanel._end) {
          currentTime = selectedPanel._start;
        }
        
        seekTo(currentTime);
        animationFrameId = requestAnimationFrame(testLoop);
      };
      
      animationFrameId = requestAnimationFrame(testLoop);
    });

    // ── AGREGAR NUEVOS CLIPS DE AUDIO (Timeline toolbar) ─────
    btnAddVoClip.addEventListener("click", () => {
      voFileInputTimeline.click();
    });

    btnAddSfxClip.addEventListener("click", () => {
      sfxFileInputTimeline.click();
    });

    btnAddGeneralClip.addEventListener("click", () => {
      generalFileInputTimeline.click();
    });

    // Subir y añadir clip VO desde la toolbar
    voFileInputTimeline.addEventListener("change", async () => {
      const file = voFileInputTimeline.files[0];
      if (!file) return;

      window.showToast("Subiendo clip de voz...");
      try {
        const url = await window.uploadToCloudinary(file, "animatica/voiceovers", "raw");
        const newClip = {
          id: "clip_vo_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: url,
          type: "vo",
          startTime: currentTime,
          duration: 3.0, // por defecto, se ajusta con metadatos
          volume: 1.0,
          trackRow: 0,
          loop: false
        };

        const tempAudio = new Audio(url);
        tempAudio.addEventListener("loadedmetadata", () => {
          newClip.duration = tempAudio.duration;
          renderTimeline();
          saveSceneAudioClips();
        });

        audioClips.push(newClip);
        renderTimeline();
        await saveSceneAudioClips();
        window.showToast("✔ Voz en off añadida a la línea de tiempo.");
      } catch (err) {
        window.showToast("✖ Error subiendo Voz: " + err.message, "error");
      }
    });

    // Subir y añadir clip SFX desde la toolbar
    sfxFileInputTimeline.addEventListener("change", async () => {
      const file = sfxFileInputTimeline.files[0];
      if (!file) return;

      window.showToast("Subiendo efecto de sonido...");
      try {
        const url = await window.uploadToCloudinary(file, "animatica/sfx", "raw");
        const newClip = {
          id: "clip_sfx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: url,
          type: "sfx",
          startTime: currentTime,
          duration: 2.0, // por defecto
          volume: 0.8,
          trackRow: 0,
          loop: false
        };

        const tempAudio = new Audio(url);
        tempAudio.addEventListener("loadedmetadata", () => {
          newClip.duration = tempAudio.duration;
          renderTimeline();
          saveSceneAudioClips();
        });

        audioClips.push(newClip);
        renderTimeline();
        await saveSceneAudioClips();
        window.showToast("✔ Efecto de sonido añadido.");
      } catch (err) {
        window.showToast("✖ Error subiendo SFX: " + err.message, "error");
      }
    });

    // Subir y añadir clip Banda Sonora desde la toolbar
    generalFileInputTimeline.addEventListener("change", async () => {
      const file = generalFileInputTimeline.files[0];
      if (!file) return;

      window.showToast("Subiendo banda sonora...");
      try {
        const url = await window.uploadToCloudinary(file, "animatica/soundtrack", "raw");
        const newClip = {
          id: "clip_gen_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: url,
          type: "general",
          startTime: currentTime,
          duration: 10.0, // por defecto
          volume: 0.5,
          trackRow: 0,
          loop: true
        };

        const tempAudio = new Audio(url);
        tempAudio.addEventListener("loadedmetadata", () => {
          newClip.duration = tempAudio.duration;
          renderTimeline();
          saveSceneAudioClips();
        });

        audioClips.push(newClip);
        renderTimeline();
        await saveSceneAudioClips();
        window.showToast("✔ Banda sonora añadida a la línea de tiempo.");
      } catch (err) {
        window.showToast("✖ Error subiendo audio: " + err.message, "error");
      }
    });

    // ── BINDEOS PROPIEDADES DE AUDIO ──────────────────────────
    const saveAudioDebounced = debounce(async () => {
      await saveSceneAudioClips();
    }, 1000);

    audioNameInput.addEventListener("input", () => {
      if (!selectedAudioClip) return;
      selectedAudioClip.name = audioNameInput.value;
      const el = document.querySelector(`.audio-block[data-id="${selectedAudioClip.id}"] .audio-block-title`);
      if (el) {
        const icon = selectedAudioClip.type === 'vo' ? '🗣 ' : selectedAudioClip.type === 'sfx' ? '💥 ' : '🎵 ';
        el.textContent = icon + selectedAudioClip.name;
      }
      saveAudioDebounced();
    });

    audioStartInput.addEventListener("change", () => {
      if (!selectedAudioClip) return;
      selectedAudioClip.startTime = Math.max(0, parseFloat(audioStartInput.value) || 0);
      audioStartInput.value = selectedAudioClip.startTime.toFixed(1);
      renderTimeline();
      saveAudioDebounced();
    });

    audioDurationInput.addEventListener("change", () => {
      if (!selectedAudioClip) return;
      selectedAudioClip.duration = Math.max(0.1, parseFloat(audioDurationInput.value) || 1.0);
      audioDurationInput.value = selectedAudioClip.duration.toFixed(1);
      renderTimeline();
      saveAudioDebounced();
    });

    audioVolumeSlider.addEventListener("input", () => {
      if (!selectedAudioClip) return;
      const vol = parseFloat(audioVolumeSlider.value);
      selectedAudioClip.volume = vol;
      audioVolumeVal.textContent = `${Math.round(vol * 100)}%`;
      
      const audioInstance = activeAudioElements[selectedAudioClip.id];
      if (audioInstance) {
        audioInstance.volume = vol * (isMuted ? 0 : 1);
      }
      renderTimeline();
      saveAudioDebounced();
    });

    audioRowSelect.addEventListener("change", () => {
      if (!selectedAudioClip) return;
      selectedAudioClip.trackRow = parseInt(audioRowSelect.value) || 0;
      renderTimeline();
      saveAudioDebounced();
    });

    audioLoopToggle.addEventListener("change", () => {
      if (!selectedAudioClip) return;
      selectedAudioClip.loop = audioLoopToggle.checked;
      
      const audioInstance = activeAudioElements[selectedAudioClip.id];
      if (audioInstance) {
        audioInstance.loop = selectedAudioClip.loop;
      }
      renderTimeline();
      saveAudioDebounced();
    });

    btnDeleteAudioClip.addEventListener("click", async () => {
      if (!selectedAudioClip || !confirm("¿Seguro que deseas eliminar este clip de audio?")) return;
      
      const audioInstance = activeAudioElements[selectedAudioClip.id];
      if (audioInstance) {
        audioInstance.pause();
        delete activeAudioElements[selectedAudioClip.id];
      }

      audioClips = audioClips.filter(c => c.id !== selectedAudioClip.id);
      selectedAudioClip = null;
      
      audioConfigArea.style.display = "none";
      panelConfigEmpty.style.display = "block";

      renderTimeline();
      await saveSceneAudioClips();
      window.showToast("✔ Clip de audio eliminado.");
    });

    // ── GESTIÓN DE AUDIO INDIVIDUAL HEREDADO (SFX/VO EN PANEL) 
    // Mantiene compatibilidad: el botón del panel sube y asigna la URL directamente al panel
    btnUploadSFX.addEventListener("click", () => sfxFileInput.click());
    sfxFileInput.addEventListener("change", async () => {
      const file = sfxFileInput.files[0];
      if (!file || !selectedPanel) return;

      sfxFileHint.textContent = "Subiendo archivo...";
      try {
        const url = await window.uploadToCloudinary(file, "animatica/sfx", "raw");
        selectedPanel.canvas_data.sfx = {
          url: url,
          name: file.name,
          volume: parseFloat(sfxVolume.value)
        };
        sfxFileHint.textContent = file.name;
        sfxProperties.style.display = "grid";
        await savePanelChanges(selectedPanel);
        window.showToast("✔ Efecto de sonido del panel actualizado.");
      } catch (err) {
        sfxFileHint.textContent = "Error";
        window.showToast("✖ Error subiendo SFX: " + err.message, "error");
      }
    });
    btnDeleteSFX.addEventListener("click", async () => {
      if (!selectedPanel || !confirm("¿Eliminar efecto de sonido de este panel?")) return;
      selectedPanel.canvas_data.sfx = { url: null, volume: 0.8, name: null };
      sfxFileHint.textContent = "Ninguno";
      sfxProperties.style.display = "none";
      await savePanelChanges(selectedPanel);
    });

    btnUploadVO.addEventListener("click", () => voFileInput.click());
    voFileInput.addEventListener("change", async () => {
      const file = voFileInput.files[0];
      if (!file || !selectedPanel) return;

      voFileHint.textContent = "Subiendo archivo...";
      try {
        const url = await window.uploadToCloudinary(file, "animatica/voiceovers", "raw");
        selectedPanel.voiceover_url = url;
        voFileHint.textContent = file.name.substring(0, 30);
        btnDeleteVO.style.display = "block";
        await savePanelChanges(selectedPanel);
        window.showToast("✔ Voz en off del panel actualizada.");
      } catch (err) {
        voFileHint.textContent = "Error";
        window.showToast("✖ Error subiendo VO: " + err.message, "error");
      }
    });
    btnDeleteVO.addEventListener("click", async () => {
      if (!selectedPanel || !confirm("¿Eliminar voz en off de este panel?")) return;
      selectedPanel.voiceover_url = null;
      voFileHint.textContent = "Ninguno";
      btnDeleteVO.style.display = "none";
      await savePanelChanges(selectedPanel);
    });
  }

  // ── PERSISTENCIA ──────────────────────────────────────────
  async function savePanelChanges(panel) {
    updateSaveIndicatorState("saving");
    try {
      const { error } = await sb.from("paneles").update({
        canvas_data: panel.canvas_data,
        voiceover_url: panel.voiceover_url
      }).eq("id", panel.id);
      
      if (error) throw error;
      updateSaveIndicatorState("saved");
    } catch (err) {
      console.error(err);
      updateSaveIndicatorState("unsaved");
    }
  }

  async function saveAllData() {
    updateSaveIndicatorState("saving");
    try {
      const promises = panels.map(p => 
        sb.from("paneles").update({
          canvas_data: p.canvas_data,
          voiceover_url: p.voiceover_url
        }).eq("id", p.id)
      );
      await Promise.all(promises);
      await saveSceneAudioClips();
      updateSaveIndicatorState("saved");
    } catch (e) {
      console.error(e);
      updateSaveIndicatorState("unsaved");
      throw e;
    }
  }

  function updateSaveIndicatorState(state) {
    if (!saveIndicator) return;
    saveIndicator.className = "autosave-indicator " + state;
    if (state === "saving") {
      saveIndicatorText.textContent = "Sincronizando...";
    } else if (state === "saved") {
      saveIndicatorText.textContent = "Sincronizado";
    } else {
      saveIndicatorText.textContent = "Cambios sin guardar";
    }
  }

  // ── UTILIDADES ────────────────────────────────────────────
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Iniciar ejecución al cargar la página o estar listo
  document.addEventListener("DOMContentLoaded", init);
})();

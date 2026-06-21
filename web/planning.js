/**
 * Reiken Workspace — Controlador del Planificador de Episodios
 * planning.js
 */

(function () {
  const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

  // ── Leer parámetros de la URL ────────────
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project_id");
  const seasonId = params.get("season_id");

  if (!projectId || !seasonId) {
    alert("Parámetros del proyecto o temporada no especificados.");
    window.location.href = "index_projects.html";
    return;
  }

  // --- Elementos DOM ---
  const btnBack = document.getElementById("btnBack");
  const seasonTitleDisplay = document.getElementById("seasonTitleDisplay");
  const seasonDescDisplay = document.getElementById("seasonDescDisplay");
  const btnAddEpisode = document.getElementById("btnAddEpisode");
  const btnAddPlotline = document.getElementById("btnAddPlotline");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const importFileInput = document.getElementById("importFileInput");

  const gridHeaderRow = document.getElementById("gridHeaderRow");
  const gridBody = document.getElementById("gridBody");

  // Modales
  const cardModal = document.getElementById("cardModal");
  const cardTitleInput = document.getElementById("cardTitle");
  const cardSummaryInput = document.getElementById("cardSummary");
  const cardTensionInput = document.getElementById("cardTension");
  const characterSelectorGrid = document.getElementById("characterSelectorGrid");
  const btnSaveCard = document.getElementById("btnSaveCard");
  const btnCancelCard = document.getElementById("btnCancelCard");
  const btnDeleteCard = document.getElementById("btnDeleteCard");

  const episodeModal = document.getElementById("episodeModal");
  const episodeNumberInput = document.getElementById("episodeNumber");
  const episodeTitleInput = document.getElementById("episodeTitle");
  const btnSaveEpisode = document.getElementById("btnSaveEpisode");
  const btnCancelEpisode = document.getElementById("btnCancelEpisode");
  const btnDeleteEpisode = document.getElementById("btnDeleteEpisode");

  const plotlineModal = document.getElementById("plotlineModal");
  const plotlineNameInput = document.getElementById("plotlineName");
  const plotlineColorInput = document.getElementById("plotlineColor");
  const colorPalette = document.getElementById("colorPalette");
  const btnSavePlotline = document.getElementById("btnSavePlotline");
  const btnCancelPlotline = document.getElementById("btnCancelPlotline");
  const btnDeletePlotline = document.getElementById("btnDeletePlotline");

  // Variables de Estado
  let activePlan = null;
  let allCharacters = [];
  let currentEditingCard = null;
  let currentEditingEpisode = null;
  let currentEditingPlotline = null;
  let draggedCardId = null;

  // --- Hashing para color de personaje ---
  function getCharacterColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 45%)`;
  }

  // --- Mostrar Toast ---
  function showToast(msg, type = "success") {
    // Reutiliza Toast de Reiken o crea uno si no existe
    const container = document.body;
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.background = type === "success" ? "#db6f4e" : "#ff4d4d";
    toast.style.color = "white";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
    toast.style.zIndex = "9999";
    toast.style.fontFamily = "'Outfit', sans-serif";
    toast.style.fontWeight = "bold";
    toast.style.transition = "all 0.3s ease";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ── 1. INICIALIZAR Y CARGAR DATOS ────────────
  async function init() {
    // Volver
    btnBack.addEventListener("click", () => {
      window.location.href = `index_projects.html?id=${projectId}`;
    });

    // Cargar personajes de worldbuilding
    await loadWorldbuildingCharacters();

    // Cargar Planificación
    await loadPlan();

    // Configurar Eventos de Modales
    setupModalEvents();
  }

  async function loadWorldbuildingCharacters() {
    try {
      // Intenta de Supabase
      if (sb) {
        const { data: secs } = await sb.from("secciones").select("id").eq("proyecto_id", projectId).eq("tipo", "worldbuilding");
        if (secs && secs.length > 0) {
          const secIds = secs.map(s => s.id);
          const { data: concepts } = await sb.from("conceptos").select("id, titulo, tipo_concepto").in("seccion_id", secIds);
          if (concepts) {
            allCharacters = concepts;
            return;
          }
        }
      }
    } catch (e) {
      console.warn("No se pudo conectar a Supabase, intentando caché local para personajes...");
    }

    // Fallback a caché local de prefetch
    try {
      const raw = localStorage.getItem(`rk_prefetch_${projectId}`);
      if (raw) {
        const prefetch = JSON.parse(raw);
        allCharacters = prefetch.concepts || [];
      }
    } catch (e) {
      console.error("Fallo al leer personajes de prefetch", e);
    }
  }

  async function loadPlan() {
    activePlan = await window.RKPlanning.load(projectId);

    // Cargar datos de la temporada activa
    const currentSeason = activePlan.seasons.find(s => s.id === seasonId);
    if (!currentSeason) {
      // Si no existe la temporada cargada por algún error, redirigir
      showToast("Temporada no encontrada", "error");
      setTimeout(() => window.location.href = `index_projects.html?id=${projectId}`, 1000);
      return;
    }

    seasonTitleDisplay.textContent = currentSeason.nombre || "Sin título";
    seasonDescDisplay.textContent = currentSeason.descripcion || "";

    renderGrid();
  }

  // ── 2. RENDERIZAR LA REJILLA / GRID ───────────
  function renderGrid() {
    // Limpiar Grid
    gridHeaderRow.innerHTML = `<th class="corner-header">Tramas / Episodios</th>`;
    gridBody.innerHTML = "";

    // Filtrar episodios y tramas de la temporada actual
    const eps = (activePlan.episodes || [])
      .filter(e => e.season_id === seasonId)
      .sort((a, b) => (a.numero || 0) - (b.numero || 0));

    const plots = (activePlan.plotlines || [])
      .filter(p => p.season_id === seasonId)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // Renderizar cabeceras de episodios
    eps.forEach(ep => {
      const th = document.createElement("th");
      th.className = "episode-header";
      th.innerHTML = `
        Epi. ${ep.numero}
        <span class="episode-header-desc">${ep.titulo || "Sin Título"}</span>
      `;
      th.addEventListener("click", () => openEpisodeModal(ep));
      gridHeaderRow.appendChild(th);
    });

    // Renderizar filas de tramas
    plots.forEach(plot => {
      const row = document.createElement("tr");

      // Cabecera de trama (lado izquierdo)
      const th = document.createElement("th");
      th.className = "plotline-header";
      th.style.setProperty("--trama-color", plot.color || "#db6f4e");
      th.innerHTML = `
        <span class="plotline-title">${plot.nombre}</span>
        <span class="plotline-meta">Haz clic para editar</span>
      `;
      th.addEventListener("click", () => openPlotlineModal(plot));
      row.appendChild(th);

      // Celdas de episodios para esta trama
      eps.forEach(ep => {
        const cell = document.createElement("td");
        cell.className = "grid-cell";
        cell.dataset.plotlineId = plot.id;
        cell.dataset.episodeId = ep.id;

        // Configurar Eventos Drag and Drop en celda
        cell.addEventListener("dragover", dragOver);
        cell.addEventListener("dragenter", dragEnter);
        cell.addEventListener("dragleave", dragLeave);
        cell.addEventListener("drop", dragDrop);

        // Doble clic para crear tarjeta en celda vacía
        cell.addEventListener("dblclick", (e) => {
          if (e.target === cell) {
            openCardModal(null, plot.id, ep.id);
          }
        });

        // Filtrar tarjetas en esta celda
        const cellCards = (activePlan.cards || []).filter(c => c.plotline_id === plot.id && c.episode_id === ep.id);
        cellCards.forEach(card => {
          const cardEl = renderCard(card, plot.color);
          cell.appendChild(cardEl);
        });

        row.appendChild(cell);
      });

      gridBody.appendChild(row);
    });
  }

  // Renders a single Plot Card element
  function renderCard(card, color) {
    const cardEl = document.createElement("div");
    cardEl.className = "plot-card";
    cardEl.draggable = true;
    cardEl.dataset.id = card.id;
    cardEl.style.setProperty("--card-color", color || "#db6f4e");

    // Tension Dots
    let tensionDotsHTML = "";
    const maxTension = 5;
    for (let i = 1; i <= maxTension; i++) {
      tensionDotsHTML += `<span class="tension-dot-visual ${i <= (card.tension || 1) ? 'active' : ''}"></span>`;
    }

    // Personajes vinculados
    let charactersHTML = "";
    let linked = [];
    if (typeof card.personajes === "string") {
      try { linked = JSON.parse(card.personajes); } catch (e) { linked = []; }
    } else if (Array.isArray(card.personajes)) {
      linked = card.personajes;
    }

    linked.forEach(charId => {
      const concept = allCharacters.find(c => c.id === charId);
      if (concept) {
        const initials = concept.titulo.substring(0, 2);
        const charColor = getCharacterColor(concept.titulo);
        charactersHTML += `<span class="char-bubble" style="--char-bg: ${charColor}" title="${concept.titulo}">${initials}</span>`;
      }
    });

    cardEl.innerHTML = `
      <h4 class="plot-card-title">${card.titulo || "Sin Título"}</h4>
      <p class="plot-card-summary">${card.resumen || ""}</p>
      <div class="plot-card-footer">
        <div class="tension-indicator" title="Tensión Dramática: ${card.tension}/5">
          ${tensionDotsHTML}
        </div>
        <div class="card-characters">
          ${charactersHTML}
        </div>
      </div>
    `;

    // Abrir Modal de Edición al hacer clic
    cardEl.addEventListener("click", (e) => {
      e.stopPropagation();
      openCardModal(card);
    });

    // Drag events
    cardEl.addEventListener("dragstart", dragStart);
    cardEl.addEventListener("dragend", dragEnd);

    return cardEl;
  }

  // ── 3. DRAG AND DROP NATIVO ───────────────────
  function dragStart(e) {
    draggedCardId = this.dataset.id;
    this.style.opacity = "0.5";
  }

  function dragEnd(e) {
    this.style.opacity = "1";
    document.querySelectorAll(".grid-cell").forEach(cell => cell.classList.remove("drag-over"));
  }

  function dragOver(e) {
    e.preventDefault();
  }

  function dragEnter(e) {
    e.preventDefault();
    this.classList.add("drag-over");
  }

  function dragLeave() {
    this.classList.remove("drag-over");
  }

  async function dragDrop(e) {
    this.classList.remove("drag-over");
    if (!draggedCardId) return;

    const plotlineId = this.dataset.plotlineId;
    const episodeId = this.dataset.episodeId;

    // Buscar tarjeta
    const card = activePlan.cards.find(c => c.id === draggedCardId);
    if (card) {
      card.plotline_id = plotlineId;
      card.episode_id = episodeId;

      try {
        await window.RKPlanning.saveCard(projectId, card);
        renderGrid();
      } catch (err) {
        showToast("Error al mover tarjeta: " + err.message, "error");
      }
    }
  }

  // ── 4. CONTROLADORES DE MODALES ────────────────
  function openCardModal(card = null, plotlineId = null, episodeId = null) {
    if (card) {
      currentEditingCard = card;
      cardTitleInput.value = card.titulo || "";
      cardSummaryInput.value = card.resumen || "";
      cardTensionInput.value = card.tension || 1;
      window.ANIM.show(btnDeleteCard, 'anim-fade-in');
    } else {
      currentEditingCard = {
        plotline_id: plotlineId,
        episode_id: episodeId,
        titulo: "",
        resumen: "",
        tension: 1,
        personajes: []
      };
      cardTitleInput.value = "";
      cardSummaryInput.value = "";
      cardTensionInput.value = 1;
      window.ANIM.hide(btnDeleteCard, 'anim-fade-out');
    }

    // Dibujar selector de tensión
    updateTensionSelectorVisuals(cardTensionInput.value);

    // Dibujar lista de personajes vinculables
    renderCharacterSelectorList(currentEditingCard.personajes);

    window.ANIM.show(cardModal, 'anim-modal-in');
  }

  function updateTensionSelectorVisuals(val) {
    document.querySelectorAll(".tension-dot").forEach(btn => {
      const num = parseInt(btn.dataset.val);
      if (num <= parseInt(val)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function renderCharacterSelectorList(linkedIds = []) {
    characterSelectorGrid.innerHTML = "";
    
    // Normalizar a array de strings
    let ids = [];
    if (typeof linkedIds === "string") {
      try { ids = JSON.parse(linkedIds); } catch (e) { ids = []; }
    } else if (Array.isArray(linkedIds)) {
      ids = linkedIds;
    }

    if (allCharacters.length === 0) {
      characterSelectorGrid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:rgba(255,255,255,0.3); font-size:0.8rem; margin:10px 0;">No se encontraron personajes en el Worldbuilding.</p>`;
      return;
    }

    allCharacters.forEach(char => {
      const isChecked = ids.includes(char.id);
      const initials = char.titulo.substring(0, 2);
      const charColor = getCharacterColor(char.titulo);

      const item = document.createElement("label");
      item.className = "char-select-item";
      item.innerHTML = `
        <input type="checkbox" value="${char.id}" ${isChecked ? 'checked' : ''}>
        <span class="char-select-avatar" style="--char-color: ${charColor}">${initials}</span>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${char.titulo}</span>
      `;
      characterSelectorGrid.appendChild(item);
    });
  }

  // Modal Episodio
  function openEpisodeModal(ep = null) {
    if (ep) {
      currentEditingEpisode = ep;
      episodeNumberInput.value = ep.numero;
      episodeTitleInput.value = ep.titulo || "";
      window.ANIM.show(btnDeleteEpisode, 'anim-fade-in');
    } else {
      // Auto-calcular siguiente número de episodio
      const currentEps = activePlan.episodes.filter(e => e.season_id === seasonId);
      const nextNum = currentEps.length > 0 ? Math.max(...currentEps.map(e => e.numero || 0)) + 1 : 1;
      
      currentEditingEpisode = {
        season_id: seasonId,
        numero: nextNum,
        titulo: ""
      };
      episodeNumberInput.value = nextNum;
      episodeTitleInput.value = "";
      window.ANIM.hide(btnDeleteEpisode, 'anim-fade-out');
    }
    window.ANIM.show(episodeModal, 'anim-modal-in');
  }

  // Modal Trama
  function openPlotlineModal(plot = null) {
    if (plot) {
      currentEditingPlotline = plot;
      plotlineNameInput.value = plot.nombre;
      plotlineColorInput.value = plot.color || "#db6f4e";
      window.ANIM.show(btnDeletePlotline, 'anim-fade-in');
    } else {
      currentEditingPlotline = {
        season_id: seasonId,
        nombre: "",
        color: "#db6f4e"
      };
      plotlineNameInput.value = "";
      plotlineColorInput.value = "#db6f4e";
      window.ANIM.hide(btnDeletePlotline, 'anim-fade-out');
    }

    // Marcar color swatch activo
    document.querySelectorAll(".color-swatch").forEach(btn => {
      if (btn.dataset.color === plotlineColorInput.value) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    window.ANIM.show(plotlineModal, 'anim-modal-in');
  }

  // ── 5. CONFIGURACIÓN DE EVENTOS EN MODALES ─────
  function setupModalEvents() {
    // --- Eventos Tensión ---
    document.querySelectorAll(".tension-dot").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.val;
        cardTensionInput.value = val;
        updateTensionSelectorVisuals(val);
      });
    });

    // --- Tarjeta: Salvar ---
    btnSaveCard.addEventListener("click", async () => {
      const title = cardTitleInput.value.trim();
      if (!title) {
        showToast("El título es obligatorio", "error");
        return;
      }

      // Obtener personajes seleccionados
      const checkedChars = [];
      characterSelectorGrid.querySelectorAll("input[type='checkbox']:checked").forEach(cb => {
        checkedChars.push(cb.value);
      });

      currentEditingCard.titulo = title;
      currentEditingCard.resumen = cardSummaryInput.value.trim();
      currentEditingCard.tension = parseInt(cardTensionInput.value);
      currentEditingCard.personajes = checkedChars;

      btnSaveCard.disabled = true;
      try {
        await window.RKPlanning.saveCard(projectId, currentEditingCard);
        showToast("Tarjeta guardada correctamente ✨");
        window.ANIM.hide(cardModal, 'anim-modal-out');
        await loadPlan();
      } catch (e) {
        showToast("Fallo al guardar tarjeta: " + e.message, "error");
      } finally {
        btnSaveCard.disabled = false;
      }
    });

    // Tarjeta: Cancelar y Cerrar
    const closeCard = () => window.ANIM.hide(cardModal, 'anim-modal-out');
    btnCancelCard.addEventListener("click", closeCard);
    document.getElementById("closeCardModal").addEventListener("click", closeCard);

    // Tarjeta: Borrar
    btnDeleteCard.addEventListener("click", async () => {
      if (!currentEditingCard?.id) return;
      if (!confirm("¿Deseas eliminar esta tarjeta?")) return;

      btnDeleteCard.disabled = true;
      try {
        await window.RKPlanning.deleteCard(projectId, currentEditingCard.id);
        showToast("Tarjeta eliminada.");
        closeCard();
        await loadPlan();
      } catch (e) {
        showToast("Error al borrar tarjeta", "error");
      } finally {
        btnDeleteCard.disabled = false;
      }
    });

    // --- Episodio: Salvar ---
    btnSaveEpisode.addEventListener("click", async () => {
      const num = parseInt(episodeNumberInput.value);
      const title = episodeTitleInput.value.trim();

      if (isNaN(num)) {
        showToast("El número de episodio debe ser un valor válido", "error");
        return;
      }

      currentEditingEpisode.numero = num;
      currentEditingEpisode.titulo = title;

      btnSaveEpisode.disabled = true;
      try {
        await window.RKPlanning.saveEpisode(projectId, currentEditingEpisode);
        showToast("Episodio guardado correctamente ✨");
        window.ANIM.hide(episodeModal, 'anim-modal-out');
        await loadPlan();
      } catch (e) {
        showToast("Fallo al guardar episodio", "error");
      } finally {
        btnSaveEpisode.disabled = false;
      }
    });

    // Episodio: Cancelar y Cerrar
    const closeEp = () => window.ANIM.hide(episodeModal, 'anim-modal-out');
    btnCancelEpisode.addEventListener("click", closeEp);
    document.getElementById("closeEpisodeModal").addEventListener("click", closeEp);

    // Episodio: Borrar
    btnDeleteEpisode.addEventListener("click", async () => {
      if (!currentEditingEpisode?.id) return;
      if (!confirm("¿Deseas eliminar este episodio y todas sus tarjetas asociadas?")) return;

      btnDeleteEpisode.disabled = true;
      try {
        await window.RKPlanning.deleteEpisode(projectId, currentEditingEpisode.id);
        showToast("Episodio eliminado.");
        closeEp();
        await loadPlan();
      } catch (e) {
        showToast("Error al borrar episodio", "error");
      } finally {
        btnDeleteEpisode.disabled = false;
      }
    });

    // --- Trama: Salvar ---
    btnSavePlotline.addEventListener("click", async () => {
      const name = plotlineNameInput.value.trim();
      if (!name) {
        showToast("El nombre de la trama es obligatorio", "error");
        return;
      }

      currentEditingPlotline.nombre = name;
      currentEditingPlotline.color = plotlineColorInput.value;

      btnSavePlotline.disabled = true;
      try {
        await window.RKPlanning.savePlotline(projectId, currentEditingPlotline);
        showToast("Trama guardada correctamente ✨");
        window.ANIM.hide(plotlineModal, 'anim-modal-out');
        await loadPlan();
      } catch (e) {
        showToast("Fallo al guardar trama", "error");
      } finally {
        btnSavePlotline.disabled = false;
      }
    });

    // Trama: Cancelar y Cerrar
    const closePlot = () => window.ANIM.hide(plotlineModal, 'anim-modal-out');
    btnCancelPlotline.addEventListener("click", closePlot);
    document.getElementById("closePlotlineModal").addEventListener("click", closePlot);

    // Trama: Borrar
    btnDeletePlotline.addEventListener("click", async () => {
      if (!currentEditingPlotline?.id) return;
      if (!confirm("¿Deseas eliminar esta trama y todas sus tarjetas asociadas?")) return;

      btnDeletePlotline.disabled = true;
      try {
        await window.RKPlanning.deletePlotline(projectId, currentEditingPlotline.id);
        showToast("Trama eliminada.");
        closePlot();
        await loadPlan();
      } catch (e) {
        showToast("Error al borrar trama", "error");
      } finally {
        btnDeletePlotline.disabled = false;
      }
    });

    // Trama: Selector de Color Swatches
    document.querySelectorAll(".color-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        plotlineColorInput.value = btn.dataset.color;
      });
    });

    // --- Botones de Cabecera para Añadir ---
    btnAddEpisode.addEventListener("click", () => openEpisodeModal());
    btnAddPlotline.addEventListener("click", () => openPlotlineModal());

    // --- Exportación / Importación ---
    btnExport.addEventListener("click", exportPlanning);
    btnImport.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importPlanning);
  }

  // ── 6. EXPORTAR / IMPORTAR COMPLETO ───────────
  function exportPlanning() {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activePlan, null, 2));
      const downloadAnchor = document.createElement("a");
      const name = (seasonTitleDisplay.textContent || "planificacion").toLowerCase().replace(/\s+/g, "_");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `planning_${name}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Planificación exportada con éxito 📤");
    } catch (e) {
      showToast("Error al exportar planificación", "error");
    }
  }

  function importPlanning(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!importedData.seasons || !importedData.plotlines || !importedData.episodes || !importedData.cards) {
          throw new Error("Formato de JSON inválido");
        }

        // Sobrescribir en base de datos híbrida
        await window.RKPlanning.importFullPlan(projectId, importedData);
        showToast("Planificación importada con éxito 📥");
        await loadPlan();
      } catch (err) {
        showToast("Error al importar: archivo inválido", "error");
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = "";
  }

  // --- Arrancar ---
  document.addEventListener("DOMContentLoaded", init);
})();

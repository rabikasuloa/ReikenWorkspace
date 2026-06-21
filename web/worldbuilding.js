// ══════════════════════════════════════════
//  WORLDBUILDING — worldbuilding.js
//  Reiken Studios · 2025
// ══════════════════════════════════════════
(function () {
  console.log("🚀 Reiken Worldbuilding: Automation DISABLED (v2.1)");
  if (!document.getElementById('wbMain')) return;

  const sb = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project_id');
  const worldId = params.get('world_id');
  if (!projectId) { window.location.href = 'projects.html'; return; }

  // ── STATE ─────────────────────────────────
  let currentUser = null;
  let worldData = null;
  let seccionWBId = null;
  let conceptosCache = [];
  let plantillasMap = {};
  let currentConcepto = null;
  let currentContentId = null;
  let blocksData = [];
  let blocksSaveTimer = null;
  let newConceptIconDataURL = null;
  let cdIconDataURL = null;
  let currentSettingsBlock = null;
  let globalBlocksCache = {}; // conceptId -> [bloques]
  let globalRelationsCache = { from: {}, to: {} }; // conceptId -> [relaciones]

  // Mention state
  let mentionActive = false;
  let mentionRange = null;
  let mentionQuery = '';
  let mentionHighIdx = 0;
  let mentionTargetEl = null;

  // Map state
  let mapImage = null;   // { url: dataURL, w, h }
  let mapScale = 1;
  let mapPan = { x: 0, y: 0 };
  let mapRegions = [];     // [{ id, name, color, desc, opacity, points, locations:[] }]
  let mapTool = 'select'; // select | region | location
  let polygonPoints = [];
  let isDrawingPoly = false;
  let selectedShapeId = null;  // currently highlighted region/location id
  let drawingParentId = null;  // region id when drawing a location
  let mapDirty = false;
  let mapPanning = false;
  let panStart = null;
  let panOrigin = null;
  let _mapW = 2000, _mapH = 1400; // canvas internal resolution
  let selectedRegionIcon = '⬡';
  let selectedLocationIcon = '📍';
  let mapLabelScale = 1.0;
  let mapLabelMode = 'both';
  let mapShowRaces = false;
  let mapRacesCache = null;
  let activeRelationSource = null;
  let activeRelationLines = [];
  let mapDrawingCtx = null;
  let mapUpdatePending = false;
  let mapPinCache = {}; // shapeId -> { el, status }
  let globalLocationBlocksCache = []; // Fetched once for related concepts
  let tempLandscapes = [];

  // Dragging state
  let isDraggingShape = false;
  let draggedShape = null;
  let draggedShapeType = null;
  let draggedShapeParent = null;
  let dragStartPos = null;
  let initialPoints = [];
  let initialChildrenPoints = []; // [{ id, points: [] }]
  let dragMoved = false;
  let dragCurrentOffset = { x: 0, y: 0 };
  const DRAG_THRESHOLD = 3;

  // Slash command state (New Concept link)
  let ncSlashActive = false;
  let ncSlashQuery = "";
  let ncSlashHighIdx = 0;
  let _pendingSlashLink = null; // { type: 'region'|'location', id: string }

  // Edit Concept state
  let currentEditingConcept = null;
  let editConceptIconDataURL = null;

  // Relationship state
  let relationsCache = [];
  let relSelectedTarget = null;
  let relSelectedType = null;
  let editingRelationId = null;

  // ── Category-specific relation types ────────
  const RELATION_TYPES_BY_CATEGORY = {
    'Personaje': {
      'amigos':      { emoji: '😊', label: 'Amigos',      color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'enemigos':    { emoji: '⚔️', label: 'Enemigos',    color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'enamorados':  { emoji: '❤️', label: 'Enamorados',  color: '#e91e63', bg: 'rgba(233,30,99,0.15)' },
      'rivales':     { emoji: '🌀', label: 'Rivales',      color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'familia':     { emoji: '👨‍👩‍👧', label: 'Familia',  color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
      'mentor':      { emoji: '🎓', label: 'Mentor de',    color: '#00bcd4', bg: 'rgba(0,188,212,0.15)' },
      'aprendiz':    { emoji: '📖', label: 'Aprendiz de',  color: '#8bc34a', bg: 'rgba(139,195,74,0.15)' },
      'subordinado': { emoji: '📋', label: 'Subordinado',  color: '#607d8b', bg: 'rgba(96,125,139,0.15)' },
      'lider':       { emoji: '👑', label: 'Líder de',     color: '#f39c12', bg: 'rgba(243,156,18,0.15)' },
      'neutral':     { emoji: '😐', label: 'Neutral',      color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'traidor':     { emoji: '🗡️', label: 'Traidor de',  color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
      'protector':   { emoji: '🛡️', label: 'Protector de', color: '#2980b9', bg: 'rgba(41,128,185,0.15)' },
    },
    'Raza': {
      'aliados':       { emoji: '🤝', label: 'Aliados',       color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'enemigos':      { emoji: '⚔️', label: 'Enemigos',     color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'neutrales':     { emoji: '😐', label: 'Neutrales',     color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'rivales':       { emoji: '🌀', label: 'Rivales',       color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'dependientes':  { emoji: '🔗', label: 'Dependientes',  color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'dominantes':    { emoji: '👑', label: 'Dominantes',    color: '#f39c12', bg: 'rgba(243,156,18,0.15)' },
      'comerciantes':  { emoji: '💰', label: 'Comerciantes',  color: '#e67e22', bg: 'rgba(230,126,34,0.15)' },
      'vasallaje':     { emoji: '⛓️', label: 'Vasallaje',    color: '#7f8c8d', bg: 'rgba(127,140,141,0.15)' },
      'guerra':        { emoji: '💀', label: 'Guerra activa', color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
      'tregua':        { emoji: '🕊️', label: 'Tregua',      color: '#1abc9c', bg: 'rgba(26,188,156,0.15)' },
      'protectores':   { emoji: '🛡️', label: 'Protectores',  color: '#2980b9', bg: 'rgba(41,128,185,0.15)' },
      'simbiosis':     { emoji: '🧬', label: 'Simbiosis',     color: '#16a085', bg: 'rgba(22,160,133,0.15)' },
    },
    'Criatura': {
      'presa':        { emoji: '🎯', label: 'Presa de',       color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'depredador':   { emoji: '🦁', label: 'Depredador de',  color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
      'simbiosis':    { emoji: '🧬', label: 'Simbiosis',      color: '#16a085', bg: 'rgba(22,160,133,0.15)' },
      'neutral':      { emoji: '😐', label: 'Neutral',        color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'domesticado':  { emoji: '🐕', label: 'Domesticado por', color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'rival':        { emoji: '🌀', label: 'Rival',          color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'companero':    { emoji: '🤝', label: 'Compañero',      color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'parasito':     { emoji: '🦠', label: 'Parásito de',    color: '#795548', bg: 'rgba(121,85,72,0.15)' },
    },
    'Locación': {
      'conectada':   { emoji: '🔗', label: 'Conectada a',          color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'contenida':   { emoji: '📦', label: 'Dentro de',            color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'enemiga':     { emoji: '⚔️', label: 'Territorio enemigo',  color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'aliada':      { emoji: '🤝', label: 'Territorio aliado',    color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'comercio':    { emoji: '💰', label: 'Ruta comercial',       color: '#e67e22', bg: 'rgba(230,126,34,0.15)' },
      'neutral':     { emoji: '😐', label: 'Neutral',              color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'disputada':   { emoji: '🏴', label: 'Disputada',            color: '#c0392b', bg: 'rgba(192,57,43,0.15)' },
    },
    'Objeto': {
      'creado_por':    { emoji: '🔨', label: 'Creado por',     color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
      'usado_por':     { emoji: '🤲', label: 'Usado por',      color: '#2196f3', bg: 'rgba(33,150,243,0.15)' },
      'destruido_por': { emoji: '💥', label: 'Destruido por',  color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'componente':    { emoji: '🧩', label: 'Componente de',  color: '#9c27b0', bg: 'rgba(156,39,176,0.15)' },
      'custodiado':    { emoji: '🛡️', label: 'Custodiado por', color: '#2980b9', bg: 'rgba(41,128,185,0.15)' },
      'potencia':      { emoji: '⚡', label: 'Potencia a',     color: '#f39c12', bg: 'rgba(243,156,18,0.15)' },
    },
    'Sistema': {
      'gobierna':     { emoji: '⚖️', label: 'Gobierna',       color: '#f39c12', bg: 'rgba(243,156,18,0.15)' },
      'opone':        { emoji: '🔥', label: 'Se opone a',      color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'complementa':  { emoji: '🧬', label: 'Complementa',    color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'derivado':     { emoji: '📐', label: 'Derivado de',     color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'neutral':      { emoji: '😐', label: 'Neutral',         color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'regula':       { emoji: '📜', label: 'Regula a',        color: '#607d8b', bg: 'rgba(96,125,139,0.15)' },
    },
    'Organización': {
      'aliada':     { emoji: '🤝', label: 'Aliada',         color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'enemiga':    { emoji: '⚔️', label: 'Enemiga',        color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'neutral':    { emoji: '😐', label: 'Neutral',         color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'subsidiaria':{ emoji: '📋', label: 'Subsidiaria de',  color: '#607d8b', bg: 'rgba(96,125,139,0.15)' },
      'rival':      { emoji: '🌀', label: 'Rival',           color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'financiada': { emoji: '💰', label: 'Financiada por',  color: '#e67e22', bg: 'rgba(230,126,34,0.15)' },
      'infiltrada': { emoji: '🕵️', label: 'Infiltrada en',  color: '#795548', bg: 'rgba(121,85,72,0.15)' },
    },
    'Evento': {
      'causa':       { emoji: '💥', label: 'Causa de',       color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'consecuencia':{ emoji: '📈', label: 'Consecuencia de', color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'simultaneo':  { emoji: '⏱️', label: 'Simultáneo a',   color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
      'precede':     { emoji: '⬅️', label: 'Precede a',      color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'sucede':      { emoji: '➡️', label: 'Sucede a',       color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'neutral':     { emoji: '😐', label: 'Sin relación',    color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
    },
    '_default': {
      'relacionado': { emoji: '🔗', label: 'Relacionado',  color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
      'opuesto':     { emoji: '⚡', label: 'Opuesto',       color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
      'parte_de':    { emoji: '🧩', label: 'Parte de',      color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
      'neutral':     { emoji: '😐', label: 'Neutral',       color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' },
      'aliado':      { emoji: '🤝', label: 'Aliado',        color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
      'enemigo':     { emoji: '⚔️', label: 'Enemigo',      color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
    }
  };

  // Unified fallback: merge all types into a single flat map for map rendering
  const RELATION_TYPES = {};
  Object.values(RELATION_TYPES_BY_CATEGORY).forEach(cat => {
    Object.entries(cat).forEach(([k, v]) => { if (!RELATION_TYPES[k]) RELATION_TYPES[k] = v; });
  });

  // Inverse relations rules for bidirectional automation
  const INVERSE_RELATIONS = {
    'amigos': 'amigos',
    'enemigos': 'enemigos',
    'enamorados': 'enamorados',
    'rivales': 'rivales',
    'mentor': 'aprendiz',
    'aprendiz': 'mentor',
    'aliados': 'aliados',
    'conectada': 'conectada',
    'contenida': 'contiene', // Needs to be added to Locación
    'contiene': 'contenida',
    'creado_por': 'creo_a',
    'usado_por': 'usado_en',
    'lider': 'subordinado',
    'subordinado': 'lider'
  };

  function getRelationTypesForConcept(concepto) {
    const cat = concepto?.plantillas_concepto?.nombre;
    return RELATION_TYPES_BY_CATEGORY[cat] || RELATION_TYPES_BY_CATEGORY['_default'];
  }

  // Edit State
  let isEditingShape = false;
  let editingShapeRef = null;
  let editingShapeType = null;

  // ── MACRO-CATEGORIES ──────────────────────
  // Each macro-category groups related concept types as children
  let currentMacroHub = null; // Currently displayed macro in the hub

  const MACRO_CATEGORIES = [
    {
      id: 'razas', label: 'Razas', icon: '👥',
      color: 'rgba(90,143,212,0.35)',
      heroGradient: 'linear-gradient(135deg, #1a2a4a, #2d4a7a, #1a0c2e)',
      description: 'Explora todas las razas del universo, su cultura, comercio, poderes y relaciones.',
      children: ['Raza', 'Personaje', 'Criatura']
    },
    {
      id: 'regiones', label: 'Regiones', icon: '🏔️',
      color: 'rgba(196,135,58,0.35)',
      heroGradient: 'linear-gradient(135deg, #3a2510, #5a3a1a, #1a0c2e)',
      description: 'Descubre las regiones, locaciones y la geografía de tu mundo.',
      children: ['Locación']
    },
    {
      id: 'sistemas', label: 'Sistemas Universales', icon: '⚙️',
      color: 'rgba(74,155,111,0.35)',
      heroGradient: 'linear-gradient(135deg, #0a2a1a, #1a4a2a, #1a0c2e)',
      description: 'Los sistemas, poderes, objetos y reglas que rigen tu universo.',
      children: ['Sistema', 'Poder', 'Objeto', 'Organización', 'Cultura', 'Evento', 'Historia']
    },
    {
      id: 'freezer', label: 'Freezer', icon: '❄️',
      color: 'rgba(100,180,220,0.35)',
      heroGradient: 'linear-gradient(135deg, #0a1a2a, #1a3a5a, #0a2a3a)',
      description: 'Conceptos en espera, ideas en desarrollo y contenido archivado.',
      children: ['Freezer']
    }
  ];

  // Flat list of all concept type keys (for backwards compat)
  const ALL_CONCEPT_TYPES = MACRO_CATEGORIES.flatMap(mc => mc.children);

  // Legacy MAIN_TYPES for backwards compat with grid / badge rendering
  const MAIN_TYPES = [
    { key: 'Raza', label: 'Razas', icon: '👥', color: 'rgba(90,143,212,0.35)' },
    { key: 'Personaje', label: 'Personajes', icon: '🧍', color: 'rgba(200,80,80,0.35)' },
    { key: 'Criatura', label: 'Criaturas', icon: '🐉', color: 'rgba(123,94,167,0.35)' },
    { key: 'Locación', label: 'Locaciones', icon: '🏔️', color: 'rgba(196,135,58,0.35)' },
    { key: 'Sistema', label: 'Sistemas', icon: '⚙️', color: 'rgba(74,155,111,0.35)' },
    { key: 'Poder', label: 'Poderes', icon: '✨', color: 'rgba(255,193,7,0.35)' },
    { key: 'Objeto', label: 'Objetos', icon: '🗡️', color: 'rgba(150,120,60,0.35)' },
    { key: 'Organización', label: 'Organizaciones', icon: '🏛️', color: 'rgba(155,89,182,0.35)' },
    { key: 'Cultura', label: 'Culturas', icon: '🎭', color: 'rgba(233,30,99,0.35)' },
    { key: 'Evento', label: 'Eventos', icon: '📜', color: 'rgba(255,152,0,0.35)' },
    { key: 'Historia', label: 'Historias', icon: '📖', color: 'rgba(121,85,72,0.35)' },
    { key: 'Freezer', label: 'Freezer', icon: '❄️', color: 'rgba(100,180,220,0.35)' },
  ];

  // ── INIT ──────────────────────────────────
  async function init() {
    window.RKCrop.init();
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user;
    if (!user) { window.location.href = 'login.html'; return; }
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

    await Promise.all([loadProject(), loadUserProfile(), loadPlantillas()]);
    await loadSecciones();
    window.__initShortcuts?.(projectId, goWbShortcut);
    await loadConceptos();
    await loadMapData();
    warmConceptCache(); // Start pre-loading in background
    prefetchLocationBlocks(); // Pre-fetch shape relationships
    setupTabs();
    setupSidebar();
    setupConceptDetail();
    setupMapTab();
    setupSearch();
    setupModals();
    await loadMapData();
    showToast('🌍 WorldBuilding cargado');
  }

  function goWbShortcut(sc) {
    if (!sc?.type) return;
    if (sc.type === 'escena' && sc.targetId) {
      window.location.href = 'escena.html?id=' + sc.targetId;
    } else if (sc.type === 'concepto' && sc.targetId) {
      window.location.href = 'worldbuilding.html?project_id=' + projectId + '&world_id=' + sc.targetId;
    } else if (sc.type === 'section') {
      window.location.href = 'index_projects.html?id=' + projectId;
    }
  }

  async function loadProject() {
    const { data: p } = await sb.from('proyectos').select('*').eq('id', projectId).single();
    if (!p) { window.location.href = 'projects.html'; return; }
    document.title = `WorldBuilding · ${p.nombre} - Reiken`;
    if (worldId) {
      const { data: w } = await sb.from('conceptos').select('*, plantillas_concepto(nombre)').eq('id', worldId).single();
      worldData = w;
    }
    const wName = worldData?.titulo || p.nombre;
    document.getElementById('wbWorldName').textContent = wName;
    document.getElementById('wbHubTitle').textContent = wName;
    if (worldData?.icono_url) {
      const iconEl = document.getElementById('wbWorldIcon');
      iconEl.innerHTML = `<img src="${worldData.icono_url}" alt="icon">`;
    }
    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = `index_projects.html?id=${projectId}`;
    });
  }

  async function loadUserProfile() {
    await window.RKCore.loadGlobalProfile();
  }

  async function loadPlantillas() {
    const cached = window.RKCache.get("global_templates");
    let plts = cached || [];

    if (!plts.length) {
      const { data } = await sb.from('plantillas_concepto').select('*').order('nombre');
      plts = data || [];
      const defaultPlts = ['Raza', 'Criatura', 'Sistema', 'Locación', 'Personaje', 'Objeto', 'Organización', 'Evento', 'Poder', 'Cultura', 'Historia', 'Freezer', 'World'];
      const existing = new Set(plts.map(p => p.nombre));
      const toInsert = defaultPlts.filter(n => !existing.has(n)).map(n => ({ nombre: n, tipo: n.toLowerCase(), es_default: true }));
      if (toInsert.length) {
        const { data: ins } = await sb.from('plantillas_concepto').insert(toInsert).select();
        plts = [...plts, ...(ins || [])];
      }
      if (plts.length) window.RKCache.save("global_templates", plts, 60);
    }
    
    plantillasMap = {};
    plts.forEach(p => { plantillasMap[p.nombre] = p.id; });
  }

  async function loadSecciones() {
    const pref = window.RKCache.get(`prefetch_p_${projectId}`);
    if (pref?.sections) {
      const wb = pref.sections.find(s => s.tipo === 'worldbuilding');
      if (wb) { seccionWBId = wb.id; return; }
    }

    const { data: secciones } = await sb.from('secciones').select('*').eq('proyecto_id', projectId);
    const wb = secciones?.find(s => s.tipo === 'worldbuilding');
    if (!wb) {
      const { data } = await sb.from('secciones').insert({ proyecto_id: projectId, tipo: 'worldbuilding' }).select().single();
      seccionWBId = data?.id;
    } else { seccionWBId = wb.id; }
  }

  async function loadConceptos() {
    if (!seccionWBId) return;
    const pref = window.RKCache.get(`prefetch_p_${projectId}`);
    
    if (pref?.concepts?.length > 0) {
      console.log("⚡ Concepts from cache");
      conceptosCache = pref.concepts;
    } else {
      const { data } = await sb.from('conceptos')
        .select('*, plantillas_concepto(nombre)')
        .eq('seccion_id', seccionWBId)
        .order('orden', { ascending: true });
      conceptosCache = data || [];
    }
    
    renderHub();
    renderTypesGrid();
    renderConceptTree();
  }

  async function warmConceptCache() {
    if (!seccionWBId || !conceptosCache.length) return;

    // Check Deep Cache first
    const deepBlocks = window.RKCache.get(`deep_blocks_${projectId}`);
    const deepRels = window.RKCache.get(`deep_rels_${projectId}`);
    
    if (deepBlocks) {
      console.log("💎 Blocks from Deep Cache");
      Object.assign(globalBlocksCache, deepBlocks);
    }
    
    if (deepRels) {
      console.log("💎 Relations from Deep Cache");
      Object.assign(globalRelationsCache, deepRels);
    }

    if (deepBlocks && deepRels) {
      console.log("✅ All deep cache loaded. Skipping warmup query.");
      return;
    }

    const conceptIds = conceptosCache.map(c => c.id);
    try {
      if (!deepBlocks) {
        const { data: contents } = await sb.from('contenidos').select('id, titulo').in('titulo', conceptIds).eq('tipo_plantilla', 'wb_concepto');
        if (contents?.length) {
          const contentIds = contents.map(c => c.id);
          const contentToConcept = {};
          contents.forEach(c => { contentToConcept[c.id] = c.titulo; });
          const { data: bqs } = await sb.from('bloques').select('*').in('contenido_id', contentIds).order('orden', { ascending: true });
          if (bqs) {
            bqs.forEach(b => {
              const conceptId = contentToConcept[b.contenido_id];
              if (!globalBlocksCache[conceptId]) globalBlocksCache[conceptId] = [];
              globalBlocksCache[conceptId].push(b);
            });
          }
        }
      }

      if (!deepRels) {
        const { data: rels } = await sb.from('concepto_relaciones').select('*').eq('mundo_id', worldId);
        if (rels) {
          rels.forEach(rel => {
            if (!globalRelationsCache.from[rel.concepto_origen_id]) globalRelationsCache.from[rel.concepto_origen_id] = [];
            globalRelationsCache.from[rel.concepto_origen_id].push(rel);
            if (!globalRelationsCache.to[rel.concepto_destino_id]) globalRelationsCache.to[rel.concepto_destino_id] = [];
            globalRelationsCache.to[rel.concepto_destino_id].push(rel);
          });
        }
      }

      console.log('🚀 Worldbuilding cache warmed:', {
        blocks: Object.keys(globalBlocksCache).length,
        rels: (Object.keys(globalRelationsCache.from).length + Object.keys(globalRelationsCache.to).length)
      });
    } catch (e) {
      console.error('❌ Error warming concept cache:', e);
    }
  }

  // ── TABS ─────────────────────────────────
  function playSwoosh() { window.RKSound?.playSwoosh(); }

  function playConceptClickSound() { window.RKSound?.play('clickconcept'); }

  function playSidebarHoverSound() { window.RKSound?.play('hover'); }

  function setupTabs() {
    document.querySelectorAll('.wb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        playSwoosh();
        document.querySelectorAll('.wb-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.wb-tab-content').forEach(c => window.ANIM.hide(c, 'anim-fade-out'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        window.ANIM.show(document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)), 'anim-fade-in');
        if (tab === 'mapa') { setTimeout(() => { renderMapShapes(); renderHierarchyTree(); }, 100); }
      });
    });
    document.getElementById('wbAddBtn').addEventListener('click', openNewConceptModal);
  }

  // ── HUB ──────────────────────────────────
  function renderHub() {
    const bannerEl = document.getElementById('wbHubBanner');
    if (worldData?.banner_url) bannerEl.style.backgroundImage = `url('${worldData.banner_url}')`;
    document.getElementById('wbHubDesc').textContent = worldData?.descripcion || '';

    const recentEl = document.getElementById('hubRecentConcepts');
    const recents = [...conceptosCache].reverse().slice(0, 6);
    if (!recents.length) { recentEl.innerHTML = '<div class="wb-empty-inline">Sin conceptos aún.</div>'; }
    else {
      recentEl.innerHTML = '';
      recents.forEach(c => {
        const tipo = c.plantillas_concepto?.nombre || 'Concepto';
        if (tipo.toLowerCase() === 'world') return;
        const bub = document.createElement('div');
        bub.className = 'wb-hub-concept-bubble';
        bub.innerHTML = `<div class="wb-bubble-icon">${c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(tipo)}</div><span>${c.titulo || 'Sin título'}</span>`;
        bub.addEventListener('click', () => openConceptDetail(c));
        recentEl.appendChild(bub);
      });
    }

    const statsEl = document.getElementById('hubStats');
    const counts = {};
    conceptosCache.forEach(c => {
      const t = c.plantillas_concepto?.nombre || '?';
      if (t.toLowerCase() === 'world') return;
      counts[t] = (counts[t] || 0) + 1;
    });
    statsEl.innerHTML = Object.entries(counts).map(([t, n]) => `<div class="wb-stat-card"><span class="wb-stat-number">${n}</span><span class="wb-stat-label">${t}s</span></div>`).join('') || '<div class="wb-stat-card"><span class="wb-stat-number">0</span><span class="wb-stat-label">Conceptos</span></div>';

    const locEl = document.getElementById('hubRecentLocations');
    const locs = conceptosCache.filter(c => c.plantillas_concepto?.nombre === 'Locación').slice(0, 4);
    if (!locs.length) { locEl.innerHTML = '<div class="wb-empty-inline">Sin locaciones aún.</div>'; }
    else {
      locEl.innerHTML = '';
      locs.forEach(l => {
        const card = document.createElement('div');
        card.className = 'wb-hub-location-card';
        card.innerHTML = `<div class="wb-loc-preview">${l.icono_url ? `<img src="${l.icono_url}" alt="">` : '📍'}</div><div class="wb-loc-name">${l.titulo || 'Sin nombre'}</div>`;
        card.addEventListener('click', () => openConceptDetail(l));
        locEl.appendChild(card);
      });
    }
  }

  function typeIcon(tipo) { const t = MAIN_TYPES.find(x => x.key === tipo); return t ? t.icon : '📄'; }

  // ── CONCEPTOS TAB ──────────────────────────
  function renderTypesGrid() {
    const grid = document.getElementById('typesGrid');
    grid.innerHTML = '';
    MACRO_CATEGORIES.forEach(macro => {
      let totalCount = 0;
      macro.children.forEach(typeKey => {
        totalCount += getConceptsByType(typeKey).length;
      });
      const card = document.createElement('div');
      card.className = 'wb-macro-card';
      card.innerHTML = `
        <div class="wb-macro-card-bg" style="background: ${macro.heroGradient}"></div>
        <button class="wb-macro-card-add" title="Nuevo en ${macro.label}" data-type="${macro.children[0]}">+</button>
        <div class="wb-macro-card-overlay">
          <div class="wb-macro-card-icon">${macro.icon}</div>
          <h3 class="wb-macro-card-title">${macro.label}</h3>
          <p class="wb-macro-card-desc">${macro.description}</p>
          <span class="wb-macro-card-count">${totalCount} concepto${totalCount !== 1 ? 's' : ''}</span>
        </div>`;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.wb-macro-card-add')) { e.stopPropagation(); openNewConceptModal(macro.children[0]); return; }
        showMacroConceptHub(macro);
      });
      grid.appendChild(card);
    });
  }

  function getConceptsByType(typeKey) {
    return conceptosCache.filter(c => {
      const tipo = c.plantillas_concepto?.nombre;
      return tipo === typeKey && (!worldId || c.padre_id === worldId || c.id === worldId);
    });
  }

  // ── MACRO CONCEPT LIST (simple bubbles) ──
  function showMacroConceptHub(macro) {
    playSwoosh();
    currentMacroHub = macro;
    window.ANIM.hide(document.getElementById('viewTypes'), 'anim-fade-out');
    window.ANIM.show(document.getElementById('viewMacroHub'), 'anim-fade-in');
    document.getElementById('macroHubTitle').textContent = macro.label;

    // Add button
    document.getElementById('addConceptInTypeBtn').onclick = () => openNewConceptModal(macro.children[0]);

    // Gather all concepts for this macro
    let allConcepts = [];
    macro.children.forEach(typeKey => {
      allConcepts = allConcepts.concat(getConceptsByType(typeKey));
    });

    // Render bubbles
    renderConceptsBubbles(allConcepts);

    // Back button
    const backBtn = document.getElementById('macroHubBackBtn');
    const newBack = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBack, backBtn);
    newBack.addEventListener('click', closeMacroHub);
  }

  function closeMacroHub() {
    playSwoosh();
    window.ANIM.hide(document.getElementById('viewMacroHub'), 'anim-fade-out');
    window.ANIM.show(document.getElementById('viewTypes'), 'anim-fade-in');
    currentMacroHub = null;
  }

  function renderConceptsBubbles(conceptos) {
    const container = document.getElementById('conceptsBubbles');
    container.innerHTML = '';
    if (!conceptos.length) { container.innerHTML = '<div class="wb-empty-inline" style="padding:20px">Sin conceptos aún. ¡Crea el primero!</div>'; return; }
    conceptos.forEach(c => {
      const bub = document.createElement('div');
      bub.className = 'wb-concept-bubble'; bub.dataset.id = c.id;
      bub.innerHTML = `
        <button class="wb-concept-bubble-edit" title="Editar">✏</button>
        <div class="wb-concept-bubble-icon">${c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(c.plantillas_concepto?.nombre || '')}</div>
        <span class="wb-concept-bubble-name">${c.titulo || 'Sin título'}</span>`;
      bub.addEventListener('click', (e) => {
        if (e.target.closest('.wb-concept-bubble-edit')) { e.stopPropagation(); openEditConceptModal(c); return; }
        openConceptDetail(c);
      });
      container.appendChild(bub);
    });
  }

  // ── BUILD YOUTUBE CARD (used by concept detail hub) ──
  function buildYoutubeCard(concepto) {
    const card = document.createElement('div');
    card.className = 'wb-yt-card';
    card.dataset.id = concepto.id;
    const tipo = concepto.plantillas_concepto?.nombre || 'Concepto';
    const desc = getConceptBriefDesc(concepto);

    card.innerHTML = `
      <div class="wb-yt-card-thumb">
        ${concepto.icono_url
          ? `<img src="${concepto.icono_url}" alt="${concepto.titulo || ''}">`
          : `<span class="wb-yt-card-thumb-emoji">${typeIcon(tipo)}</span>`}
        <button class="wb-yt-card-edit" title="Editar">✏</button>
      </div>
      <div class="wb-yt-card-info">
        <div class="wb-yt-card-title">${concepto.titulo || 'Sin título'}</div>
        <div class="wb-yt-card-desc">${desc}</div>
        <div class="wb-yt-card-badge">${tipo}</div>
      </div>`;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.wb-yt-card-edit')) { e.stopPropagation(); openEditConceptModal(concepto); return; }
      openConceptDetail(concepto);
    });
    return card;
  }

  function getConceptBriefDesc(concepto) {
    if (concepto.descripcion && concepto.descripcion.trim() !== '') {
      return concepto.descripcion.length > 100 ? concepto.descripcion.substring(0, 100) + '...' : concepto.descripcion;
    }
    return 'Sin descripción';
  }

  // ══════════════════════════════════════════
  //  HUB TABS & VIEWS (Inner Concept)
  // ══════════════════════════════════════════
  function switchCdInnerTab(target) {
    playSwoosh();
    document.querySelectorAll('.wb-cd-inner-tab').forEach(t => t.classList.toggle('active', t.dataset.cdtab === target));
    document.querySelectorAll('.wb-cd-tab-content').forEach(c => c.classList.remove('active'));
    
    // Capitalize target to match ID format e.g., 'subconceptos' -> 'Subconceptos'
    const contentId = `cdTab${target.charAt(0).toUpperCase() + target.slice(1)}`;
    const content = document.getElementById(contentId);
    if (content) content.classList.add('active');

    if (target === 'relaciones') renderCdTabRelations();
    if (target === 'mapa') renderCdTabMap();

    const hubView = document.getElementById('cdHubView');
    if (hubView) {
      if (target === 'mapa') hubView.classList.add('map-mode-active');
      else hubView.classList.remove('map-mode-active');
    }
  }

  function renderCdTabRelations() {
    const grid = document.getElementById('cdTabRelationsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (!currentConcepto) return;
    const relsFrom = globalRelationsCache.from[currentConcepto.id] || [];
    const relsTo = globalRelationsCache.to[currentConcepto.id] || [];

    function buildCol(title, list, isFrom) {
      const col = document.createElement('div');
      col.className = 'wb-cd-rel-col';
      col.innerHTML = `<div class="wb-cd-rel-title">${title} (${list.length})</div>`;
      if (list.length === 0) {
         col.innerHTML += `<div class="wb-cd-rel-empty">No hay relaciones configuradas en esta dirección.</div>`;
         return col;
      }
      list.forEach(r => {
        const otherId = isFrom ? r.concepto_destino_id : r.concepto_origen_id;
        const otherRef = conceptosCache.find(x => x.id === otherId);
        const name = otherRef ? otherRef.titulo : 'Concepto Desconocido';
        
        const getIconHtml = (c) => c && c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(c?.plantillas_concepto?.nombre || '');
        
        let baseIconHtml, topIconHtml;
        if (isFrom) {
          // Hacia otros conceptos: el icono del concepto actual aparecera encima
          baseIconHtml = getIconHtml(otherRef);
          topIconHtml = getIconHtml(currentConcepto);
        } else {
          // Desde otros conceptos: el icono del concepto externo aparecera encima
          baseIconHtml = getIconHtml(currentConcepto);
          topIconHtml = getIconHtml(otherRef);
        }

        const card = document.createElement('div');
        card.className = 'wb-cd-rel-card';
        card.innerHTML = `
          <div class="wb-cd-rel-icons">
            <div class="wb-cd-rel-icon-base">${baseIconHtml}</div>
            <div class="wb-cd-rel-icon-top">${topIconHtml}</div>
          </div>
          <div class="wb-cd-rel-info">
            <div class="wb-cd-rel-badge">${r.tipo_relacion || 'Relacionado'}</div>
            <div class="wb-cd-rel-text">${name}</div>
          </div>
        `;
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          openRelContextMenu(e, r, otherRef);
        });
        col.appendChild(card);
      });
      return col;
    }

    grid.appendChild(buildCol('Hacia otros conceptos', relsFrom, true));
    grid.appendChild(buildCol('Desde otros conceptos', relsTo, false));

    // Reset quick search UI when switching concept or tab
    const relSearchInput = document.getElementById('cdRelSearchInput');
    if (relSearchInput) relSearchInput.value = '';
    const relResults = document.getElementById('cdRelQuickResults');
    if (relResults) { relResults.innerHTML = ''; window.ANIM.hide(relResults, 'anim-fade-out'); }
    const relTypeSelector = document.getElementById('cdRelTypeSelector');
    if (relTypeSelector) { relTypeSelector.innerHTML = ''; window.ANIM.hide(relTypeSelector, 'anim-fade-out'); }
  }

  function handleQuickRelateSearch(query) {
    const results = document.getElementById('cdRelQuickResults');
    const selector = document.getElementById('cdRelTypeSelector');
    if (!results) return;
    
    window.ANIM.hide(selector, 'anim-fade-out');

    if (!query || query.length < 2) {
      results.innerHTML = '';
      window.ANIM.hide(results, 'anim-fade-out');
      return;
    }

    const q = query.toLowerCase();
    const currentConceptId = currentConcepto?.id;
    const matches = conceptosCache
      .filter(c => c.id !== currentConceptId && (c.titulo || '').toLowerCase().includes(q))
      .slice(0, 10);

    if (matches.length === 0) {
      results.innerHTML = '<div class="wb-rel-empty">No se encontraron conceptos</div>';
      window.ANIM.show(results, 'anim-fade-in');
      return;
    }

    results.innerHTML = '';
    window.ANIM.show(results, 'anim-fade-in');

    matches.forEach(c => {
      const item = document.createElement('div');
      item.className = 'wb-cd-rel-quick-item';
      const iconHtml = c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(c.plantillas_concepto?.nombre || '');
      item.innerHTML = `
        <div class="quick-item-icon">${iconHtml}</div>
        <div class="quick-item-info">
          <div class="quick-item-title">${c.titulo || 'Sin título'}</div>
          <div class="quick-item-type">${c.plantillas_concepto?.nombre || 'Concepto'}</div>
        </div>
        <button class="quick-item-link-btn">Vincular</button>
      `;
      item.querySelector('.quick-item-link-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showQuickRelateTypeSelector(c);
      });
      results.appendChild(item);
    });
  }

  function showQuickRelateTypeSelector(targetConcept) {
    const selector = document.getElementById('cdRelTypeSelector');
    const results = document.getElementById('cdRelQuickResults');
    if (!selector) return;

    window.ANIM.hide(results, 'anim-fade-out');
    selector.innerHTML = '';
    window.ANIM.show(selector, 'anim-fade-in');

    const types = getRelationTypesForConcept(currentConcepto);
    const header = document.createElement('div');
    header.className = 'type-selector-header';
    header.innerHTML = `
      <span>Vincular con <b>${targetConcept.titulo}</b> como:</span>
      <button class="type-selector-close">✕</button>
    `;
    header.querySelector('.type-selector-close').addEventListener('click', () => {
      window.ANIM.hide(selector, 'anim-fade-out');
      window.ANIM.show(results, 'anim-fade-in');
    });
    selector.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'type-selector-grid';
    
    Object.entries(types).forEach(([key, rt]) => {
      const btn = document.createElement('button');
      btn.className = 'type-selector-btn';
      btn.style.setProperty('--color', rt.color);
      btn.innerHTML = `
        <span class="btn-emoji">${rt.emoji}</span>
        <span class="btn-label">${rt.label}</span>
      `;
      btn.addEventListener('click', async () => {
        await quickLinkConcepts(targetConcept, key);
        window.ANIM.hide(selector, 'anim-fade-out');
        document.getElementById('cdRelSearchInput').value = '';
      });
      grid.appendChild(btn);
    });
    selector.appendChild(grid);
  }

  async function quickLinkConcepts(targetConcept, relationType) {
    if (!currentConcepto || !targetConcept) return;

    const { data, error } = await sb.from('concepto_relaciones').insert({
      mundo_id: worldData?.id || null,
      concepto_origen_id: currentConcepto.id,
      concepto_destino_id: targetConcept.id,
      tipo_relacion: relationType,
      notas: ''
    }).select().single();

    if (error) {
      showToast('Error al crear relación', 'error');
      return;
    }

    // Update Cache
    if (!globalRelationsCache.from[currentConcepto.id]) globalRelationsCache.from[currentConcepto.id] = [];
    globalRelationsCache.from[currentConcepto.id].push(data);
    
    if (!globalRelationsCache.to[targetConcept.id]) globalRelationsCache.to[targetConcept.id] = [];
    globalRelationsCache.to[targetConcept.id].push(data);

    showToast(`Vínculo con ${targetConcept.titulo} creado`, 'success');
    renderCdTabRelations(); // Refresh the list
  }

  async function renderCdTabMap() {
    const preview = document.getElementById('cdTabMapPreview');
    if (!preview) return;
    preview.innerHTML = '';

    // Remove any previous map wrapper styles
    preview.style.width = '';
    preview.style.height = '';
    preview.style.position = '';
    preview.style.borderRadius = '';
    preview.style.overflow = '';
    preview.style.padding = '32px';
    preview.style.display = 'flex';
    preview.style.flexDirection = 'column';
    preview.style.alignItems = 'center';

    let locBlock = blocksData.find(b => b.tipo === 'locacion');
    
    if (!locBlock) {
       preview.innerHTML = `
         <div class="wb-cd-rel-empty" style="text-align: center; margin-bottom: 12px;">Aún no se ha especificado la ubicación geopolítica de este concepto.</div>
         <button class="wb-btn primary" id="cdBtnRelateRegion">Relacionar Región</button>
       `;

       const btnRelate = document.getElementById('cdBtnRelateRegion');
       if (btnRelate) {
         btnRelate.addEventListener('click', async () => {
           btnRelate.disabled = true;
           btnRelate.textContent = 'Creando entorno map...';
           
           if (!currentContentId) {
                 const { data: nc } = await sb.from('contenidos').insert({ proyecto_id: projectId, titulo: currentConcepto.id, tipo_plantilla: 'wb_concepto' }).select().single();
                 if (nc) currentContentId = nc.id;
           }
           if (!currentContentId) return;

           const blockData = { region_id: null, region_name: '', is_location: false, location_id: null };
           const { data: nb } = await sb.from('bloques')
              .insert({ contenido_id: currentContentId, tipo: 'locacion', data: blockData, orden: 50 })
              .select().single();
           
           if (nb) {
              blocksData.push(nb);
              renderCdTabMap(); // Re-render to show the map canvas
           }
         });
       }
    } else {
       // We have a location block. Transform the preview container to host the canvas.
       preview.style.padding = '0';
       preview.style.display = 'flex';
       preview.style.flexDirection = 'column';
       preview.style.alignItems = 'stretch';
       preview.style.justifyContent = 'flex-start';
       preview.style.width = 'calc(100% - 48px)';
       preview.style.margin = '24px';
       preview.style.flex = '1';
       preview.style.height = 'auto'; 
       preview.style.minHeight = '0'; 
       preview.style.position = 'relative';
       preview.style.borderRadius = '16px'; 
       preview.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
       preview.style.border = '1px solid rgba(255,255,255,0.05)';
       preview.style.overflow = 'hidden';
       preview.style.opacity = '1';

       // renderLocacionBlock(el, block, cardEl)
       // We pass `preview` for both element and hover-card
       renderLocacionBlock(preview, locBlock, preview);
    }
  }


  function showMapActionMenu(clientX, clientY, shape, type) {
    const existing = document.querySelector('.wb-map-action-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'wb-map-action-menu';

    // Find actions block
    let actBlock = blocksData.find(b => b.tipo === 'acciones');
    let lista = (actBlock && actBlock.data.lista) ? actBlock.data.lista : [];
    
    // Filter actions for this shape
    const localActions = lista.filter(ac => ac.lugar_id === shape.id || ac.lugar === shape.name);

    // Timeline HTML
    let tlHtml = '';
    if (localActions.length === 0) {
      tlHtml = `<div class="wb-cd-rel-empty" style="padding: 16px; margin: 0; text-align: center;">No hay registros de eventos aquí.</div>`;
    } else {
      localActions.forEach(ac => {
        const globalIdx = lista.indexOf(ac);
        tlHtml += `
          <div class="wb-cd-action-item">
            <div class="wb-cd-action-meta">
               <span>⏱️ <span class="action-time" contenteditable="plaintext-only" data-idx="${globalIdx}" data-field="tiempo">${ac.tiempo || 'Hace X tiempo'}</span></span>
            </div>
            <div class="wb-cd-action-text" contenteditable="plaintext-only" data-idx="${globalIdx}" data-field="texto">${ac.texto || ''}</div>
            <button class="wb-cd-action-delete" title="Eliminar evento" data-idx="${globalIdx}"></button>
          </div>
        `;
      });
    }

    menu.innerHTML = `
      <div class="wb-rel-context-header">
        <div class="wb-rel-context-info">
          <div class="wb-rel-context-title">${shape.name}</div>
          <div class="wb-rel-context-type">📍 Línea de tiempo local</div>
        </div>
        <button class="btn-close-menu" title="Cerrar"></button>
      </div>
      <div class="wb-map-action-timeline">
        ${tlHtml}
      </div>
      <div class="wb-rel-context-actions">
        <button class="btn-add-action">+ Añadir Evento Aquí</button>
      </div>
    `;

    document.body.appendChild(menu);

    const rect = { width: 320, height: menu.offsetHeight };
    let left = clientX;
    let top = clientY;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 20;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 20;
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // Events
    menu.querySelector('.btn-close-menu').onclick = () => menu.remove();
    
    // Add Event Button
    menu.querySelector('.btn-add-action').onclick = async () => {
      if (!currentContentId) {
         const { data: nc } = await sb.from('contenidos').insert({ proyecto_id: currentConcepto.seccion_id ? projectId : projectId, titulo: currentConcepto.id, tipo_plantilla: 'wb_concepto' }).select().single();
         if (nc) currentContentId = nc.id;
         else return;
      }
      if (!actBlock) {
        const { data: nb } = await sb.from('bloques')
          .insert({ contenido_id: currentContentId, tipo: 'acciones', data: { lista: [] }, orden: 900 })
          .select().single();
        if (nb) { actBlock = nb; blocksData.push(nb); }
        else return;
      }
      if (!actBlock.data.lista) actBlock.data.lista = [];
      
      // Push new action linked to this shape
      actBlock.data.lista.unshift({ 
        tiempo: 'AÑO X', 
        lugar: shape.name, 
        lugar_id: shape.id, 
        texto: '' 
      });
      
      scheduleSaveActions();
      showMapActionMenu(clientX, clientY, shape, type); // re-render
      
      // Auto-focus the new item
      setTimeout(() => {
        const newMenu = document.querySelector('.wb-map-action-menu');
        if (newMenu) {
           const newTextInput = newMenu.querySelector('.wb-cd-action-text[data-idx="0"]');
           if (newTextInput) newTextInput.focus();
        }
      }, 100);
    };

    // Edit Tracking
    menu.querySelectorAll('[contenteditable]').forEach(el => {
      el.addEventListener('input', () => scheduleSaveActions());
      el.addEventListener('blur', (e) => {
         const idx = parseInt(e.target.dataset.idx);
         const field = e.target.dataset.field;
         if (actBlock && actBlock.data.lista[idx]) {
            actBlock.data.lista[idx][field] = e.target.textContent;
         }
      });
    });

    // Delete Tracking
    menu.querySelectorAll('.wb-cd-action-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
         const idx = parseInt(e.target.dataset.idx);
         if (confirm('¿Eliminar este evento?')) {
             actBlock.data.lista.splice(idx, 1);
             scheduleSaveActions();
             showMapActionMenu(clientX, clientY, shape, type); // re-render
         }
      });
    });

    setTimeout(() => {
      const handler = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('mousedown', handler);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 10);
  }

  function openRelContextMenu(e, rel, concept) {
    const existing = document.querySelector('.wb-rel-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'wb-rel-context-menu';
    
    // Parse metadata from notes (Format: "Note text [INT:8,SEC:true]")
    let noteText = rel.notas || '';
    let intensity = 5; // default
    let isSecret = false;
    
    const metaMatch = noteText.match(/\[INT:(\d+),SEC:(\w+)\]/);
    if (metaMatch) {
        intensity = parseInt(metaMatch[1]);
        isSecret = metaMatch[2] === 'true';
        noteText = noteText.replace(/\[INT:(\d+),SEC:(\w+)\]/, '').trim();
    }

    if (isSecret) menu.classList.add('is-secret');

    const iconHtml = concept.icono_url ? `<img src="${concept.icono_url}" alt="">` : typeIcon(concept.plantillas_concepto?.nombre || '');
    const brief = getConceptBriefDesc(concept);
    const rt = RELATION_TYPES[rel.tipo_relacion] || { emoji: '❓', label: rel.tipo_relacion, color: '#888' };

    const hasLocation = globalBlocksCache[concept.id]?.some(b => b.tipo === 'locacion' && b.data?.region_id);

    menu.innerHTML = `
      <div class="wb-rel-context-header">
        <div class="wb-rel-context-icon">${iconHtml}</div>
        <div class="wb-rel-context-info">
          <div class="wb-rel-context-title">${concept.titulo || 'Sin título'}</div>
          <div class="wb-rel-context-type">${rt.emoji} ${rt.label} ${isSecret ? ' <span title="Secreto" style="opacity:0.6">🔒</span>' : ''}</div>
        </div>
        <button class="btn-close-menu" title="Cerrar">✕</button>
      </div>
      
      <div class="wb-rel-intensity-strip">
        <div class="intensity-bar" style="width: ${intensity * 10}%; background: ${rt.color}"></div>
        <span class="intensity-label">Intensidad: ${intensity}/10</span>
      </div>

      <div class="wb-rel-context-desc">${brief}</div>
      ${noteText ? `<div class="wb-rel-context-notes">${noteText}</div>` : ''}
      <div class="wb-rel-context-actions">
        <button class="wb-rel-context-btn primary btn-view">👁️ Ver Detalles</button>
        ${hasLocation ? `<button class="wb-rel-context-btn map-btn btn-map">🗺️ Ir al Mapa</button>` : ''}
        <button class="wb-rel-context-btn btn-edit">✏️ Editar Rel.</button>
        <button class="wb-rel-context-btn danger btn-delete">🗑 Eliminar</button>
      </div>
    `;

    document.body.appendChild(menu);

    // Position
    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 150;
    let top = (rect.top + window.scrollY) - (menu.offsetHeight + 20);

    // Bounds check
    if (left < 20) left = 20;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
    if (top < 20) top = (rect.bottom + window.scrollY) + 10;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // Actions
    menu.querySelector('.btn-close-menu').onclick = () => menu.remove();
    menu.querySelector('.btn-view').onclick = () => { menu.remove(); openConceptDetail(concept); };
    
    if (hasLocation) {
        menu.querySelector('.btn-map').onclick = () => {
            menu.remove();
            jumpToMapLocation(concept);
        };
    }

    menu.querySelector('.btn-edit').onclick = () => { 
        menu.remove(); 
        editingRelationId = rel.id; // Set state for editing
        openNewRelationModal(); 
        selectRelationTarget(concept);
        
        // Restore note and metadata to the modal
        document.getElementById('relationNotes').value = noteText;
        document.getElementById('relationIntensity').value = intensity;
        document.getElementById('intensityVal').textContent = intensity;
        document.getElementById('relationSecret').checked = isSecret;

        const typeBtn = document.querySelector(`.wb-rel-type-btn[data-type="${rel.tipo_relacion}"]`);
        if (typeBtn) typeBtn.click();
        
        const saveBtn = document.getElementById('saveNewRelationBtn');
        saveBtn.textContent = 'ACTUALIZAR RELACIÓN';
    };

    menu.querySelector('.btn-delete').onclick = async () => {
        if (!confirm('¿Eliminar esta relación?')) return;
        menu.remove();
        await deleteRelation(rel.id);
        showToast('Relación eliminada', 'success');
        renderCdTabRelations();
    };

    // Close on outside click
    setTimeout(() => {
      const handler = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 10);
  }

  function copyMentionToClipboard(concept) {
    const text = `[${concept.titulo}](concepto:${concept.id})`;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Referencia copiada al portapapeles', 'info');
    });
  }

  function jumpToMapLocation(concept) {
    const locBlock = globalBlocksCache[concept.id]?.find(b => b.tipo === 'locacion' && b.data?.region_id);
    if (!locBlock) return;

    // 1. Close current detail for a clean jump
    if (typeof closeConceptDetail === 'function') closeConceptDetail();

    // 2. Switch to Map tab
    const mapTabBtn = document.querySelector('.wb-tab[data-tab="mapa"]');
    if (mapTabBtn) mapTabBtn.click();

    // 3. Center and Zoom on region
    setTimeout(() => {
        const shapeId = locBlock.data.region_id;
        const region = mapRegions.find(r => r.id === shapeId);
        if (region && region.points && region.points.length > 0) {
            // Calculate center
            let avgX = 0, avgY = 0;
            region.points.forEach(p => { avgX += p.x; avgY += p.y; });
            avgX /= region.points.length;
            avgY /= region.points.length;
            
            // Set a higher zoom level for focus
            mapScale = 1.5; 
            
            mapPan.x = (window.innerWidth / 2) - avgX * mapScale;
            mapPan.y = (window.innerHeight / 2) - avgY * mapScale;
            selectedShapeId = shapeId;
            renderMapShapes();
            showToast(`Explorando ${region.name}`, 'info');
        }
    }, 500);
  }

  function scheduleSaveActions() {
    clearTimeout(blocksSaveTimer); 
    blocksSaveTimer = setTimeout(saveBlocksNow, 1400);
  }

  // ══════════════════════════════════════════
  //  CONCEPT DETAIL
  // ══════════════════════════════════════════
  function setupConceptDetail() {
    document.getElementById('cdCloseBtn').addEventListener('click', closeConceptDetail);
    document.getElementById('cdBackBtn').addEventListener('click', closeConceptDetail);
    const addBlockBtn = document.getElementById('cdAddBlockBtn');
    const blockMenu = document.getElementById('blockTypeMenu');
    addBlockBtn.addEventListener('click', (e) => { e.stopPropagation(); window.ANIM.toggle(blockMenu, 'anim-slide-up', 'anim-slide-down-out'); });
    document.addEventListener('click', () => { window.ANIM.hide(blockMenu, 'anim-slide-down-out'); closeAllInserterMenus(); });
    blockMenu.querySelectorAll('[data-block]').forEach(btn => {
      btn.addEventListener('click', () => { addBlock(btn.dataset.block); window.ANIM.hide(blockMenu, 'anim-slide-down-out'); });
    });

    // Empty state quick-action buttons
    document.querySelectorAll('.wb-empty-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => addBlock(btn.dataset.block));
    });

    // Relations
    document.getElementById('cdRelationsAddBtn').addEventListener('click', () => openNewRelationModal());
    document.getElementById('closeModalNewRelation').addEventListener('click', closeRelationModal);
    document.getElementById('cancelModalNewRelation').addEventListener('click', closeRelationModal);
    document.getElementById('saveNewRelationBtn').addEventListener('click', saveNewRelation);
    document.getElementById('relationSearchInput').addEventListener('input', (e) => searchConceptsForRelation(e.target.value));
    document.getElementById('cdAddSubBtn').addEventListener('click', () => openNewConceptModal(null, true));
    document.getElementById('cdSidebarAddBtn').addEventListener('click', () => openNewConceptModal(null, true));
    document.getElementById('cdIconEditBtn').addEventListener('click', () => document.getElementById('cdIconInput').click());
    document.getElementById('cdIconInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "profile");
      if (cropped) {
        cdIconDataURL = cropped;
        updateCdIcon(cdIconDataURL);
      }
    });
    document.getElementById('cdTitle').addEventListener('input', () => scheduleSave());
    
    // Description edit listener
    const heroDesc = document.getElementById('cdHubHeroDesc');
    if (heroDesc) {
      heroDesc.addEventListener('input', () => scheduleSave());
      heroDesc.addEventListener('focus', function() {
        if (this.textContent === 'Añade una descripción sobre este concepto aquí...') {
          this.textContent = '';
        }
      });
      heroDesc.addEventListener('blur', function() {
        if (!this.textContent.trim()) {
          this.textContent = 'Añade una descripción sobre este concepto aquí...';
        }
      });
    }

    // Hub Inner Tabs
    document.querySelectorAll('.wb-cd-inner-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchCdInnerTab(tab.dataset.cdtab);
      });
    });

    // Interactive Relations Search
    const cdRelSearchInput = document.getElementById('cdRelSearchInput');
    const cdRelSearchClear = document.getElementById('cdRelSearchClear');
    if (cdRelSearchInput) {
      cdRelSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        cdRelSearchClear.classList.toggle('hidden', !query);
        handleQuickRelateSearch(query);
      });
      cdRelSearchClear.addEventListener('click', () => {
        cdRelSearchInput.value = '';
        cdRelSearchClear.classList.add('hidden');
        handleQuickRelateSearch('');
        cdRelSearchInput.focus();
      });
    }


    // Sidebar search (concept detail explorer)
    const sidebarSearch = document.getElementById('cdSidebarSearch');
    const searchWrap = sidebarSearch?.closest('.wb-explorer-search-wrap');
    const searchToggle = document.getElementById('cdSearchToggle');
    const searchClear = document.getElementById('cdSearchClear');

    // Default state: collapsed
    if (searchWrap) searchWrap.classList.add('collapsed');

    if (searchToggle && searchWrap) {
      searchToggle.addEventListener('click', () => {
        const isCollapsed = searchWrap.classList.toggle('collapsed');
        searchToggle.classList.toggle('active', !isCollapsed);

        if (!isCollapsed) {
          setTimeout(() => sidebarSearch.focus(), 150);
        }
      });
    }

    if (sidebarSearch) {
      sidebarSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (searchClear) searchClear.style.display = query ? 'block' : 'none';
        renderCdExplorerTree(query);
      });

      if (searchClear) {
        searchClear.addEventListener('click', () => {
          sidebarSearch.value = '';
          searchClear.style.display = 'none';
          sidebarSearch.focus();
          renderCdExplorerTree();
        });
      }
    }

    // Concept Explorer Dropdown Toggle
    const toggleExplorer = () => {
      const sidebar = document.getElementById('cdSidebar');
      const btn = document.getElementById('cdExplorerToggle');
      if (sidebar && btn) {
        sidebar.classList.toggle('collapsed');
        btn.classList.toggle('active', !sidebar.classList.contains('collapsed'));
      }
    };

    document.getElementById('cdExplorerToggle')?.addEventListener('click', toggleExplorer);
    document.getElementById('cdSidebarCloseBtn')?.addEventListener('click', toggleExplorer);

    // Minimize behavior
    const minimizeBtn = document.getElementById('cdSidebarMinimizeBtn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidebar = document.getElementById('cdSidebar');
        sidebar.classList.toggle('wb-cd-sidebar--minimized');
      });
    }

    // Toggle minimize on double click header or click when minimized
    const sidebarHeader = document.getElementById('cdSidebarHeader');
    if (sidebarHeader) {
      sidebarHeader.addEventListener('click', (e) => {
        const sidebar = document.getElementById('cdSidebar');
        if (sidebar && sidebar.classList.contains('wb-cd-sidebar--minimized')) {
          sidebar.classList.remove('wb-cd-sidebar--minimized');
        }
      });
      sidebarHeader.addEventListener('dblclick', (e) => {
        // Prevent minimize if clicking on action buttons
        if (e.target.closest('.wb-cd-sidebar-actions')) return;
        const sidebar = document.getElementById('cdSidebar');
        sidebar.classList.toggle('wb-cd-sidebar--minimized');
      });
    }

    // Floating Window Management (Drag & Resize)
    wireExplorerWindow();

    function wireExplorerWindow() {
      const win = document.getElementById('cdSidebar');
      const header = document.getElementById('cdSidebarHeader');
      const resizeHandle = document.getElementById('cdSidebarResize');
      if (!win) return;

      // Ensure win starts with right/bottom as auto so left/top can take priority during drag
      
      // DRAG LOGIC
      if (header) {
        let dragging = false, ox = 0, oy = 0, dragRAF = null;
        let parentX = 0, parentY = 0; // parent offset

        header.addEventListener("mousedown", e => {
          if (e.target.closest('.wb-cd-sidebar-actions')) return; // Ignore actions

          // Disable transitions first to avoid jump
          win.classList.add("dragging");
          
          const rect = win.getBoundingClientRect();
          const parentRect = win.offsetParent ? win.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
          parentX = parentRect.left;
          parentY = parentRect.top;

          // Convert current responsive position to parent-relative left/top
          win.style.left = (rect.left - parentRect.left) + "px"; 
          win.style.top = (rect.top - parentRect.top) + "px";
          win.style.right = "auto"; 
          win.style.bottom = "auto";
          win.style.margin = "0";

          // Calculate inner offset
          ox = e.clientX - rect.left; 
          oy = e.clientY - rect.top;
          document.body.style.userSelect = "none";
          dragging = true;
        });

        document.addEventListener("mousemove", e => {
          if (!dragging) return;
          if (dragRAF) cancelAnimationFrame(dragRAF);
          dragRAF = requestAnimationFrame(() => {
            // Target coordinate relative to viewport
            let targetX = e.clientX - ox;
            let targetY = e.clientY - oy;

            // Constrain strictly within the visible viewport bounds
            targetX = Math.max(0, Math.min(targetX, window.innerWidth - win.offsetWidth));
            targetY = Math.max(0, Math.min(targetY, window.innerHeight - win.offsetHeight));

            // Apply style relative to the parent container
            win.style.left = (targetX - parentX) + "px";
            win.style.top = (targetY - parentY) + "px";
          });
        });

        document.addEventListener("mouseup", () => {
          if (!dragging) return;
          dragging = false; 
          document.body.style.userSelect = "";
          win.classList.remove("dragging");
          if (dragRAF) cancelAnimationFrame(dragRAF);
        });
      }

      // RESIZE LOGIC
      if (resizeHandle) {
        let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0, resizeRAF = null;
        resizeHandle.addEventListener("mousedown", e => {
          resizing = true; 
          sx = e.clientX; 
          sy = e.clientY;
          sw = win.offsetWidth; 
          sh = win.offsetHeight;
          
          e.preventDefault(); 
          document.body.style.userSelect = "none";
          win.classList.add("dragging"); // Reusing for no-transition state
        });

        document.addEventListener("mousemove", e => {
          if (!resizing) return;
          if (resizeRAF) cancelAnimationFrame(resizeRAF);
          resizeRAF = requestAnimationFrame(() => {
            const newWidth = Math.max(250, sw + (e.clientX - sx));
            const newHeight = Math.max(200, sh + (e.clientY - sy));
            win.style.width = newWidth + "px";
            win.style.height = newHeight + "px";
          });
        });

        document.addEventListener("mouseup", () => {
          if (!resizing) return;
          resizing = false; 
          document.body.style.userSelect = "";
          win.classList.remove("dragging");
          if (resizeRAF) cancelAnimationFrame(resizeRAF);
        });
      }
    }

    // Block Settings Modal (legacy - kept for compatibility)
    const closeBS = document.getElementById('closeModalBlockSettings');
    const cancelBS = document.getElementById('cancelModalBlockSettings');
    const saveBS = document.getElementById('saveBlockSettingsBtn');
    if (closeBS) closeBS.addEventListener('click', closeBlockSettings);
    if (cancelBS) cancelBS.addEventListener('click', closeBlockSettings);
    if (saveBS) saveBS.addEventListener('click', applyBlockSettings);

    document.querySelectorAll('#modalBlockSettings .wb-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.align) {
          const parent = btn.parentElement;
          parent.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } else {
          btn.classList.toggle('active');
        }
      });
    });
  }

  let cdHubSearchFilter = null; // Active category filter in concept hub search

  async function openConceptDetail(concepto) {
    playConceptClickSound();
    currentConcepto = concepto; cdIconDataURL = null; blocksData = []; relationsCache = [];
    cdHubSearchFilter = null;
    document.getElementById('cdTitle').textContent = concepto.titulo || 'Sin título';
    document.getElementById('cdTypeBadge').textContent = concepto.plantillas_concepto?.nombre || '?';
    updateCdIcon(concepto.icono_url || null);
    renderSubconceptsSidebar(concepto);

    // Check if this concept has sub-concepts → hub mode
    const subConcepts = conceptosCache.filter(c => c.padre_id === concepto.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    const overlay = document.getElementById('conceptDetail');

    // Standardize data loading for both modes
    await loadBlocks(concepto);
    await loadRelations(concepto);

    if (subConcepts.length > 0) {
      // HUB MODE: Netflix hero + YouTube cards
      overlay.classList.add('hub-mode');
      window.ANIM.show(document.getElementById('cdHubView'), 'anim-fade-in');
      document.getElementById('cdBlocksArea').style.display = 'none';
      renderCdHubView(concepto, subConcepts);
    } else {
      // BLOCKS MODE: Original editor
      overlay.classList.remove('hub-mode');
      window.ANIM.hide(document.getElementById('cdHubView'), 'anim-fade-out');
      document.getElementById('cdBlocksArea').style.display = '';
      // loadBlocks already called above
    }

    window.ANIM.show(overlay, 'anim-fade-in');
    document.body.style.overflow = 'hidden';

    // Wire hub search events (clone to prevent duplicate listeners)
    const searchInput = document.getElementById('cdHubSearchInput');
    if (searchInput) {
      const newSearch = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearch, searchInput);
      newSearch.addEventListener('input', (e) => handleCdHubSearch(e.target.value));
    }
    const clearBtn = document.getElementById('cdHubSearchClear');
    if (clearBtn) {
      const newClear = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(newClear, clearBtn);
      newClear.addEventListener('click', () => {
        document.getElementById('cdHubSearchInput').value = '';
        document.getElementById('cdHubSearchClear').classList.add('hidden');
        handleCdHubSearch('');
      });
    }
  }

  function closeConceptDetail() {
    saveBlocksNow();
    const overlay = document.getElementById('conceptDetail');
    window.ANIM.hide(overlay, 'anim-fade-out');
    overlay.classList.remove('hub-mode');
    document.body.style.overflow = '';
    currentConcepto = null; currentContentId = null; blocksData = []; relationsCache = [];
    cdHubSearchFilter = null;
  }

  async function refreshConceptDetail() {
    if (!currentConcepto) return;
    const overlay = document.getElementById('conceptDetail');
    if (overlay.classList.contains('hidden')) return;

    const updatedConcept = conceptosCache.find(c => c.id === currentConcepto.id);
    if (!updatedConcept) { closeConceptDetail(); return; }
    currentConcepto = updatedConcept;
    
    document.getElementById('cdTitle').textContent = currentConcepto.titulo || 'Sin título';
    updateCdIcon(currentConcepto.icono_url || null);

    const subConcepts = conceptosCache.filter(c => c.padre_id === currentConcepto.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    
    if (overlay.classList.contains('hub-mode')) {
      const activeTabBtn = document.querySelector('.wb-cd-inner-tab.active');
      const currentTab = activeTabBtn ? activeTabBtn.dataset.cdtab : 'subconceptos';
      
      document.getElementById('cdHubHeroTitle').textContent = currentConcepto.titulo || 'Sin título';
      document.getElementById('cdHubHeroDesc').textContent = currentConcepto.descripcion || 'Añade una descripción sobre este concepto aquí...';

      renderCdHubFilterChips(subConcepts);
      renderCdHubContent(subConcepts);
      renderCdTabRelations();
      switchCdInnerTab(currentTab);
    } else {
      renderSubconceptsSidebar(currentConcepto);
      // Automatically upgrade to hub mode if they added their first subconcept
      if (subConcepts.length > 0) {
        overlay.classList.add('hub-mode');
        window.ANIM.show(document.getElementById('cdHubView'), 'anim-fade-in');
        document.getElementById('cdBlocksArea').style.display = 'none';
        renderCdHubView(currentConcepto, subConcepts);
      }
    }
  }

  // ── CONCEPT HUB RENDERING (inside concept detail) ──
  function renderCdHubView(concepto, subConcepts) {
    switchCdInnerTab('subconceptos');
    // Hero
    const hero = document.getElementById('cdHubHero');
    if (concepto.icono_url) {
      hero.style.backgroundImage = `url(${concepto.icono_url})`;
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    } else {
      // Use a macro category gradient based on concept type
      const macro = MACRO_CATEGORIES.find(m => m.children.includes(concepto.plantillas_concepto?.nombre));
      hero.style.backgroundImage = 'none';
      hero.style.background = macro ? macro.heroGradient : 'linear-gradient(135deg, #1a0c2e, #2d1045)';
    }
    document.getElementById('cdHubHeroTitle').textContent = concepto.titulo || 'Sin título';
    let heroDescStr = concepto.descripcion;
    document.getElementById('cdHubHeroDesc').textContent = heroDescStr || 'Añade una descripción sobre este concepto aquí...';

    // Filter chips
    renderCdHubFilterChips(subConcepts);

    // Content
    renderCdHubContent(subConcepts);

    // Reset search
    const searchInput = document.getElementById('cdHubSearchInput');
    if (searchInput) searchInput.value = '';
    document.getElementById('cdHubSearchClear')?.classList.add('hidden');
    window.ANIM.hide(document.getElementById('cdHubSearchResults'), 'anim-fade-out');
    document.getElementById('cdHubContent').style.display = '';
    document.getElementById('cdHubHero').style.display = '';
  }

  function renderCdHubFilterChips(subConcepts) {
    const container = document.getElementById('cdHubFilterChips');
    container.innerHTML = '';

    // Get unique types from sub-concepts
    const types = [...new Set(subConcepts.map(c => c.plantillas_concepto?.nombre || 'Otro'))];
    if (types.length <= 1) return;

    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'wb-hub-filter-chip active';
    allChip.textContent = 'Todos';
    allChip.addEventListener('click', () => {
      cdHubSearchFilter = null;
      container.querySelectorAll('.wb-hub-filter-chip').forEach(c => c.classList.remove('active'));
      allChip.classList.add('active');
      const q = document.getElementById('cdHubSearchInput')?.value || '';
      if (q.trim()) handleCdHubSearch(q);
      else {
        const subs = conceptosCache.filter(c => c.padre_id === currentConcepto?.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
        renderCdHubContent(subs);
      }
    });
    container.appendChild(allChip);

    types.forEach(typeKey => {
      const t = MAIN_TYPES.find(mt => mt.key === typeKey);
      const chip = document.createElement('button');
      chip.className = 'wb-hub-filter-chip';
      chip.textContent = `${t ? t.icon : '📄'} ${t ? t.label : typeKey}`;
      chip.addEventListener('click', () => {
        cdHubSearchFilter = typeKey;
        container.querySelectorAll('.wb-hub-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const q = document.getElementById('cdHubSearchInput')?.value || '';
        if (q.trim()) handleCdHubSearch(q);
        else {
          const subs = conceptosCache.filter(c => c.padre_id === currentConcepto?.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
          renderCdHubContent(subs);
        }
      });
      container.appendChild(chip);
    });
  }

  function renderCdHubContent(subConcepts) {
    const content = document.getElementById('cdHubContent');
    content.innerHTML = '';

    let filtered = [...subConcepts];
    if (cdHubSearchFilter) {
      filtered = filtered.filter(c => (c.plantillas_concepto?.nombre || 'Otro') === cdHubSearchFilter);
    }

    if (!filtered.length) {
      content.innerHTML = `<div class="wb-macro-empty"><span class="wb-macro-empty-icon">📁</span>Sin sub-conceptos en esta categoría.</div>`;
      return;
    }

    // Group by type
    const byType = {};
    filtered.forEach(c => {
      const t = c.plantillas_concepto?.nombre || 'Otro';
      if (!byType[t]) byType[t] = [];
      byType[t].push(c);
    });

    Object.entries(byType).forEach(([typeKey, concepts]) => {
      const t = MAIN_TYPES.find(mt => mt.key === typeKey);
      const section = document.createElement('div');
      section.className = 'wb-macro-category-section';
      section.innerHTML = `
        <div class="wb-macro-cat-header">
          <span class="wb-macro-cat-icon">${t ? t.icon : '📄'}</span>
          <h3 class="wb-macro-cat-title">${t ? t.label : typeKey}</h3>
          <span class="wb-macro-cat-count">${concepts.length}</span>
          <div class="wb-macro-cat-divider"></div>
        </div>`;
      const grid = document.createElement('div');
      grid.className = 'wb-yt-grid';
      concepts.forEach(c => grid.appendChild(buildYoutubeCard(c)));
      section.appendChild(grid);
      content.appendChild(section);
    });
  }

  function handleCdHubSearch(query) {
    const q = query.toLowerCase().trim();
    const clearBtn = document.getElementById('cdHubSearchClear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);

    if (!q) {
      window.ANIM.hide(document.getElementById('cdHubSearchResults'), 'anim-fade-out');
      document.getElementById('cdHubContent').style.display = '';
      document.getElementById('cdHubHero').style.display = '';
      if (currentConcepto) {
        const subs = conceptosCache.filter(c => c.padre_id === currentConcepto.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
        renderCdHubContent(subs);
      }
      return;
    }

    // Hide hero and content, show search results
    document.getElementById('cdHubHero').style.display = 'none';
    document.getElementById('cdHubContent').style.display = 'none';
    window.ANIM.show(document.getElementById('cdHubSearchResults'), 'anim-fade-in');

    const resultsContainer = document.getElementById('cdHubSearchResults');
    resultsContainer.innerHTML = '';

    if (!currentConcepto) return;

    let subs = conceptosCache.filter(c => c.padre_id === currentConcepto.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    if (cdHubSearchFilter) {
      subs = subs.filter(c => (c.plantillas_concepto?.nombre || 'Otro') === cdHubSearchFilter);
    }

    const matches = subs.filter(c => (c.titulo || '').toLowerCase().includes(q));

    if (!matches.length) {
      resultsContainer.innerHTML = `<div class="wb-macro-search-empty"><span class="wb-macro-search-empty-icon">🔍</span>No se encontraron sub-conceptos para "${query}"</div>`;
      return;
    }

    const byType = {};
    matches.forEach(c => {
      const t = c.plantillas_concepto?.nombre || 'Otro';
      if (!byType[t]) byType[t] = [];
      byType[t].push(c);
    });

    Object.entries(byType).forEach(([typeKey, concepts]) => {
      const t = MAIN_TYPES.find(mt => mt.key === typeKey);
      const section = document.createElement('div');
      section.className = 'wb-macro-search-cat';
      section.innerHTML = `<div class="wb-macro-search-cat-title">${t ? t.icon : '📄'} ${t ? t.label : typeKey} (${concepts.length})</div>`;
      const grid = document.createElement('div');
      grid.className = 'wb-yt-grid';
      concepts.forEach(c => grid.appendChild(buildYoutubeCard(c)));
      section.appendChild(grid);
      resultsContainer.appendChild(section);
    });
  }

  function updateCdIcon(src) {
    const img = document.getElementById('cdIconImg'), text = document.getElementById('cdIconText');
    if (src) { img.src = src; img.style.display = 'block'; text.style.display = 'none'; }
    else { img.style.display = 'none'; text.style.display = 'block'; text.textContent = (currentConcepto?.titulo || '?')[0]; }
  }

  function renderSubconceptsSidebar(parent, query = '') {
    // Render full concept explorer inside the concept detail sidebar
    renderCdExplorerTree(query);
  }

  function renderCdExplorerTree(searchQuery = '') {
    loadExplorerState();
    const list = document.getElementById('cdSubconceptsList');
    list.innerHTML = '';
    if (!conceptosCache.length) {
      list.innerHTML = `<div style="font-family:'Etna';font-size:11px;color:rgba(255,255,255,0.25);padding:8px 10px">Sin conceptos aún</div>`;
      return;
    }

    const q = (searchQuery || '').toLowerCase().trim();

    // Get top-level (same logic as main explorer)
    const topLevel = conceptosCache.filter(c => {
      const tipo = c.plantillas_concepto?.nombre;
      if (!tipo || tipo.toLowerCase() === 'world') return false;
      return c.padre_id === worldId || (!worldId && !c.padre_id);
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
        filteredItems = macroItems.filter(c => conceptMatchesSearch(c, q));
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
        renderCdExplorerTree(document.getElementById('cdSidebarSearch')?.value || '');
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
            subHeader.textContent = typeData ? typeData.label : t;
            children.appendChild(subHeader);
            bySubType[t].forEach(c => {
              children.appendChild(buildCdExplorerNode(c, 1, q));
            });
          });
        } else {
          filteredItems.forEach(c => {
            children.appendChild(buildCdExplorerNode(c, 1, q));
          });
        }
        folder.appendChild(children);
      }

      list.appendChild(folder);
    });
  }

  function buildCdExplorerNode(concept, depth, searchQuery = '') {
    const children = conceptosCache.filter(c => c.padre_id === concept.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    const hasChildren = children.length > 0;
    const folderId = `node_${concept.id}`;
    const isCollapsed = explorerCollapsed[folderId] && !searchQuery;
    const isCurrent = currentConcepto && currentConcepto.id === concept.id;

    const wrap = document.createElement('div');
    wrap.className = 'wb-explorer-node-wrap';

    const node = document.createElement('div');
    node.className = 'wb-explorer-item' + (isCurrent ? ' active' : '');
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
        renderCdExplorerTree(document.getElementById('cdSidebarSearch')?.value || '');
        return;
      }
      // Navigate to this concept
      openConceptDetail(concept);
    });

    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showExplorerContextMenu(e, concept);
    });

    wrap.appendChild(node);

    if (hasChildren && !isCollapsed) {
      const childContainer = document.createElement('div');
      childContainer.className = 'wb-explorer-children';

      const childByType = {};
      let filteredChildren = children;
      if (searchQuery) {
        filteredChildren = children.filter(c => conceptMatchesSearch(c, searchQuery));
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
            childContainer.appendChild(buildCdExplorerNode(c, depth + 1, searchQuery));
          });
        });
      } else {
        filteredChildren.forEach(c => {
          childContainer.appendChild(buildCdExplorerNode(c, depth + 1, searchQuery));
        });
      }

      wrap.appendChild(childContainer);
    }

    return wrap;
  }

  // ── RELATIONSHIPS ─────────────────────────
  /*
   * Requires Supabase table: concepto_relaciones
   * CREATE TABLE concepto_relaciones (
   *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
   *   mundo_id uuid,
   *   concepto_origen_id uuid REFERENCES conceptos(id) ON DELETE CASCADE,
   *   concepto_destino_id uuid REFERENCES conceptos(id) ON DELETE CASCADE,
   *   tipo_relacion text NOT NULL,
   *   notas text DEFAULT '',
   *   created_at timestamptz DEFAULT now()
   * );
   * ALTER TABLE concepto_relaciones ENABLE ROW LEVEL SECURITY;
   * CREATE POLICY "Allow all" ON concepto_relaciones FOR ALL USING (true);
   */

  let relationsFromCache = [];  // Relations where this concept is ORIGIN
  let relationsToCache = [];    // Relations where this concept is DESTINATION

  async function loadRelations(concepto) {
    const list = document.getElementById('cdRelationsList');
    list.innerHTML = '';
    relationsFromCache = [];
    relationsToCache = [];
    relationsCache = [];

    // 1. Try global cache first
    if (globalRelationsCache.from[concepto.id] || globalRelationsCache.to[concepto.id]) {
      relationsFromCache = globalRelationsCache.from[concepto.id] || [];
      relationsToCache = globalRelationsCache.to[concepto.id] || [];
      relationsCache = [...relationsFromCache, ...relationsToCache];
      renderRelationsList();
      return;
    }

    try {
      // 2. Fallback to Supabase
      const { data: fromData, error: e1 } = await sb.from('concepto_relaciones')
        .select('*')
        .eq('concepto_origen_id', concepto.id);
      const { data: toData, error: e2 } = await sb.from('concepto_relaciones')
        .select('*')
        .eq('concepto_destino_id', concepto.id);

      if (e1 && e2) { list.innerHTML = '<div class="wb-rel-empty">Tabla no disponible</div>'; return; }
      
      relationsFromCache = fromData || [];
      relationsToCache = toData || [];
      relationsCache = [...relationsFromCache, ...relationsToCache];

      // Update cache
      globalRelationsCache.from[concepto.id] = relationsFromCache;
      globalRelationsCache.to[concepto.id] = relationsToCache;
    } catch (e) {
      list.innerHTML = '<div class="wb-rel-empty">Tabla no disponible</div>'; return;
    }
    renderRelationsList();
  }

  function renderRelationsList() {
    const list = document.getElementById('cdRelationsList');
    list.innerHTML = '';

    if (!relationsFromCache.length && !relationsToCache.length) {
      list.innerHTML = '<div class="wb-rel-empty">Sin relaciones aún</div>';
      return;
    }

    // Section 1: FROM this concept (editable)
    if (relationsFromCache.length) {
      const header = document.createElement('div');
      header.className = 'wb-rel-section-header';
      header.innerHTML = '<span class="wb-rel-section-arrow">⬆</span> Desde este concepto';
      list.appendChild(header);

      relationsFromCache.forEach(rel => {
        const other = conceptosCache.find(c => c.id === rel.concepto_destino_id);
        const rt = RELATION_TYPES[rel.tipo_relacion] || { emoji: '❓', label: rel.tipo_relacion, color: '#888', bg: 'rgba(136,136,136,0.15)' };

        const card = document.createElement('div');
        card.className = 'wb-rel-card';
        card.innerHTML = `
          <div class="wb-rel-card-icon" style="border-color:${rt.color}">
            ${other?.icono_url ? `<img src="${other.icono_url}" alt="">` : `<span>${rt.emoji}</span>`}
          </div>
          <div class="wb-rel-card-info">
            <div class="wb-rel-card-name">${other?.titulo || 'Concepto eliminado'}</div>
            <div class="wb-rel-card-type" style="background:${rt.bg};color:${rt.color}">${rt.emoji} ${rt.label}</div>
            ${rel.notas ? `<div class="wb-rel-card-notes">${rel.notas}</div>` : ''}
          </div>
          <button class="wb-rel-card-delete" title="Eliminar relación">✕</button>`;

        card.querySelector('.wb-rel-card-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('¿Eliminar esta relación?')) return;
          await deleteRelation(rel.id, 'from');
        });
        card.addEventListener('click', () => { if (other) openConceptDetail(other); });
        list.appendChild(card);
      });
    }

    // Section 2: TO this concept (readonly — what others say about me)
    if (relationsToCache.length) {
      const header = document.createElement('div');
      header.className = 'wb-rel-section-header wb-rel-section-to';
      header.innerHTML = '<span class="wb-rel-section-arrow">⬇</span> Hacia este concepto';
      list.appendChild(header);

      relationsToCache.forEach(rel => {
        const other = conceptosCache.find(c => c.id === rel.concepto_origen_id);
        const rt = RELATION_TYPES[rel.tipo_relacion] || { emoji: '❓', label: rel.tipo_relacion, color: '#888', bg: 'rgba(136,136,136,0.15)' };

        const card = document.createElement('div');
        card.className = 'wb-rel-card wb-rel-card-passive';
        card.innerHTML = `
          <div class="wb-rel-card-icon" style="border-color:${rt.color};opacity:0.7">
            ${other?.icono_url ? `<img src="${other.icono_url}" alt="">` : `<span>${rt.emoji}</span>`}
          </div>
          <div class="wb-rel-card-info">
            <div class="wb-rel-card-name" style="opacity:0.8">${other?.titulo || 'Concepto eliminado'}</div>
            <div class="wb-rel-card-type" style="background:${rt.bg};color:${rt.color};opacity:0.8">${rt.emoji} ${rt.label}</div>
            <div class="wb-rel-card-direction" style="font-size:9px;color:rgba(255,255,255,0.3);font-family:'Etna';margin-top:2px">declarado por ${other?.titulo || '?'}</div>
          </div>`;
        card.addEventListener('click', () => { if (other) openConceptDetail(other); });
        list.appendChild(card);
      });
    }
  }

  async function deleteRelation(relId, source = 'from') {
    // 1. Get the relation details first to find its inverse
    const { data: rel } = await sb.from('concepto_relaciones').select('*').eq('id', relId).single();
    
    if (rel) {
        // 2. Delete the record
        await sb.from('concepto_relaciones').delete().eq('id', relId);

        // 3. Try to find and delete the inverse pair
        // The inverse has swapped origin/destination and potentially an inverse type
        // To be safe, we delete any relation between these two that matches the reciprocal pattern
        const invType = INVERSE_RELATIONS[rel.tipo_relacion];
        if (invType) {
            await sb.from('concepto_relaciones').delete()
                .eq('concepto_origen_id', rel.concepto_destino_id)
                .eq('concepto_destino_id', rel.concepto_origen_id)
                .eq('tipo_relacion', invType);
        }
    }
    
    // 4. Update global caches
    globalRelationsCache.from = {};
    globalRelationsCache.to = {};

    if (currentConcepto) loadRelations(currentConcepto); 
  }

  function openNewRelationModal() {
    relSelectedTarget = null;
    relSelectedType = null;
    editingRelationId = null; // Reset edit state if opening new
    document.getElementById('saveNewRelationBtn').textContent = '¡Crear Relación!';
    document.getElementById('relationSearchInput').value = '';
    document.getElementById('relationSearchResults').innerHTML = '';
    document.getElementById('relationSelectedTarget').style.display = 'none';
    document.getElementById('relationNotes').value = '';
    document.getElementById('relationIntensity').value = 5;
    document.getElementById('intensityVal').textContent = '5';
    document.getElementById('relationSecret').checked = false;

    // Build type grid — category-specific
    const grid = document.getElementById('relationTypeGrid');
    grid.innerHTML = '';
    const typesForThis = getRelationTypesForConcept(currentConcepto);
    Object.entries(typesForThis).forEach(([key, rt]) => {
      const btn = document.createElement('button');
      btn.className = 'wb-rel-type-btn';
      btn.dataset.type = key;
      btn.style.setProperty('--rel-color', rt.color);
      btn.style.setProperty('--rel-bg', rt.bg);
      btn.style.setProperty('--rel-shadow', rt.bg);
      btn.innerHTML = `<span class="rt-emoji">${rt.emoji}</span><span class="rt-label">${rt.label}</span>`;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.wb-rel-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        relSelectedType = key;
      });
      grid.appendChild(btn);
    });

    window.ANIM.show(document.getElementById('modalNewRelation'), 'anim-modal-in');
  }

  function closeRelationModal() {
    window.ANIM.hide(document.getElementById('modalNewRelation'), 'anim-modal-out');
  }

  function searchConceptsForRelation(query) {
    const results = document.getElementById('relationSearchResults');
    results.innerHTML = '';
    if (!query || query.length < 2) return;
    const q = query.toLowerCase();
    const matches = conceptosCache
      .filter(c => c.id !== currentConcepto.id && (c.titulo || '').toLowerCase().includes(q))
      .slice(0, 8);
    if (!matches.length) {
      results.innerHTML = '<div class="wb-rel-empty">Sin resultados</div>';
      return;
    }
    matches.forEach(c => {
      const item = document.createElement('div');
      item.className = 'wb-rel-search-item';
      item.innerHTML = `
        <div class="wb-rel-search-item-icon">
          ${c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(c.plantillas_concepto?.nombre || '')}
        </div>
        <span class="wb-rel-search-item-name">${c.titulo || 'Sin título'}</span>
        <span class="wb-rel-search-item-type">${c.plantillas_concepto?.nombre || ''}</span>`;
      item.addEventListener('click', () => selectRelationTarget(c));
      results.appendChild(item);
    });
  }

  function selectRelationTarget(concepto) {
    relSelectedTarget = concepto;
    document.getElementById('relationSearchResults').innerHTML = '';
    document.getElementById('relationSearchInput').style.display = 'none';
    const target = document.getElementById('relationSelectedTarget');
    target.style.display = 'flex';
    target.innerHTML = `
      <div class="wb-rel-search-item-icon">
        ${concepto.icono_url ? `<img src="${concepto.icono_url}" alt="">` : typeIcon(concepto.plantillas_concepto?.nombre || '')}
      </div>
      <span class="wb-rel-search-item-name">${concepto.titulo}</span>
      <span class="wb-rel-search-item-type">${concepto.plantillas_concepto?.nombre || ''}</span>
      <button class="wb-rel-selected-clear">✕</button>`;
    target.querySelector('.wb-rel-selected-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      relSelectedTarget = null;
      target.style.display = 'none';
      document.getElementById('relationSearchInput').style.display = '';
      document.getElementById('relationSearchInput').value = '';
    });
  }

  async function saveNewRelation() {
    if (!relSelectedTarget) { alert('Selecciona un concepto objetivo.'); return; }
    if (!relSelectedType) { alert('Selecciona un tipo de relación.'); return; }

    const rawNotes = document.getElementById('relationNotes').value.trim();
    const intensity = document.getElementById('relationIntensity').value;
    const isSecret = document.getElementById('relationSecret').checked;

    // Pack metadata into notes field
    const finalNotes = `${rawNotes} [INT:${intensity},SEC:${isSecret}]`.trim();

    const isUpdate = !!editingRelationId;

    if (isUpdate) {
        // Find and delete the old pair to avoid duplicates
        const { data: oldRel } = await sb.from('concepto_relaciones').select('*').eq('id', editingRelationId).single();
        if (oldRel) {
            await sb.from('concepto_relaciones').delete().eq('id', editingRelationId);
            const oldInvType = INVERSE_RELATIONS[oldRel.tipo_relacion];
            if (oldInvType) {
                await sb.from('concepto_relaciones').delete()
                    .eq('concepto_origen_id', oldRel.concepto_destino_id)
                    .eq('concepto_destino_id', oldRel.concepto_origen_id)
                    .eq('tipo_relacion', oldInvType);
            }
        }
    }

    const { data, error } = await sb.from('concepto_relaciones').insert({
      mundo_id: worldId,
      concepto_origen_id: currentConcepto.id,
      concepto_destino_id: relSelectedTarget.id,
      tipo_relacion: relSelectedType,
      notas: finalNotes
    }).select().single();

    if (error) { alert('Error al crear relación: ' + error.message); return; }
    
    // Automation: Inverse Relation
    const inverseType = INVERSE_RELATIONS[relSelectedType];
    if (inverseType) {
        await sb.from('concepto_relaciones').insert({
            mundo_id: worldId,
            concepto_origen_id: relSelectedTarget.id,
            concepto_destino_id: currentConcepto.id,
            tipo_relacion: inverseType,
            notas: `(Relación recíproca automática) [INT:${intensity},SEC:${isSecret}]`
        });
    }

    // Reset UI state
    editingRelationId = null;
    document.getElementById('saveNewRelationBtn').textContent = '¡Crear Relación!';
    
    // Update global caches
    globalRelationsCache.from = {};
    globalRelationsCache.to = {};

    showToast(isUpdate ? 'Relación actualizada' : 'Relación creada con éxito', 'success');
    loadRelations(currentConcepto); 
    closeRelationModal();
    showSaveIndicator();
  }

  // Helper for Modal setup
  document.getElementById('relationIntensity')?.addEventListener('input', (e) => {
    document.getElementById('intensityVal').textContent = e.target.value;
  });

  // ── BLOCKS CRUD ───────────────────────────
  async function loadBlocks(concepto) {
    if (!concepto) return;
    const grid = document.getElementById('blocksGrid'), empty = document.getElementById('blocksEmpty');
    if (grid) grid.innerHTML = ''; 
    if (empty) empty.style.display = 'flex';

    // 1. Check global cache
    if (globalBlocksCache[concepto.id]) {
      blocksData = globalBlocksCache[concepto.id];
      // We still need currentContentId for subsequent adds/edits
      // So fetch content ID if not already known
      if (blocksData.length > 0) {
        currentContentId = blocksData[0].contenido_id;
      } else {
        // Empty concept, we need to fetch/ensure content ID
        let { data: cont } = await sb.from('contenidos').select('id').eq('titulo', concepto.id).eq('tipo_plantilla', 'wb_concepto').maybeSingle();
        if (!cont) {
          const { data: newCont } = await sb.from('contenidos').insert({ proyecto_id: projectId, titulo: concepto.id, tipo_plantilla: 'wb_concepto', creado_por: currentUser.id }).select().single();
          cont = newCont;
        }
        currentContentId = cont?.id;
      }

      if (blocksData.length) {
        empty.style.display = 'none';
        blocksData.forEach(b => renderBlock(b));
        renderInserter(grid, blocksData.length);
      }
      return;
    }

    // 2. Fallback to fetch
    let { data: cont } = await sb.from('contenidos').select('id').eq('titulo', concepto.id).eq('tipo_plantilla', 'wb_concepto').maybeSingle();
    if (!cont) {
      const { data: newCont } = await sb.from('contenidos').insert({ proyecto_id: projectId, titulo: concepto.id, tipo_plantilla: 'wb_concepto', creado_por: currentUser.id }).select().single();
      cont = newCont;
    }
    currentContentId = cont?.id;
    if (!currentContentId) return;
    const { data: bqs } = await sb.from('bloques').select('*').eq('contenido_id', currentContentId).order('orden', { ascending: true });
    blocksData = bqs || [];
    
    // Update cache
    globalBlocksCache[concepto.id] = blocksData;

    if (blocksData.length) {
      empty.style.display = 'none';
      blocksData.forEach(b => renderBlock(b));
      renderInserter(grid, blocksData.length);
    }
  }

  async function addBlock(type, atPosition) {
    if (!currentContentId) return;
    const pos = (atPosition !== undefined) ? atPosition : blocksData.length;
    const defaults = { texto: { texto: '' }, imagen: { url: '' }, tablero: { imageData: '' }, locacion: { region_id: null, region_name: '', is_location: false, location_id: null } };
    const { data: nb } = await sb.from('bloques').insert({ contenido_id: currentContentId, tipo: type, data: defaults[type] || {}, orden: pos }).select().single();
    if (!nb) return;
    // Insert at position
    blocksData.splice(pos, 0, nb);
    
    // Sync with cache
    if (currentConcepto) {
      globalBlocksCache[currentConcepto.id] = blocksData;
    }

    rebuildBlocksGrid();
    showSaveIndicator();
    updateBlockOrders();
  }

  function rebuildBlocksGrid() {
    const grid = document.getElementById('blocksGrid');
    const empty = document.getElementById('blocksEmpty');
    grid.innerHTML = '';
    if (!blocksData.length) { empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    blocksData.forEach(b => renderBlock(b));
    renderInserter(grid, blocksData.length);
  }

  async function deleteBlock(blockId) {
    blocksData = blocksData.filter(b => b.id !== blockId);
    
    // Sync with cache
    if (currentConcepto) {
      globalBlocksCache[currentConcepto.id] = blocksData;
    }

    await sb.from('bloques').delete().eq('id', blockId);
    rebuildBlocksGrid();
  }

  // ── Inline Inserter ─────────────────────────
  function renderInserter(grid, position) {
    const ins = document.createElement('div');
    ins.className = 'wb-block-inserter';
    ins.dataset.position = position;
    ins.innerHTML = `
      <div class="wb-block-inserter-line"></div>
      <button class="wb-block-inserter-btn">+</button>
      <div class="wb-inserter-menu">
        <button class="wb-inserter-menu-btn" data-block="texto"><span class="im-icon">📝</span><span class="im-label">Texto</span></button>
        <button class="wb-inserter-menu-btn" data-block="imagen"><span class="im-icon">🖼</span><span class="im-label">Imagen</span></button>
        <button class="wb-inserter-menu-btn" data-block="tablero"><span class="im-icon">✏️</span><span class="im-label">Tablero</span></button>
        <button class="wb-inserter-menu-btn" data-block="locacion"><span class="im-icon">🗺</span><span class="im-label">Locación</span></button>
      </div>`;

    const plusBtn = ins.querySelector('.wb-block-inserter-btn');
    const menu = ins.querySelector('.wb-inserter-menu');

    plusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllInserterMenus();
      menu.classList.add('visible');
    });

    menu.querySelectorAll('.wb-inserter-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.block;
        const pos = parseInt(ins.dataset.position);
        menu.classList.remove('visible');
        addBlock(type, pos);
      });
    });

    grid.appendChild(ins);
  }

  function closeAllInserterMenus() {
    document.querySelectorAll('.wb-inserter-menu.visible').forEach(m => m.classList.remove('visible'));
    // Also close floating insert menus
    document.querySelectorAll('.wb-float-insert-menu').forEach(m => m.remove());
  }

  function showInsertAfterMenu(anchorBtn, position) {
    closeAllInserterMenus();
    const menu = document.createElement('div');
    menu.className = 'wb-float-insert-menu';
    menu.innerHTML = `
      <button class="wb-inserter-menu-btn" data-block="texto"><span class="im-icon">📝</span><span class="im-label">Texto</span></button>
      <button class="wb-inserter-menu-btn" data-block="imagen"><span class="im-icon">🖼</span><span class="im-label">Imagen</span></button>
      <button class="wb-inserter-menu-btn" data-block="tablero"><span class="im-icon">✏️</span><span class="im-label">Tablero</span></button>
      <button class="wb-inserter-menu-btn" data-block="locacion"><span class="im-icon">🗺</span><span class="im-label">Locación</span></button>`;
    document.body.appendChild(menu);

    // Position near the button
    const rect = anchorBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '9999';

    menu.querySelectorAll('.wb-inserter-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        addBlock(btn.dataset.block, position);
      });
    });

    // Auto-close on outside click
    setTimeout(() => {
      const handler = () => { menu.remove(); document.removeEventListener('click', handler); };
      document.addEventListener('click', handler);
    }, 10);
  }

  const BLOCK_TYPE_LABELS = { texto: '📝 Texto', imagen: '🖼 Imagen', tablero: '✏️ Tablero', locacion: '🗺 Locación' };
  const DRAG_DOTS_SVG = `<svg width="8" height="14" viewBox="0 0 10 16" fill="rgba(255,255,255,0.3)"><circle cx="2" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>`;

  function renderBlock(block) {
    const grid = document.getElementById('blocksGrid');
    const el = document.createElement('div');
    el.className = `wb-block wb-block-${block.tipo}`;
    el.dataset.id = block.id;

    // Apply container customization
    if (!block.data.style) block.data.style = {};
    const s = block.data.style;

    // Default span if not set
    if (!s.span) {
      s.span = 12;
    }
    el.dataset.span = s.span;
    el.style.gridColumn = `span ${s.span}`;

    // Build new compact HTML structure
    el.innerHTML = `
      <div class="wb-block-header" draggable="true">
        <div class="wb-block-drag-dots">${DRAG_DOTS_SVG}</div>
        <span class="wb-block-type-label">${BLOCK_TYPE_LABELS[block.tipo] || block.tipo.toUpperCase()}</span>
      </div>
      <div class="wb-block-float-toolbar">
        <button class="wb-block-float-btn btn-insert" title="Insertar bloque después">+</button>
        <button class="wb-block-float-btn btn-width" title="Cambiar ancho">${s.span}/12</button>
        <button class="wb-block-float-btn btn-settings" title="Personalizar">⚙</button>
        <button class="wb-block-float-btn btn-delete" title="Eliminar">✕</button>
      </div>
      <div class="wb-block-inline-settings" id="bis-${block.id}"></div>
      <div class="wb-block-content" id="bc-${block.id}"></div>
      <div class="wb-block-footnote ${block.data.footnote ? 'visible' : ''}" id="bfn-${block.id}">${block.data.footnote || ''}</div>
      <div class="wb-block-resizer"></div>`;

    if (block.data.footnoteSize) {
      const fnEl = el.querySelector('.wb-block-footnote');
      if (fnEl) fnEl.style.fontSize = block.data.footnoteSize + 'px';
    }

    if (s.backgroundColor) el.style.backgroundColor = s.backgroundColor;
    if (s.minHeight) el.style.minHeight = s.minHeight + 'px';
    if (s.padding !== undefined) el.querySelector('.wb-block-content').style.padding = s.padding + 'px';

    // ── Floating toolbar actions ──
    el.querySelector('.btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este bloque?')) return;
      await deleteBlock(block.id);
    });

    el.querySelector('.btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleInlineSettings(block, el);
    });

    el.querySelector('.btn-width').addEventListener('click', (e) => {
      e.stopPropagation();
      cycleBlockWidth(block, el);
    });

    // Insert After — opens a mini menu
    const insertBtn = el.querySelector('.btn-insert');
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const blockIdx = blocksData.findIndex(b => b.id === block.id);
      showInsertAfterMenu(insertBtn, blockIdx + 1);
    });

    // ── Resizer ──
    el.querySelector('.wb-block-resizer').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      startResizing(e, el, block);
    });

    el.querySelector('.wb-block-resizer').addEventListener('touchstart', (e) => {
      e.stopPropagation();
      startResizing(e.touches[0], el, block);
    }, { passive: false });

    setupBlockDrag(el);

    const contentEl = el.querySelector('.wb-block-content');
    switch (block.tipo) {
      case 'texto': renderTextBlock(contentEl, block); break;
      case 'imagen': renderImageBlock(contentEl, block); break;
      case 'tablero': renderTableroBlock(contentEl, block); break;
      case 'locacion': renderLocacionBlock(contentEl, block, el); break;
    }
    updateBlockScaling(el, block, s.minHeight || 150);
    grid.appendChild(el);

    // Masonry layout — make blocks stack tightly in their columns
    const obs = new ResizeObserver(() => updateBlockMasonry(el));
    obs.observe(el);
    setTimeout(() => updateBlockMasonry(el), 10);
  }

  function updateBlockMasonry(el) {
    if (!el || !el.isConnected) return;
    const height = el.getBoundingClientRect().height;
    el.style.gridRowEnd = `span ${Math.ceil(height + 20)}`;
  }

  // ── Width cycling ──
  function cycleBlockWidth(block, el) {
    const widths = [4, 6, 8, 12];
    const current = block.data.style?.span || 12;
    const idx = widths.indexOf(current);
    const next = widths[(idx + 1) % widths.length];
    block.data.style.span = next;
    el.dataset.span = next;
    el.style.gridColumn = `span ${next}`;
    // Update button label
    const btn = el.querySelector('.btn-width');
    if (btn) btn.textContent = `${next}/12`;
    scheduleSave();
  }

  // ── Inline Settings Panel ──
  function toggleInlineSettings(block, el) {
    const panel = el.querySelector('.wb-block-inline-settings');
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
      return;
    }
    // Close any other open panels
    document.querySelectorAll('.wb-block-inline-settings.open').forEach(p => p.classList.remove('open'));
    const s = block.data.style || {};
    panel.innerHTML = buildInlineSettingsHTML(block, s);
    panel.classList.add('open');
    setupInlineSettingsEvents(block, el, panel);
  }

  function buildInlineSettingsHTML(block, s) {
    const isText = block.tipo === 'texto';
    return `
      <div class="wb-inline-settings-row">
        <div class="wb-inline-settings-group">
          <span class="wb-inline-settings-label">Fondo</span>
          <input type="color" class="wb-inline-settings-color" data-prop="bg" value="${s.backgroundColor || '#3e2a5a'}">
        </div>
        <div class="wb-inline-settings-group">
          <span class="wb-inline-settings-label">Pad</span>
          <input type="range" class="wb-inline-settings-input" data-prop="padding" min="0" max="60" step="2" value="${s.padding !== undefined ? s.padding : 18}" style="width:50px">
        </div>
        <div class="wb-is-divider"></div>
        <div class="wb-inline-settings-group" style="flex:1">
          <span class="wb-inline-settings-label">Nota al pie</span>
          <input type="text" class="wb-inline-settings-input" data-prop="footnote" value="${block.data.footnote || ''}" placeholder="Añadir nota..." style="width:100%">
        </div>
        <div class="wb-inline-settings-group">
          <span class="wb-inline-settings-label">Tamaño N.</span>
          <input type="number" class="wb-inline-settings-input" data-prop="footnoteSize" value="${block.data.footnoteSize || 11}" min="8" max="24" style="width:40px">
        </div>
      </div>
      <div class="wb-inline-settings-row">
        ${isText ? `
          <div class="wb-inline-settings-group">
            <span class="wb-inline-settings-label">Color</span>
            <input type="color" class="wb-inline-settings-color" data-prop="textColor" value="${s.color || '#ffffff'}">
          </div>
          <div class="wb-inline-settings-group">
            <span class="wb-inline-settings-label">Tamaño</span>
            <input type="number" class="wb-inline-settings-input" data-prop="fontSize" value="${s.fontSize || 14}" min="10" max="48" style="width:40px">
          </div>
          <div class="wb-is-divider"></div>
          <button class="wb-is-style-btn ${s.bold ? 'active' : ''}" data-toggle="bold"><b>B</b></button>
          <button class="wb-is-style-btn ${s.italic ? 'active' : ''}" data-toggle="italic"><i>I</i></button>
          <button class="wb-is-style-btn ${s.underline ? 'active' : ''}" data-toggle="underline"><u>U</u></button>
          <div class="wb-is-divider"></div>
          <button class="wb-is-style-btn ${s.align === 'left' || !s.align ? 'active' : ''}" data-align="left">⫷</button>
          <button class="wb-is-style-btn ${s.align === 'center' ? 'active' : ''}" data-align="center">☰</button>
          <button class="wb-is-style-btn ${s.align === 'right' ? 'active' : ''}" data-align="right">⫸</button>
        ` : ''}
      </div>`;
  }

  function setupInlineSettingsEvents(block, el, panel) {
    // Footnote text
    panel.querySelector('[data-prop="footnote"]')?.addEventListener('input', (e) => {
      const val = e.target.value;
      block.data.footnote = val;
      const fnEl = el.querySelector('.wb-block-footnote');
      if (fnEl) {
        fnEl.textContent = val;
        fnEl.classList.toggle('visible', !!val);
      }
      scheduleSave();
    });

    // Footnote Size
    panel.querySelector('[data-prop="footnoteSize"]')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      block.data.footnoteSize = val;
      const fnEl = el.querySelector('.wb-block-footnote');
      if (fnEl) fnEl.style.fontSize = val + 'px';
      scheduleSave();
    });

    // Background color
    panel.querySelector('[data-prop="bg"]')?.addEventListener('input', (e) => {
      block.data.style.backgroundColor = e.target.value;
      el.style.backgroundColor = e.target.value;
      scheduleSave();
    });

    // Padding
    panel.querySelector('[data-prop="padding"]')?.addEventListener('input', (e) => {
      block.data.style.padding = parseInt(e.target.value);
      el.querySelector('.wb-block-content').style.padding = e.target.value + 'px';
      scheduleSave();
    });

    // Text color
    panel.querySelector('[data-prop="textColor"]')?.addEventListener('input', (e) => {
      block.data.style.color = e.target.value;
      const content = el.querySelector('[contenteditable]');
      if (content) content.style.color = e.target.value;
      scheduleSave();
    });

    // Font size
    panel.querySelector('[data-prop="fontSize"]')?.addEventListener('input', (e) => {
      block.data.style.fontSize = parseInt(e.target.value);
      const content = el.querySelector('[contenteditable]');
      if (content) content.style.fontSize = e.target.value + 'px';
      scheduleSave();
    });

    // Bold / Italic / Underline toggles
    panel.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const prop = btn.dataset.toggle;
        block.data.style[prop] = btn.classList.contains('active');
        const content = el.querySelector('[contenteditable]');
        if (content) {
          if (prop === 'bold') content.style.fontWeight = block.data.style.bold ? 'bold' : '';
          if (prop === 'italic') content.style.fontStyle = block.data.style.italic ? 'italic' : '';
          if (prop === 'underline') content.style.textDecoration = block.data.style.underline ? 'underline' : '';
        }
        scheduleSave();
      });
    });

    // Alignment
    panel.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        block.data.style.align = btn.dataset.align;
        const content = el.querySelector('[contenteditable]');
        if (content) content.style.textAlign = btn.dataset.align;
        scheduleSave();
      });
    });
  }

  // ── Text block ────────────────────────────
  function renderTextBlock(el, block) {
    const div = document.createElement('div');
    div.contentEditable = 'true'; div.spellcheck = false;

    // Base style - exactly match the page's premium feel
    let css = 'min-height:88px;font-family:"Etna", sans-serif;font-size:15px;line-height:1.7;color:#ffffff;outline:none;white-space:pre-wrap;word-break:break-word;';

    // Custom styles
    if (block.data?.style) {
      const s = block.data.style;
      if (s.fontSize) css += `font-size:${s.fontSize}px;`;
      if (s.color) css += `color:${s.color};`;
      if (s.bold) css += `font-weight:bold;`;
      if (s.italic) css += `font-style:italic;`;
      if (s.underline) css += `text-decoration:underline;`;
      if (s.align) css += `text-align:${s.align};`;
      if (s.padding !== undefined) css += `padding:${s.padding}px;`; else css += 'padding:16px 18px;';
    } else {
      css += 'padding:16px 18px;';
    }

    div.style.cssText = css;
    div.innerHTML = parseTextWithMentions(block.data?.texto || '');
    div.addEventListener('input', () => { block.data = { ...block.data, texto: div.innerText }; scheduleSave(); handleMentionDetection(div); });
    div.addEventListener('keydown', (e) => handleMentionKeydown(e));
    div.addEventListener('blur', () => { hideMentionDropdown(); scheduleSave(); });
    el.appendChild(div);
  }

  function parseTextWithMentions(text) {
    return text.replace(/\[([^\]]+)\]\(concepto:([^)]+)\)/g, (_, name, id) => `<span class="wb-mention-link" data-id="${id}" contenteditable="false">${name}</span>`);
  }

  // ── Image block ───────────────────────────
  function renderImageBlock(el, block) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    el.appendChild(input);
    const renderImg = () => {
      // clear all but input
      [...el.children].forEach(c => { if (c !== input) c.remove(); });
      if (block.data?.url) {
        const img = document.createElement('img');
        img.src = block.data.url;
        img.style.cssText = 'width:100%; height:100%; display:block; object-fit:contain; cursor:pointer;';
        img.addEventListener('click', () => input.click());
        el.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'wb-img-placeholder';
        ph.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:44px 20px;cursor:pointer;';
        ph.innerHTML = '<div class="wb-img-icon">🖼</div><span>Haz clic para subir imagen</span>';
        ph.addEventListener('click', () => input.click());
        el.appendChild(ph);
      }
    };
    renderImg();
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "custom");
      if (cropped) {
        block.data = { ...block.data, url: cropped };
        scheduleSave();
        renderImg();
      }
    });
  }

  // ── Tablero block ─────────────────────────
  function renderTableroBlock(el, block) {
    const W = 700, H = 380;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'width:100%;height:auto;display:block;background:#faf7f2;cursor:crosshair;';
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (block.data?.imageData) {
      const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = block.data.imageData;
    }
    const toolbar = document.createElement('div');
    toolbar.className = 'wb-tablero-toolbar';
    toolbar.innerHTML = `
      <button class="active" data-tool="brush" title="Pincel">🖌</button>
      <button data-tool="eraser" title="Borrador">🧹</button>
      <input type="color" class="wb-tablero-color" value="#000000" title="Color">
      <input type="range" class="wb-tablero-size tool-slider" min="1" max="30" value="4" style="width:64px">
      <button data-action="clear" title="Limpiar">🗑</button>`;
    el.appendChild(toolbar);

    let tool = 'brush', color = '#000000', size = 4, painting = false, lx = 0, ly = 0;
    toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => { toolbar.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); tool = btn.dataset.tool; });
    });
    toolbar.querySelector('[type=color]').addEventListener('input', e => color = e.target.value);
    toolbar.querySelector('[type=range]').addEventListener('input', e => size = +e.target.value);
    toolbar.querySelector('[data-action=clear]').addEventListener('click', () => { ctx.clearRect(0, 0, W, H); block.data = { ...block.data, imageData: '' }; scheduleSave(); });

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect(), sX = W / rect.width, sY = H / rect.height;
      const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (cx - rect.left) * sX, y: (cy - rect.top) * sY };
    };
    const start = e => { painting = true; const p = getPos(e); lx = p.x; ly = p.y; if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out'; else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; } ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
    const draw = e => { if (!painting) return; e.preventDefault(); const p = getPos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke(); lx = p.x; ly = p.y; };
    const end = () => { if (!painting) return; painting = false; ctx.globalCompositeOperation = 'source-over'; block.data = { ...block.data, imageData: canvas.toDataURL() }; scheduleSave(); };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', end);
  }

  // ── Location block — MAPA INTERACTIVO EMBEBIDO ────────────────────────
  function renderLocacionBlock(el, block, cardEl) {
    // ── DOM structure ──────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'wb-loc-block-mapwrap';

    // Canvas (imagen de fondo + formas)
    const canvas = document.createElement('canvas');
    canvas.className = 'wb-loc-block-canvas';

    // Capa de labels/pins (DOM, igual que el mapa principal)
    const labelsDiv = document.createElement('div');
    labelsDiv.className = 'wb-loc-block-labels';

    // Estado vacío
    const emptyEl = document.createElement('div');
    emptyEl.className = 'wb-loc-block-empty wb-loc-block-empty-abs';
    emptyEl.innerHTML = `<span style="font-size:34px">🗺</span><span>Sin locación seleccionada</span>
      <button class="wb-loc-block-pick-btn">Seleccionar en el mapa</button>`;

    // Botón de configuración (esquina superior derecha)
    const cfgBtn = document.createElement('button');
    cfgBtn.className = 'wb-loc-block-cfg-btn';
    cfgBtn.innerHTML = '⚙';
    cfgBtn.title = 'Cambiar locación';

    // Etiqueta inferior con nombre
    const nameEl = document.createElement('div');
    nameEl.className = 'wb-loc-block-name';

    wrapper.appendChild(canvas);
    wrapper.appendChild(labelsDiv);
    wrapper.appendChild(emptyEl);
    wrapper.appendChild(cfgBtn);
    el.appendChild(wrapper);
    el.appendChild(nameEl);

    // Visibilidad cfg btn
    cardEl.addEventListener('mouseenter', () => cfgBtn.style.opacity = '1');
    cardEl.addEventListener('mouseleave', () => cfgBtn.style.opacity = '0');

    // ── Estado local del mapa ──────────────────────────────────────────
    let lScale = 1;
    let lPan = { x: 0, y: 0 };
    let lPanning = false;
    let lPanStart = null;
    let lPanOrigin = null;
    let bgImgCache = null;
    let _initDone = false;
    let currentTargetShape = null;

    function applyLTransform() {
      const t = `translate(${lPan.x}px,${lPan.y}px) scale(${lScale})`;
      canvas.style.transform = t;
    }

    // Ajusta zoom/pan para encuadrar una forma
    function fitToShape(shape) {
      if (!shape?.points?.length) return;
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const shW = (maxX - minX) || 200, shH = (maxY - minY) || 200;
      const cW = wrapper.clientWidth || 500, cH = wrapper.clientHeight || 380;
      // Padding del 35% para ver contexto alrededor
      lScale = Math.min(cW / (shW * 1.7), cH / (shH * 1.7));
      lScale = Math.max(0.05, Math.min(20, lScale));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      lPan = { x: cW / 2 - cx * lScale, y: cH / 2 - cy * lScale };
      applyLTransform();
    }

    // Dibuja el mapa completo (fondo + regiones + locaciones)
    function drawMap() {
      if (!mapImage?.url && !mapRegions.length) return;
      canvas.width = _mapW; canvas.height = _mapH;
      const ctx = canvas.getContext('2d');

      const doDraw = (bgImg) => {
        ctx.clearRect(0, 0, _mapW, _mapH);
        if (bgImg) ctx.drawImage(bgImg, 0, 0, _mapW, _mapH);

        mapRegions.forEach(r => {
          if (!r.points?.length) return;
          const isHL = r.id === block.data?.region_id;
          ctx.fillStyle = hexToRgba(r.color, (r.opacity || 40) / 100);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = isHL ? 4 : 2;
          if (isHL) { ctx.shadowBlur = 14; ctx.shadowColor = r.color; }
          ctx.setLineDash([]);
          ctx.beginPath();
          r.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;

          (r.locations || []).forEach(loc => {
            if (!loc.points?.length) return;
            const isLocHL = loc.id === block.data?.location_id;
            ctx.fillStyle = hexToRgba(loc.color, 0.5);
            ctx.strokeStyle = loc.color;
            ctx.lineWidth = isLocHL ? 3 : 1.5;
            ctx.setLineDash([6, 3]);
            if (isLocHL) { ctx.shadowBlur = 10; ctx.shadowColor = loc.color; }
            ctx.beginPath();
            loc.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.setLineDash([]); ctx.shadowBlur = 0;
          });
        });
      };

      if (!mapImage?.url) { doDraw(null); return; }
      if (bgImgCache) { doDraw(bgImgCache); return; }
      bgImgCache = new Image();
      bgImgCache.onload = () => doDraw(bgImgCache);
      bgImgCache.src = mapImage.url;
    }

    // Renderiza los pins/labels (igual que renderMapRegionLabels pero local)
    function drawLabels() {
      labelsDiv.innerHTML = '';
      const allShapes = [];
      mapRegions.forEach(r => {
        allShapes.push({ data: r, type: 'region', parent: null });
        (r.locations || []).forEach(loc => allShapes.push({ data: loc, type: 'location', parent: r }));
      });

      allShapes.forEach(item => {
        const s = item.data;
        if (!s.points?.length) return;
        const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;

        const isTarget = (block.data && (s.id === block.data.region_id || s.id === block.data.location_id));
        const targetClass = isTarget ? ' target-location-pin' : '';

        const pin = document.createElement('div');
        pin.className = 'wb-map-pin' + (item.type === 'location' ? ' location-pin' : '') + targetClass;
        const sx = cx * lScale + lPan.x;
        const sy = cy * lScale + lPan.y;
        pin.style.cssText = `left:${sx}px;top:${sy}px;--shape-color:${s.color};--shape-color-alpha:${hexToRgba(s.color, 0.3)};--pin-scale:${mapLabelScale};pointer-events:auto;`;

        const inner = document.createElement('div');
        inner.className = 'wb-pin-inner';
        inner.style.cursor = 'pointer';
        inner.onclick = (e) => { e.stopPropagation(); openShapeView(s, item.type, item.parent); };

        const circle = document.createElement('div');
        circle.className = 'wb-pin-circle';
        const ic = s.icon || (item.type === 'region' ? '⬡' : '📍');
        circle.innerHTML = ic.startsWith('http') ? `<img src="${ic}" alt="">` : '';
        if (!ic.startsWith('http')) circle.textContent = ic;
        const tip = document.createElement('div'); tip.className = 'wb-pin-tip';
        inner.appendChild(circle); inner.appendChild(tip);

        const nameBox = document.createElement('div');
        nameBox.className = 'wb-pin-name';
        nameBox.textContent = s.name || (item.type === 'region' ? 'Región' : 'Locación');
        inner.appendChild(nameBox);

        pin.appendChild(inner);
        labelsDiv.appendChild(pin);
      });
    }

    // Render completo del bloque
    const render = () => {
      const regionId = block.data?.region_id;
      const locationId = block.data?.location_id;
      const displayName = block.data?.region_name || '';
      const hasData = !!(regionId || displayName);

      // Mostrar/ocultar estado vacío
      emptyEl.style.display = hasData ? 'none' : '';
      canvas.style.display = hasData ? '' : 'none';
      labelsDiv.style.display = hasData ? '' : 'none';
      nameEl.textContent = displayName ? `📍 ${displayName}` : '';

      if (!hasData) return;

      drawMap();

      // Auto-fit en la primera carga o cuando cambia la selección
      const region = mapRegions.find(r => r.id === regionId);
      const loc = locationId ? (region?.locations || []).find(l => l.id === locationId) : null;
      const targetShape = loc || region;
      currentTargetShape = targetShape;

      requestAnimationFrame(() => {
        if (targetShape && !_initDone) {
          fitToShape(targetShape);
          _initDone = true;
        }
        drawLabels();
      });
    };

    // ── Zoom ──────────────────────────────────────────────────────────
    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault(); e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.14 : 0.87;
      lScale = Math.max(0.05, Math.min(20, lScale * factor));
      applyLTransform();
      drawLabels();
    }, { passive: false });

    // ── Pan (drag) ────────────────────────────────────────────────────
    let lPanMoved = false;

    wrapper.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return;
      lPanning = true;
      lPanMoved = false;
      lPanStart = { x: e.clientX, y: e.clientY };
      lPanOrigin = { ...lPan };
      wrapper.style.cursor = 'grabbing';
    });
    wrapper.addEventListener('mousemove', (e) => {
      if (!lPanning) return;
      const dx = e.clientX - lPanStart.x;
      const dy = e.clientY - lPanStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) lPanMoved = true;
      lPan.x = lPanOrigin.x + dx;
      lPan.y = lPanOrigin.y + dy;
      applyLTransform();
      drawLabels();
    });
    wrapper.addEventListener('mouseup', (e) => {
      if (lPanning) {
        lPanning = false;
        wrapper.style.cursor = 'default';
        if (!lPanMoved && e.button === 2) {
          handleMapRightClick(e);
        }
      }
    });
    wrapper.addEventListener('mouseleave', () => { lPanning = false; wrapper.style.cursor = 'default'; });
    wrapper.addEventListener('contextmenu', e => e.preventDefault());

    function handleMapRightClick(e) {
      const rect = canvas.getBoundingClientRect();
      const mapX = (e.clientX - rect.left) / lScale;
      const mapY = (e.clientY - rect.top) / lScale;
      let targetShape = null;
      let targetType = null;
      
      for (const r of mapRegions) {
        for (const loc of (r.locations || [])) {
          if (pointInPolygon({ x: mapX, y: mapY }, loc.points)) { targetShape = loc; targetType = 'location'; break; }
        }
        if (targetShape) break;
      }
      if (!targetShape) {
        for (const r of mapRegions) {
          if (pointInPolygon({ x: mapX, y: mapY }, r.points)) { targetShape = r; targetType = 'region'; break; }
        }
      }
      
      if (targetShape) {
        showMapActionMenu(e.clientX, e.clientY, targetShape, targetType);
      }
    }

    // ── Click en canvas para abrir shapes ─────────────────────────────
    canvas.addEventListener('click', (e) => {
      if (e.button !== 0 || lPanMoved) return;
      const rect = canvas.getBoundingClientRect();
      const mapX = (e.clientX - rect.left) / lScale;
      const mapY = (e.clientY - rect.top) / lScale;
      for (const r of mapRegions) {
        for (const loc of (r.locations || [])) {
          if (pointInPolygon({ x: mapX, y: mapY }, loc.points)) { openShapeView(loc, 'location', r); return; }
        }
      }
      for (const r of mapRegions) {
        if (pointInPolygon({ x: mapX, y: mapY }, r.points)) { openShapeView(r, 'region', null); return; }
      }
    });

    // ── Botón "cambiar locación" ───────────────────────────────────────
    cfgBtn.addEventListener('click', (e) => { e.stopPropagation(); _initDone = false; openLocationPicker(block, render); });
    emptyEl.querySelector('.wb-loc-block-pick-btn')?.addEventListener('click', (e) => { e.stopPropagation(); _initDone = false; openLocationPicker(block, render); });

    el.onResizeContent = () => {
      if (currentTargetShape) {
        fitToShape(currentTargetShape);
        drawLabels();
      }
    };

    render();
  }

  function drawShapeMini(ctx, shape, w, h, isLoc = false, bgImg = null, hoverOffset = { x: 0, y: 0 }) {
    if (!shape?.points?.length) return;
    const xs = shape.points.map(p => p.x), ys = shape.points.map(p => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

    // Bounds in map space
    const sW = maxX - minX || 1, sH = maxY - minY || 1;

    // Display bounds
    const sX = (w * 0.9) / sW, sY = (h * 0.9) / sH, s = Math.min(sX, sY);

    // Apply hover offset to the base coordinates (in map space)
    const viewOffX = hoverOffset.x;
    const viewOffY = hoverOffset.y;

    const offX = (w - sW * s) / 2 - (minX + viewOffX) * s, offY = (h - sH * s) / 2 - (minY + viewOffY) * s;

    // Draw Map background
    if (bgImg) {
      const cropMargin = Math.max(sW, sH) * 0.8;
      const srX = Math.max(0, minX - cropMargin), srY = Math.max(0, minY - cropMargin);
      const srW = sW + cropMargin * 2, srH = sH + cropMargin * 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      // The map background also shifts with the hover
      ctx.drawImage(bgImg, srX, srY, srW, srH, (srX * s + offX), (srY * s + offY), (srW * s), (srH * s));

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.fillStyle = shape.color + (isLoc ? 'aa' : '44');
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = isLoc ? 2 : 3;
    ctx.beginPath();
    shape.points.forEach((p, i) => { const x = (p.x) * s + offX, y = (p.y) * s + offY; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function openLocationPicker(block, onSelect) {
    const modal = document.getElementById('modalSelectLocation');
    window.ANIM.show(modal, 'anim-modal-in');
    const canvas = document.getElementById('locationPickerCanvas');
    if (mapImage) {
      canvas.width = mapImage.w; canvas.height = mapImage.h;
      const ctx = canvas.getContext('2d');
      const img = new Image(); img.onload = () => {
        ctx.drawImage(img, 0, 0);
        drawAllShapesOnCtx(ctx);
      }; img.src = mapImage.url;
    } else {
      canvas.width = 600; canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d0620'; ctx.fillRect(0, 0, 600, 300);
      drawAllShapesOnCtx(ctx);
    }

    const pillsEl = document.getElementById('locationPickerRegions');
    pillsEl.innerHTML = '';
    let selectedRegionId = block.data?.region_id || null;
    let selectedLocationId = block.data?.location_id || null;

    mapRegions.forEach(r => {
      const pill = document.createElement('div');
      pill.className = 'wb-location-picker-pill' + (r.id === selectedRegionId && !selectedLocationId ? ' selected' : '');
      pill.style.borderColor = r.color;
      pill.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.color};margin-right:5px;vertical-align:middle"></span>${r.name || 'Sin nombre'}`;
      pill.addEventListener('click', () => {
        pillsEl.querySelectorAll('.wb-location-picker-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        selectedRegionId = r.id;
        selectedLocationId = null;
      });
      pillsEl.appendChild(pill);

      (r.locations || []).forEach(loc => {
        const lpill = document.createElement('div');
        lpill.className = 'wb-location-picker-pill' + (loc.id === selectedLocationId ? ' selected' : '');
        lpill.style.borderColor = loc.color; lpill.style.marginLeft = '16px';
        lpill.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${loc.color};margin-right:5px;vertical-align:middle;border:1px solid rgba(255,255,255,0.3)"></span>${loc.name || 'Locación'}`;
        lpill.addEventListener('click', () => {
          pillsEl.querySelectorAll('.wb-location-picker-pill').forEach(p => p.classList.remove('selected'));
          lpill.classList.add('selected');
          selectedRegionId = r.id;
          selectedLocationId = loc.id;
        });
        pillsEl.appendChild(lpill);
      });
    });

    document.getElementById('confirmLocationBtn').onclick = () => {
      if (selectedRegionId) {
        const r = mapRegions.find(x => x.id === selectedRegionId);
        const loc = selectedLocationId ? (r?.locations || []).find(l => l.id === selectedLocationId) : null;
        block.data = {
          ...block.data,
          region_id: r?.id, region_name: loc ? loc.name : (r?.name || 'Región'),
          location_id: loc?.id || null, is_location: !!loc
        };
        scheduleSave(); onSelect();
      }
      window.ANIM.hide(modal, 'anim-modal-out');
    };
    document.getElementById('cancelModalSelectLocation').onclick = () => window.ANIM.hide(modal, 'anim-modal-out');
    document.getElementById('closeModalSelectLocation').onclick = () => window.ANIM.hide(modal, 'anim-modal-out');
  }

  // ── Block drag-to-reorder ─────────────────
  function setupBlockDrag(el) {
    const header = el.querySelector('.wb-block-header');
    header.addEventListener('dragstart', (e) => { e.dataTransfer.setData('blockId', el.dataset.id); el.style.opacity = '0.5'; });
    header.addEventListener('dragend', () => { el.style.opacity = '1'; });
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.outline = '2px solid rgba(219,111,78,0.5)'; });
    el.addEventListener('dragleave', () => { el.style.outline = ''; });
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.style.outline = '';
      const draggedId = e.dataTransfer.getData('blockId');
      if (draggedId === el.dataset.id) return;
      // Reorder in blocksData
      const fromIdx = blocksData.findIndex(b => b.id === draggedId);
      const toIdx = blocksData.findIndex(b => b.id === el.dataset.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = blocksData.splice(fromIdx, 1);
      blocksData.splice(toIdx, 0, moved);
      rebuildBlocksGrid();
      updateBlockOrders();
    });
  }

  async function updateBlockOrders() {
    const updates = blocksData.map((b, idx) => ({ id: b.id, orden: idx }));
    for (const u of updates) await sb.from('bloques').update({ orden: u.orden }).eq('id', u.id);
  }

  function scheduleSave() { clearTimeout(blocksSaveTimer); blocksSaveTimer = setTimeout(saveBlocksNow, 1600); }

  async function saveBlocksNow() {
    if (!currentContentId) return;
    if (currentConcepto) {
      const newTitle = document.getElementById('cdTitle').textContent.trim();
      const heroDescNode = document.getElementById('cdHubHeroDesc');
      const newDesc = heroDescNode ? heroDescNode.textContent.trim() : null;
      
      let updates = {};
      let changed = false;

      if (newTitle && newTitle !== currentConcepto.titulo) {
        updates.titulo = newTitle;
        currentConcepto.titulo = newTitle;
        changed = true;
      }

      const isPlaceholder = (newDesc === 'Añade una descripción sobre este concepto aquí...');
      const descToSave = (newDesc && !isPlaceholder) ? newDesc : '';

      if (descToSave !== (currentConcepto.descripcion || '')) {
        updates.descripcion = descToSave;
        currentConcepto.descripcion = descToSave;
        changed = true;
      }

      if (changed) {
        await sb.from('conceptos').update(updates).eq('id', currentConcepto.id);
        const idx = conceptosCache.findIndex(c => c.id === currentConcepto.id);
        if (idx >= 0) Object.assign(conceptosCache[idx], updates);
      }
    }
    if (cdIconDataURL && currentConcepto) {
      try {
        if (typeof uploadToCloudinary === 'function') {
          const url = await uploadToCloudinary(dataURLtoBlob(cdIconDataURL), 'worldbuilding/iconos');
          await sb.from('conceptos').update({ icono_url: url }).eq('id', currentConcepto.id);
          currentConcepto.icono_url = url;
        }
      } catch (e) { }
      cdIconDataURL = null;
    }
    for (const block of blocksData) await sb.from('bloques').update({ data: block.data }).eq('id', block.id);
    showSaveIndicator();
  }

  function showSaveIndicator() {
    const ind = document.getElementById('wbSaveIndicator');
    ind.classList.add('visible');
    setTimeout(() => ind.classList.remove('visible'), 2200);
  }

  // ── CUSTOMIZATION ──────────────────────────
  function openBlockSettings(block) {
    currentSettingsBlock = block;
    const modal = document.getElementById('modalBlockSettings');
    const s = block.data?.style || {};

    document.getElementById('bsBgColor').value = s.backgroundColor || '#2e1c45';
    document.getElementById('bsPadding').value = s.padding !== undefined ? s.padding : 18;

    document.getElementById('bsTextColor').value = s.color || '#ffffff';
    document.getElementById('bsFontSize').value = s.fontSize || 14;

    // Style buttons
    const btns = document.querySelectorAll('#modalBlockSettings .wb-style-btn');
    btns.forEach(b => {
      b.classList.remove('active');
      const st = b.dataset.style;
      const al = b.dataset.align;
      if (st === 'bold' && s.bold) b.classList.add('active');
      if (st === 'italic' && s.italic) b.classList.add('active');
      if (st === 'underline' && s.underline) b.classList.add('active');
      if (al && s.align === al) b.classList.add('active');
    });

    // Hide text group if not text block (optional, but requested personalization is for text)
    // Actually the user wants to change text color etc. on the table, so maybe titles?
    // I'll keep it visible for now.

    window.ANIM.show(modal, 'anim-modal-in');
  }

  function closeBlockSettings() {
    window.ANIM.hide(document.getElementById('modalBlockSettings'), 'anim-modal-out');
    currentSettingsBlock = null;
  }

  async function applyBlockSettings() {
    if (!currentSettingsBlock) return;
    const s = currentSettingsBlock.data.style || {};

    s.backgroundColor = document.getElementById('bsBgColor').value;
    s.padding = document.getElementById('bsPadding').value;

    s.color = document.getElementById('bsTextColor').value;
    s.fontSize = document.getElementById('bsFontSize').value;

    s.bold = document.querySelector('[data-style="bold"]')?.classList.contains('active');
    s.italic = document.querySelector('[data-style="italic"]')?.classList.contains('active');
    s.underline = document.querySelector('[data-style="underline"]')?.classList.contains('active');

    const activeAlign = document.querySelector('#modalBlockSettings .wb-style-btn[data-align].active');
    s.align = activeAlign ? activeAlign.dataset.align : 'left';

    currentSettingsBlock.data.style = s;

    // Re-render all blocks
    rebuildBlocksGrid();

    scheduleSave();
    closeBlockSettings();
  }

  // ── RESIZING LOGIC ─────────────────────────
  let resizeState = {
    active: false,
    el: null,
    block: null,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    gridW: 0,
    startSpan: 0,
    sibling: null,
    siblingBlock: null,
    startSiblingSpan: 0
  };

  function startResizing(e, el, block) {
    const grid = document.getElementById('blocksGrid');
    const startSpan = parseInt(el.dataset.span) || 6;

    // Find sibling to the right on the same row
    let sibling = null;
    let siblingBlock = null;
    const allBlocks = Array.from(grid.querySelectorAll('.wb-block'));
    const myRect = el.getBoundingClientRect();

    // Find the closest block to the right with same vertical alignment
    let minDiffX = Infinity;
    allBlocks.forEach(b => {
      if (b === el) return;
      const r = b.getBoundingClientRect();
      const sameRow = Math.abs(r.top - myRect.top) < 15;
      const isRight = r.left > myRect.left;
      if (sameRow && isRight) {
        const diffX = r.left - myRect.right;
        if (diffX < minDiffX) {
          minDiffX = diffX;
          sibling = b;
        }
      }
    });

    if (sibling) {
      siblingBlock = blocksData.find(b => b.id == sibling.dataset.id);
    }

    resizeState = {
      active: true,
      el: el,
      block: block,
      startX: e.clientX,
      startY: e.clientY,
      startW: el.offsetWidth,
      startH: el.offsetHeight,
      gridW: grid.offsetWidth,
      startSpan: startSpan,
      sibling: sibling,
      siblingBlock: siblingBlock,
      startSiblingSpan: sibling ? (parseInt(sibling.dataset.span) || 6) : 0
    };
    el.classList.add('resizing');
    if (sibling) sibling.classList.add('resizing');

    document.addEventListener('mousemove', handleResizing);
    document.addEventListener('mouseup', stopResizing);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stopResizing);
  }

  function handleResizing(e) {
    if (!resizeState.active) return;

    requestAnimationFrame(() => {
      if (!resizeState.active) return;

      // Vertical
      const dy = e.clientY - resizeState.startY;
      const newH = Math.max(100, resizeState.startH + dy);
      resizeState.el.style.minHeight = newH + 'px';
      updateBlockScaling(resizeState.el, resizeState.block, newH);
      updateBlockMasonry(resizeState.el);

      // Horizontal
      const dx = e.clientX - resizeState.startX;
      const newW = Math.max(100, resizeState.startW + dx);

      const colW = (resizeState.gridW / 12);
      let span = Math.round(newW / colW);
      span = Math.max(2, Math.min(12, span));

      // Sibling logic
      if (resizeState.sibling) {
        const spanDelta = span - resizeState.startSpan;
        let sibSpan = resizeState.startSiblingSpan - spanDelta;

        // Safety limits
        if (sibSpan < 2) {
          sibSpan = 2;
          span = (resizeState.startSpan + resizeState.startSiblingSpan) - sibSpan;
        }

        if (parseInt(resizeState.sibling.dataset.span) !== sibSpan) {
          resizeState.sibling.dataset.span = sibSpan;
          resizeState.sibling.style.gridColumn = `span ${sibSpan}`;
        }
      }

      if (parseInt(resizeState.el.dataset.span) !== span) {
        resizeState.el.dataset.span = span;
        resizeState.el.style.gridColumn = `span ${span}`;
      }
    });
  }

  function stopResizing() {
    if (!resizeState.active) return;

    const finalH = parseInt(resizeState.el.style.minHeight);
    const finalSpan = parseInt(resizeState.el.dataset.span);

    resizeState.block.data.style = {
      ...resizeState.block.data.style,
      minHeight: finalH,
      span: finalSpan
    };

    if (resizeState.sibling && resizeState.siblingBlock) {
      resizeState.siblingBlock.data.style = {
        ...resizeState.siblingBlock.data.style,
        span: parseInt(resizeState.sibling.dataset.span)
      };
      resizeState.sibling.classList.remove('resizing');
    }

    resizeState.el.classList.remove('resizing');
    resizeState.active = false;

    document.removeEventListener('mousemove', handleResizing);
    document.removeEventListener('mouseup', stopResizing);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', stopResizing);

    scheduleSave();
  }

  function handleTouchMove(e) {
    if (resizeState.active) {
      handleResizing(e.touches[0]);
    }
  }

  function updateBlockScaling(el, block, height) {
    const content = el.querySelector('.wb-block-content');
    if (!content) return;

    if (block.tipo === 'texto') {
      // Scale font size based on height. 
      // Base: height ~150px -> 14px font. 
      // For every 100px more, add ~2px?
      const baseH = 150;
      const baseFs = block.data.style?.fontSize || 14;
      if (!block.data.style?.fontSize) {
          const newFs = Math.max(13, Math.min(32, 14 + (height - baseH) / 40));
          content.style.fontSize = newFs + 'px';
      }
    } else if (block.tipo === 'tablero') {
      const canvas = content.querySelector('canvas');
      if (canvas) {
          canvas.style.height = '100%';
          canvas.style.objectFit = 'contain';
      }
    } else if (block.tipo === 'locacion') {
      if (el.onResizeContent) el.onResizeContent();
    }
  }

  // ── MENTION SYSTEM ────────────────────────
  function handleMentionDetection(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const before = range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const slashIdx = before.lastIndexOf('/');
    if (slashIdx >= 0) {
      const query = before.slice(slashIdx + 1);
      if (!query.includes(' ') || query.length < 15) { mentionActive = true; mentionQuery = query; mentionRange = range.cloneRange(); mentionTargetEl = el; showMentionDropdown(range, query); return; }
    }
    hideMentionDropdown();
  }
  function handleMentionKeydown(e) {
    if (!mentionActive) return;
    const dropdown = document.getElementById('mentionDropdown');
    const items = dropdown.querySelectorAll('.wb-mention-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); mentionHighIdx = Math.min(mentionHighIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('highlighted', i === mentionHighIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mentionHighIdx = Math.max(mentionHighIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('highlighted', i === mentionHighIdx)); }
    else if (e.key === 'Enter' && mentionActive) { e.preventDefault(); items[mentionHighIdx]?.click(); }
    else if (e.key === 'Escape') hideMentionDropdown();
  }
  function showMentionDropdown(range, query) {
    const dropdown = document.getElementById('mentionDropdown');
    const matches = conceptosCache.filter(c => c.titulo?.toLowerCase().includes(query.toLowerCase()) && c.id !== currentConcepto?.id).slice(0, 8);
    if (!matches.length) { hideMentionDropdown(); return; }
    dropdown.innerHTML = ''; mentionHighIdx = 0;
    matches.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'wb-mention-item' + (idx === 0 ? ' highlighted' : '');
      item.innerHTML = `<div class="wb-mention-item-icon">${c.icono_url ? `<img src="${c.icono_url}" alt="">` : typeIcon(c.plantillas_concepto?.nombre || '')}</div><div><div class="wb-mention-item-name">${c.titulo}</div><div class="wb-mention-item-type">${c.plantillas_concepto?.nombre || ''}</div></div>`;
      item.addEventListener('mousedown', e => { e.preventDefault(); insertMention(c); });
      dropdown.appendChild(item);
    });
    const rect = range.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`; dropdown.style.top = `${rect.bottom + 4}px`;
    window.ANIM.show(dropdown, 'anim-fade-in');
  }
  function hideMentionDropdown() { mentionActive = false; window.ANIM.hide(document.getElementById('mentionDropdown'), 'anim-fade-out'); }
  function insertMention(concepto) {
    if (!mentionTargetEl) return;
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer; if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent, offset = sel.getRangeAt(0).startOffset, before = text.slice(0, offset);
    const slashIdx = before.lastIndexOf('/'); if (slashIdx < 0) return;
    const mention = document.createElement('span'); mention.className = 'wb-mention-link'; mention.dataset.id = concepto.id; mention.contentEditable = 'false'; mention.textContent = concepto.titulo;
    const range = document.createRange(); range.setStart(node, slashIdx); range.setEnd(node, offset); range.deleteContents(); range.insertNode(mention);
    const after = document.createTextNode('\u00A0'); mention.after(after);
    const newRange = document.createRange(); newRange.setStartAfter(after); newRange.collapse(true);
    sel.removeAllRanges(); sel.addRange(newRange);
    hideMentionDropdown(); scheduleSave();
  }

  // ══════════════════════════════════════════
  //  MAP EDITOR (Import + Polygon Regions/Locations)
  // ══════════════════════════════════════════
  function setupMapTab() {
    const canvasEl = document.getElementById('mapCanvas');
    const overlayEl = document.getElementById('mapOverlayCanvas');
    const relCanvas = document.getElementById('mapRelationsCanvas');
    const wrap = document.getElementById('mapCanvasWrap');

    const drawingCanvas = document.getElementById('mapDrawingCanvas');
    if (drawingCanvas) {
      drawingCanvas.width = _mapW; drawingCanvas.height = _mapH;
      mapDrawingCtx = drawingCanvas.getContext('2d');
    }

    applyMapTransform();
    startMapLoop();

    // Import handlers
    document.getElementById('mapImportInputMain').addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) handleMapImportWithData(cropped);
    });
    document.getElementById('mapReimportInput').addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "banner");
      if (cropped) handleMapImportWithData(cropped);
    });

    // Tools
    document.querySelectorAll('.wb-mft-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wb-mft-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mapTool = btn.dataset.tool;
        wrap.style.cursor = mapTool === 'select' ? 'default' : 'crosshair';
        // Cancel any in-progress polygon
        if (isDrawingPoly) cancelDrawing();
        updateHintBar();
      });
    });

    // Color + opacity
    const colorInput = document.getElementById('mapShapeColor');
    const opacityInput = document.getElementById('mapShapeOpacity');
    const colorLabel = document.getElementById('mapShapeColorLabel');
    const opacityVal = document.getElementById('mapShapeOpacityVal');
    colorInput.addEventListener('input', () => { colorLabel.textContent = colorInput.value; });
    opacityInput.addEventListener('input', () => { opacityVal.textContent = opacityInput.value + '%'; });

    // Save
    document.getElementById('mapSaveBtn').addEventListener('click', saveMapData);

    // Labels scale + mode
    const labelScaleInput = document.getElementById('mapLabelScale');
    const labelScaleVal = document.getElementById('mapLabelScaleVal');
    const labelModeSelect = document.getElementById('mapLabelMode');

    if (labelScaleInput) {
      labelScaleInput.addEventListener('input', () => {
        mapLabelScale = parseFloat(labelScaleInput.value);
        labelScaleVal.textContent = mapLabelScale.toFixed(1) + 'x';
        renderMapRegionLabels();
      });
    }
    if (labelModeSelect) {
      labelModeSelect.addEventListener('change', () => {
        mapLabelMode = labelModeSelect.value;
        renderMapRegionLabels();
      });
    }

    const showRacesInput = document.getElementById('mapShowRaces');
    if (showRacesInput) {
      showRacesInput.addEventListener('change', () => {
        mapShowRaces = showRacesInput.checked;
        if (mapShowRaces) {
          fetchMapRacesCache();
        } else {
          renderMapRegionLabels();
        }
      });
    }

    // Map panels collapse logic
    const mapHierColl = document.getElementById('mapHierCollapseBtn');
    if (mapHierColl) {
      mapHierColl.addEventListener('click', () => {
        document.getElementById('mapHierarchyPanel').classList.toggle('collapsed');
      });
    }

    const mapToolbarColl = document.getElementById('mapToolbarCollapseBtn');
    if (mapToolbarColl) {
      mapToolbarColl.addEventListener('click', () => {
        document.getElementById('mapFloatToolbar').classList.toggle('collapsed');
      });
    }

    // --- Map Panels Resizing Logic ---
    const savedTbW = localStorage.getItem('rk_mapToolbarW');
    if (savedTbW) document.getElementById('mapFloatToolbar').style.width = savedTbW;
    
    const savedHierW = localStorage.getItem('rk_mapHierW');
    if (savedHierW) document.getElementById('mapHierarchyPanel').style.width = savedHierW;

    const tbResize = document.getElementById('mapToolbarResize');
    const tbPanel = document.getElementById('mapFloatToolbar');
    if (tbResize && tbPanel) {
      let isResizingTb = false, startXTb, startWTb;
      tbResize.addEventListener('mousedown', e => {
        isResizingTb = true; startXTb = e.clientX; startWTb = tbPanel.getBoundingClientRect().width;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', e => {
        if (!isResizingTb) return;
        let newW = startWTb + (e.clientX - startXTb);
        if (newW < 140) newW = 140;
        if (newW > 400) newW = 400;
        tbPanel.style.width = newW + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (isResizingTb) {
          isResizingTb = false;
          localStorage.setItem('rk_mapToolbarW', tbPanel.style.width);
        }
      });
    }

    const hierResize = document.getElementById('mapHierResize');
    const hierPanel = document.getElementById('mapHierarchyPanel');
    if (hierResize && hierPanel) {
      let isResizingHier = false, startXHier, startWHier;
      hierResize.addEventListener('mousedown', e => {
        isResizingHier = true; startXHier = e.clientX; startWHier = hierPanel.getBoundingClientRect().width;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', e => {
        if (!isResizingHier) return;
        let newW = startWHier - (e.clientX - startXHier); // Pulling left increases right-panel width
        if (newW < 200) newW = 200;
        if (newW > 600) newW = 600;
        hierPanel.style.width = newW + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (isResizingHier) {
          isResizingHier = false;
          localStorage.setItem('rk_mapHierW', hierPanel.style.width);
        }
      });
    }

    // Fullscreen immersion logic
    const mapFsBtn = document.getElementById('mapFullscreenBtn');
    const mapFsCloseBtn = document.getElementById('mapFsCloseBtn');
    
    if (mapFsBtn) {
      mapFsBtn.addEventListener('click', () => {
        document.body.classList.add('wb-inmersive-map');
        
        // Force minimize chat regardless of current state
        const chatWin = document.getElementById('rkChatWindow');
        if (chatWin) {
          chatWin.classList.add('rkw--minimized');
        }
        
        // Force map resize check
        setTimeout(() => { if (window.requestMapUpdate) window.requestMapUpdate(); }, 100);
      });
    }
    
    if (mapFsCloseBtn) {
      mapFsCloseBtn.addEventListener('click', () => {
        document.body.classList.remove('wb-inmersive-map');
        setTimeout(() => { if (window.requestMapUpdate) window.requestMapUpdate(); }, 100);
      });
    }

    // Add region manually
    document.getElementById('mapAddRegionBtn').addEventListener('click', () => {
      mapTool = 'region';
      document.querySelectorAll('.wb-mft-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'region'));
      wrap.style.cursor = 'crosshair';
      updateHintBar();
    });

    // Hint bar cancel / undo
    document.getElementById('mapHintCancel').addEventListener('click', cancelDrawing);
    document.getElementById('mapHintUndo').addEventListener('click', undoLastPoint);

    // Canvas events
    canvasEl.addEventListener('click', onMapClick);
    canvasEl.addEventListener('dblclick', onMapDblClick);
    canvasEl.addEventListener('mousemove', onMapMouseMove);

    // Zoom / pan
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const rect = wrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate coordinates relative to the map (world coordinates)
      const worldX = (mouseX - mapPan.x) / mapScale;
      const worldY = (mouseY - mapPan.y) / mapScale;

      const factor = (e.deltaY < 0) ? 1.12 : 0.88;
      const newScale = Math.max(0.05, Math.min(12, mapScale * factor));
      
      // Adjust pan to keep world position under the mouse
      mapPan.x = mouseX - worldX * newScale;
      mapPan.y = mouseY - worldY * newScale;
      mapScale = newScale;

      applyMapTransform();
    }, { passive: false });

    wrap.addEventListener('mousedown', e => {
      dragMoved = false;
      const pos = getCanvasPos(e);
      panStart = { x: e.clientX, y: e.clientY };

      if (e.button === 0 && mapTool === 'select') {
        const hit = findShapeAtPoint(pos);
        if (hit) {
          isDraggingShape = true;
          draggedShape = hit.shape;
          draggedShapeType = hit.type;
          draggedShapeParent = hit.parent;
          dragStartPos = pos;
          initialPoints = hit.shape.points.map(p => ({ ...p }));
          
          if (hit.type === 'region') {
            initialChildrenPoints = (hit.shape.locations || []).map(loc => ({
              id: loc.id,
              points: loc.points.map(p => ({ ...p }))
            }));
          }
          
          wrap.style.cursor = 'grabbing';
          document.body.classList.add('wb-dragging-shape');
          renderMapShapes(); // Hide from base layer
          drawDraggedShape(); // Draw on top layer
          updateDraggedLabels();
          e.preventDefault();
          return;
        }
      }

      if (e.button === 1 || e.button === 2 || (e.button === 0 && mapTool === 'select')) {
        if (e.button !== 0 || mapTool === 'select') {
          e.preventDefault(); mapPanning = true; panOrigin = { ...mapPan };
          wrap.style.cursor = 'grabbing';
        }
      }
    });
    wrap.addEventListener('mousemove', e => {
      if (isDraggingShape) {
        if (!dragMoved && Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y) > DRAG_THRESHOLD) {
          dragMoved = true;
        }
        
        const pos = getCanvasPos(e);
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;
        
        if (draggedShapeType === 'location') {
          // Visual check for constraints with sliding fallback
          const checkOffset = (ox, oy) => {
            const newPoints = initialPoints.map(p => ({ x: p.x + ox, y: p.y + oy }));
            return newPoints.every(p => pointInPolygon(p, draggedShapeParent.points));
          };

          if (checkOffset(dx, dy)) {
            dragCurrentOffset = { x: dx, y: dy };
          } else {
            // Binary search to slide along the edges
            let bestX = dragCurrentOffset.x;
            let bestY = dragCurrentOffset.y;
            
            // X-axis slide
            if (checkOffset(dx, bestY)) {
               bestX = dx;
            } else {
               let minX = bestX, maxX = dx;
               for(let i=0; i<6; i++) {
                 let mid = (minX + maxX) / 2;
                 if (checkOffset(mid, bestY)) minX = mid; else maxX = mid;
               }
               bestX = minX;
            }

            // Y-axis slide
            if (checkOffset(bestX, dy)) {
               bestY = dy;
            } else {
               let minY = bestY, maxY = dy;
               for(let i=0; i<6; i++) {
                 let mid = (minY + maxY) / 2;
                 if (checkOffset(bestX, mid)) minY = mid; else maxY = mid;
               }
               bestY = minY;
            }
            
            dragCurrentOffset = { x: bestX, y: bestY };
          }
        } else {
          dragCurrentOffset = { x: dx, y: dy };
        }
        drawDraggedShape();
        updateDraggedLabels();
        return;
      }

      if (!mapPanning) return;
      if (!dragMoved && Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y) > DRAG_THRESHOLD) {
        dragMoved = true;
      }
      mapPan.x = panOrigin.x + (e.clientX - panStart.x);
      mapPan.y = panOrigin.y + (e.clientY - panStart.y);
      applyMapTransform();
    });
    wrap.addEventListener('mouseup', e => {
      if (isDraggingShape) {
        if (dragMoved) {
          // Commit movement
          const dx = dragCurrentOffset.x;
          const dy = dragCurrentOffset.y;
          
          if (draggedShapeType === 'location') {
            draggedShape.points = initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
          } else {
            draggedShape.points = initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
            (draggedShape.locations || []).forEach(loc => {
              const initLoc = initialChildrenPoints.find(ic => ic.id === loc.id);
              if (initLoc) {
                loc.points = initLoc.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
              }
            });
          }
          saveMapData();
        }

        isDraggingShape = false;
        draggedShape = null;
        dragCurrentOffset = { x: 0, y: 0 };
        if (mapDrawingCtx) mapDrawingCtx.clearRect(0, 0, _mapW, _mapH);
        renderMapShapes();
        renderMapRegionLabels();
        wrap.style.cursor = mapTool === 'select' ? 'default' : 'crosshair';
        document.body.classList.remove('wb-dragging-shape');
        return;
      }

      if (mapPanning) {
        mapPanning = false;
        wrap.style.cursor = mapTool === 'select' ? 'default' : 'crosshair';
      }
    });
    wrap.addEventListener('mouseleave', () => { mapPanning = false; });
    wrap.addEventListener('contextmenu', e => e.preventDefault());

    // Hierarchy search
    document.getElementById('mapHierSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.wb-hier-region').forEach(el => {
        const name = el.querySelector('.wb-hier-region-name')?.textContent.toLowerCase() || '';
        el.style.display = q && !name.includes(q) ? 'none' : '';
      });
    });
  }

  async function handleMapImportWithData(dataURL) {
    showToast('⏳ Subiendo mapa a la nube...');
    try {
      const blob = dataURLtoBlob(dataURL);
      const imageUrl = await uploadToCloudinary(blob, 'worldbuilding/maps');
      const img = new Image();
      img.onload = () => {
        _mapW = img.width; _mapH = img.height;
        const canvasEl = document.getElementById('mapCanvas');
        const overlayEl = document.getElementById('mapOverlayCanvas');
        const relCanvas = document.getElementById('mapRelationsCanvas');
        canvasEl.width = _mapW; canvasEl.height = _mapH;
        overlayEl.width = _mapW; overlayEl.height = _mapH;
        if (relCanvas) { relCanvas.width = _mapW; relCanvas.height = _mapH; }

        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(img, 0, 0);
        mapImage = { url: imageUrl, w: _mapW, h: _mapH };

        // Show active area
        window.ANIM.hide(document.getElementById('mapEmptyState'), 'anim-fade-out');
        window.ANIM.show(document.getElementById('mapActiveArea'), 'anim-fade-in');

        mapScale = 1; mapPan = { x: 0, y: 0 };
        fitMapToContainer();
        renderMapShapes();
        renderHierarchyTree();
        mapDirty = true;
        saveMapData();
      };
      img.src = imageUrl;
    } catch (err) {
      console.error(err);
      showToast('✖ Error al subir mapa', 'error');
    }
  }

  function fitMapToContainer() {
    const wrap = document.getElementById('mapCanvasWrap');
    const wW = wrap.clientWidth || 800, wH = wrap.clientHeight || 600;
    mapScale = Math.min(wW / _mapW, wH / _mapH) * 0.9;
    mapPan = { x: (wW - _mapW * mapScale) / 2, y: (wH - _mapH * mapScale) / 2 };
    applyMapTransform();
  }

  function applyMapTransform() {
    const t = `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapScale})`;
    document.getElementById('mapCanvas').style.transform = t;
    document.getElementById('mapOverlayCanvas').style.transform = t;
    const drawingCanvas = document.getElementById('mapDrawingCanvas');
    if (drawingCanvas) drawingCanvas.style.transform = t;
    const relCanvas = document.getElementById('mapRelationsCanvas');
    if (relCanvas) relCanvas.style.transform = t;
    requestMapUpdate();
  }

  function requestMapUpdate() {
    mapUpdatePending = true;
  }

  function startMapLoop() {
    if (window._mapLoopActive) return;
    window._mapLoopActive = true;
    function loop() {
      if (mapUpdatePending) {
        mapUpdatePending = false;
        renderMapRegionLabels();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function getCanvasPos(e) {
    const canvas = document.getElementById('mapCanvas');
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / mapScale, y: (e.clientY - rect.top) / mapScale };
  }

  function updateHintBar() {
    const bar = document.getElementById('mapHintBar');
    const txt = document.getElementById('mapHintText');
    if (mapTool === 'region' || mapTool === 'location') {
      window.ANIM.show(bar, 'anim-fade-in');
      if (mapTool === 'location') {
        const parent = mapTool === 'location' && drawingParentId ? mapRegions.find(r => r.id === drawingParentId) : null;
        txt.textContent = parent ? `Trazando locación en "${parent.name}" · Clic = punto · Doble clic = cerrar` : `Primero selecciona una región en el panel derecho, luego traza aquí`;
      } else {
        txt.textContent = `Trazando región · Clic = añadir punto · Doble clic = cerrar forma`;
      }
    } else {
      window.ANIM.hide(bar, 'anim-fade-out');
      if (isDrawingPoly) cancelDrawing();
    }
  }

  function cancelDrawing() {
    isDrawingPoly = false; polygonPoints = [];
    renderMapShapes();
    window.ANIM.hide(document.getElementById('mapHintBar'), 'anim-fade-out');
  }

  function undoLastPoint() {
    if (polygonPoints.length) { polygonPoints.pop(); renderMapShapes(); }
  }

  function onMapClick(e) {
    if (mapPanning || dragMoved) return;
    
    // Clear relations on click
    if (activeRelationLines.length > 0) {
      activeRelationSource = null;
      activeRelationLines = [];
      renderMapShapes();
    }

    if (mapTool === 'select') {
      // Check if clicking inside a shape
      const pos = getCanvasPos(e);
      const hit = findShapeAtPoint(pos);
      if (hit) { openShapeView(hit.shape, hit.type, hit.parent); return; }
      selectedShapeId = null;
      renderMapShapes();
      return;
    }
    if (mapTool === 'region' || mapTool === 'location') {
      // For location tool, require a parent region to be selected
      if (mapTool === 'location' && !drawingParentId) { showToast('ℹ Selecciona una región en el panel primero', 'error'); return; }
      isDrawingPoly = true;
      const pos = getCanvasPos(e);

      // Close polygon if clicking near first point (≥3 points)
      if (polygonPoints.length >= 3) {
        const fp = polygonPoints[0];
        if (Math.hypot(pos.x - fp.x, pos.y - fp.y) < 15 / mapScale) {
          finishPolygon(); return;
        }
      }
      polygonPoints.push(pos);
      renderMapShapes();
    }
  }

  function onMapDblClick(e) {
    if ((mapTool === 'region' || mapTool === 'location') && polygonPoints.length >= 3) {
      finishPolygon();
    }
  }

  function onMapMouseMove(e) {
    if (!isDrawingPoly || !polygonPoints.length) return;
    const pos = getCanvasPos(e);
    renderMapShapes(pos); // pass cursor pos to draw live preview line
  }

  function findShapeAtPoint(pos) {
    // Check locations first (they're smaller / on top)
    for (const r of mapRegions) {
      for (const loc of (r.locations || [])) {
        if (pointInPolygon(pos, loc.points)) return { shape: loc, type: 'location', parent: r };
      }
    }
    for (const r of mapRegions) {
      if (pointInPolygon(pos, r.points)) return { shape: r, type: 'region', parent: null };
    }
    return null;
  }

  function pointInPolygon(pt, points) {
    if (!points?.length) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y, xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function finishPolygon() {
    if (polygonPoints.length < 3) { showToast('ℹ Se necesitan al menos 3 puntos', 'error'); return; }
    const pts = [...polygonPoints];
    polygonPoints = []; isDrawingPoly = false;

    if (mapTool === 'region') {
      isEditingShape = false;
      document.getElementById('modalNewRegionTitle').textContent = 'Nueva Región';
      document.getElementById('saveNewRegionBtn').textContent = '¡CREAR REGIÓN!';
      // Pre-fill color input value
      document.getElementById('regionColor').value = document.getElementById('mapShapeColor').value;
      document.getElementById('regionName').value = '';
      document.getElementById('regionDesc').value = '';
      // Store pending points temporarily
      _pendingPolygon = pts;
      _pendingPolygonType = 'region';
      window.ANIM.show(document.getElementById('modalNewRegion'), 'anim-modal-in');
    } else if (mapTool === 'location') {
      isEditingShape = false;
      document.getElementById('modalNewLocationTitle').textContent = 'Nueva Locación';
      document.getElementById('saveNewLocationBtn').textContent = '¡CREAR LOCACIÓN!';
      document.getElementById('locationColor').value = document.getElementById('mapShapeColor').value;
      document.getElementById('locationName').value = '';
      document.getElementById('locationDesc').value = '';
      const parentRegion = mapRegions.find(r => r.id === drawingParentId);
      document.getElementById('locationParentName').textContent = parentRegion?.name || 'Región';
      _pendingPolygon = pts;
      _pendingPolygonType = 'location';
      window.ANIM.show(document.getElementById('modalNewLocation'), 'anim-modal-in');
    }
    renderMapShapes();
  }

  let _pendingPolygon = null, _pendingPolygonType = null;

  function drawAllShapesOnCtx(ctx) {
    const scale = ctx.canvas.width / _mapW;
    mapRegions.forEach(r => {
      if (!r.points?.length) return;
      const op = ((r.opacity || 40) / 100);
      ctx.fillStyle = hexToRgba(r.color, op);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      r.points.forEach((p, i) => { const x = p.x * scale, y = p.y * scale; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      (r.locations || []).forEach(loc => {
        if (!loc.points?.length) return;
        ctx.fillStyle = hexToRgba(loc.color, 0.5);
        ctx.strokeStyle = loc.color;
        ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
        ctx.beginPath();
        loc.points.forEach((p, i) => { const x = p.x * scale, y = p.y * scale; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      });
    });
  }

  function renderMapShapes(cursorPos) {
    const overlay = document.getElementById('mapOverlayCanvas');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, _mapW, _mapH);

    if (mapDrawingCtx) mapDrawingCtx.clearRect(0, 0, _mapW, _mapH);

    const relCanvas = document.getElementById('mapRelationsCanvas');
    let relCtx = null;
    if (relCanvas) {
      relCtx = relCanvas.getContext('2d');
      relCtx.clearRect(0, 0, _mapW, _mapH);
    }

    // Draw regions
    mapRegions.forEach(r => {
      if (!r.points?.length) return;
      if (isDraggingShape && draggedShape?.id === r.id) return;

      const isSelected = r.id === selectedShapeId;
      const op = (r.opacity || 40) / 100;
      ctx.fillStyle = hexToRgba(r.color, op);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      
      if (isSelected) { 
        ctx.shadowBlur = 12; 
        ctx.shadowColor = r.color; 
      }
      
      ctx.beginPath();
      r.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // Locations within region
      (r.locations || []).forEach(loc => {
        if (!loc.points?.length) return;
        if (isDraggingShape && (draggedShape?.id === loc.id || draggedShape?.id === r.id)) return;

        const locSelected = loc.id === selectedShapeId;
        ctx.fillStyle = hexToRgba(loc.color, 0.5);
        ctx.strokeStyle = loc.color;
        ctx.lineWidth = locSelected ? 2.5 : 1.5;
        ctx.setLineDash([6, 3]);
        
        if (locSelected) { 
          ctx.shadowBlur = 8; 
          ctx.shadowColor = loc.color; 
        }
        
        ctx.beginPath();
        loc.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
      });
    });

    // Draw in-progress polygon on dedicated layer
    if (isDrawingPoly && polygonPoints.length && mapDrawingCtx) {
      const activeColor = mapTool === 'location' ? '#db6f4e' : '#5a8fd4';
      mapDrawingCtx.fillStyle = hexToRgba(activeColor, 0.15);
      mapDrawingCtx.strokeStyle = activeColor;
      mapDrawingCtx.lineWidth = 2; mapDrawingCtx.setLineDash([7, 3]);
      mapDrawingCtx.beginPath();
      polygonPoints.forEach((p, i) => i === 0 ? mapDrawingCtx.moveTo(p.x, p.y) : mapDrawingCtx.lineTo(p.x, p.y));
      if (cursorPos) mapDrawingCtx.lineTo(cursorPos.x, cursorPos.y);
      mapDrawingCtx.stroke(); mapDrawingCtx.setLineDash([]);

      // Point dots
      polygonPoints.forEach((p, i) => {
        mapDrawingCtx.fillStyle = i === 0 ? activeColor : 'white';
        mapDrawingCtx.strokeStyle = 'rgba(0,0,0,0.5)'; mapDrawingCtx.lineWidth = 1;
        mapDrawingCtx.beginPath(); mapDrawingCtx.arc(p.x, p.y, i === 0 ? 6 / mapScale : 4 / mapScale, 0, Math.PI * 2);
        mapDrawingCtx.fill(); mapDrawingCtx.stroke();
      });
      // Close indicator near first point
      if (polygonPoints.length >= 3 && cursorPos) {
        const fp = polygonPoints[0];
        const dist = Math.hypot(cursorPos.x - fp.x, cursorPos.y - fp.y);
        if (dist < 18 / mapScale) {
          mapDrawingCtx.strokeStyle = activeColor; mapDrawingCtx.lineWidth = 2;
          mapDrawingCtx.beginPath(); mapDrawingCtx.arc(fp.x, fp.y, 8 / mapScale, 0, Math.PI * 2); mapDrawingCtx.stroke();
        }
      }
    }

    // Draw active relation lines
    if (activeRelationLines && activeRelationLines.length > 0) {
      const centroids = {};
      mapRegions.forEach(r => {
        if (r.points?.length) centroids[r.id] = { x: r.points.reduce((s,p)=>s+p.x,0)/r.points.length, y: r.points.reduce((s,p)=>s+p.y,0)/r.points.length };
        (r.locations || []).forEach(loc => {
           if(loc.points?.length) centroids[loc.id] = { x: loc.points.reduce((s,p)=>s+p.x,0)/loc.points.length, y: loc.points.reduce((s,p)=>s+p.y,0)/loc.points.length };
        });
      });

      activeRelationLines.forEach(line => {
        const p1 = centroids[line.sourceShapeId];
        const p2 = centroids[line.targetShapeId];
        if (!p1 || !p2) return;

        const relTypeObj = RELATION_TYPES[line.type] || { emoji: '🔗', label: line.type, color: '#fff' };

        if (!relCtx) return;

        relCtx.strokeStyle = relTypeObj.color;
        relCtx.lineWidth = 3 / mapScale;
        relCtx.setLineDash([10 / mapScale, 8 / mapScale]);
        relCtx.shadowBlur = 10;
        relCtx.shadowColor = relTypeObj.color;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) return; // Prevent division by zero

        relCtx.beginPath();
        relCtx.moveTo(p1.x, p1.y);

        // Vector paralelo (dirección de P1 a P2)
        const parX = dx / dist;
        const parY = dy / dist;

        // Vector perpendicular
        let perpX = -dy / dist;
        let perpY = dx / dist;

        // "Siempre hacia arriba" (-Y) en la pantalla
        if (perpY > 0) {
           perpX = -perpX;
           perpY = -perpY;
        }

        // Altura base de la curva (lo suficiente para elevarse por encima de los iconos)
        // y ensanchamiento mínimo (spread) para que la curva no sea una "aguja" si están muy juntas.
        const curveHeight = 140; 
        const spread = Math.max(140, dist * 0.25); 

        // Puntos de control esparcidos hacia los lados y elevados
        const cp1X = p1.x - parX * (spread / 2) + perpX * curveHeight;
        const cp1Y = p1.y - parY * (spread / 2) + perpY * curveHeight;

        const cp2X = p2.x + parX * (spread / 2) + perpX * curveHeight;
        const cp2Y = p2.y + parY * (spread / 2) + perpY * curveHeight;

        relCtx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, p2.x, p2.y);
        
        // El punto máximo de la curva Bezier cúbica (t=0.5) para ubicar la etiqueta
        const mx = 0.125 * p1.x + 0.375 * cp1X + 0.375 * cp2X + 0.125 * p2.x;
        const my = 0.125 * p1.y + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * p2.y;

        relCtx.stroke();
        
        relCtx.setLineDash([]);
        relCtx.shadowBlur = 0;

        const label = relTypeObj.emoji + ' ' + relTypeObj.label;

        const fSize = 12 / mapScale;
        relCtx.font = `${fSize}px "Etna", sans-serif`;
        const txtWidth = relCtx.measureText(label).width;
        const padX = 8 / mapScale;
        const padY = 6 / mapScale;
        const rectH = fSize + (padY*2.5);

        relCtx.fillStyle = 'rgba(20,10,35,0.85)';
        relCtx.beginPath();
        if (relCtx.roundRect) {
          relCtx.roundRect(mx - txtWidth/2 - padX, my - rectH/2, txtWidth + padX*2, rectH, 6 / mapScale);
        } else {
          relCtx.rect(mx - txtWidth/2 - padX, my - rectH/2, txtWidth + padX*2, rectH);
        }
        relCtx.fill();
        relCtx.strokeStyle = relTypeObj.color;
        relCtx.lineWidth = 1.5 / mapScale;
        relCtx.stroke();

        relCtx.fillStyle = '#fff';
        relCtx.textAlign = 'center';
        relCtx.textBaseline = 'middle';
        relCtx.fillText(label, mx, my);
      });
    }

    requestMapUpdate();
  }

  function drawDraggedShape() {
    if (!mapDrawingCtx || !isDraggingShape || !draggedShape) return;
    mapDrawingCtx.clearRect(0, 0, _mapW, _mapH);
    
    if (draggedShapeType === 'region') {
      const op = (draggedShape.opacity || 40) / 100;
      mapDrawingCtx.fillStyle = hexToRgba(draggedShape.color, op + 0.2);
      mapDrawingCtx.strokeStyle = draggedShape.color;
      mapDrawingCtx.lineWidth = 3;
      mapDrawingCtx.shadowBlur = 20; 
      mapDrawingCtx.shadowColor = draggedShape.color; 
      
      mapDrawingCtx.beginPath();
      draggedShape.points.forEach((p, i) => {
        const x = p.x + dragCurrentOffset.x;
        const y = p.y + dragCurrentOffset.y;
        i === 0 ? mapDrawingCtx.moveTo(x, y) : mapDrawingCtx.lineTo(x, y);
      });
      mapDrawingCtx.closePath(); mapDrawingCtx.fill(); mapDrawingCtx.stroke();
      mapDrawingCtx.shadowBlur = 0;

      (draggedShape.locations || []).forEach(loc => {
        if (!loc.points?.length) return;
        mapDrawingCtx.fillStyle = hexToRgba(loc.color, 0.8);
        mapDrawingCtx.strokeStyle = loc.color;
        mapDrawingCtx.lineWidth = 2.5;
        mapDrawingCtx.setLineDash([6, 3]);
        
        mapDrawingCtx.beginPath();
        loc.points.forEach((p, i) => {
          const x = p.x + dragCurrentOffset.x;
          const y = p.y + dragCurrentOffset.y;
          i === 0 ? mapDrawingCtx.moveTo(x, y) : mapDrawingCtx.lineTo(x, y);
        });
        mapDrawingCtx.closePath(); mapDrawingCtx.fill(); mapDrawingCtx.stroke();
        mapDrawingCtx.setLineDash([]);
      });
    } else if (draggedShapeType === 'location') {
      mapDrawingCtx.fillStyle = hexToRgba(draggedShape.color, 0.8);
      mapDrawingCtx.strokeStyle = draggedShape.color;
      mapDrawingCtx.lineWidth = 2.5;
      mapDrawingCtx.setLineDash([6, 3]);
      mapDrawingCtx.shadowBlur = 15; 
      mapDrawingCtx.shadowColor = draggedShape.color; 
      
      mapDrawingCtx.beginPath();
      draggedShape.points.forEach((p, i) => {
        const x = p.x + dragCurrentOffset.x;
        const y = p.y + dragCurrentOffset.y;
        i === 0 ? mapDrawingCtx.moveTo(x, y) : mapDrawingCtx.lineTo(x, y);
      });
      mapDrawingCtx.closePath(); mapDrawingCtx.fill(); mapDrawingCtx.stroke();
      mapDrawingCtx.setLineDash([]); mapDrawingCtx.shadowBlur = 0;
    }
  }

  function updateDraggedLabels() {
    if (!isDraggingShape || !draggedShape) return;
    
    const updatePin = (s) => {
      const pinObj = mapPinCache[s.id];
      if (!pinObj || !pinObj.el) return;
      
      const cx = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
      const cy = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;

      const screenX = (cx + dragCurrentOffset.x) * mapScale + mapPan.x;
      const screenY = (cy + dragCurrentOffset.y) * mapScale + mapPan.y;
      
      pinObj.el.style.left = screenX + 'px';
      pinObj.el.style.top = screenY + 'px';
    };

    if (draggedShapeType === 'region') {
      updatePin(draggedShape);
      (draggedShape.locations || []).forEach(loc => updatePin(loc));
    } else {
      updatePin(draggedShape);
    }
  }

  async function fetchMapRacesCache() {
    showToast('⏳ Cargando razas en el mapa...', 'success');
    
    try {
      const { data: bqs } = await sb.from('bloques')
        .select(`data, contenidos!inner(titulo)`)
        .eq('tipo', 'locacion');
      
      mapRacesCache = {};
      if (bqs) {
        bqs.forEach(b => {
          const rid = b.data?.region_id;
          const lid = b.data?.location_id;
          const cid = b.contenidos?.titulo;
          if (cid) {
            const c = conceptosCache.find(x => x.id === cid);
            if (c && c.plantillas_concepto?.nombre?.toLowerCase() === 'raza') {
               if (rid && !mapRacesCache[rid]) mapRacesCache[rid] = [];
               if (lid && !mapRacesCache[lid]) mapRacesCache[lid] = [];
               if (rid) mapRacesCache[rid].push(c);
               if (lid) mapRacesCache[lid].push(c);
            }
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
    renderMapRegionLabels();
  }

  async function fetchAndShowRaceRelations(raceConcept, shapeId) {
    if (activeRelationSource === shapeId) {
      // Toggle off if clicking the same
      activeRelationSource = null;
      activeRelationLines = [];
      renderMapShapes();
      return;
    }
    activeRelationSource = shapeId;
    activeRelationLines = [];

    showToast('Cargando relaciones...', 'success');
    try {
      // Unilateral: only show relations FROM this race (what this race declares)
      const { data: rels } = await sb.from('concepto_relaciones')
        .select('*')
        .eq('concepto_origen_id', raceConcept.id);

      if (rels && rels.length > 0) {
        // Map relationships to other pins on the map
        // Ensure mapRacesCache holds target races. mapRacesCache is { shape_id: [concepts] }
        // We need to invert this to concept_id -> shape_id for fast lookup
        const conceptToShape = {};
        for (const sId in mapRacesCache) {
          const arr = mapRacesCache[sId];
          arr.forEach(c => { conceptToShape[c.id] = sId; });
        }

        const lines = [];
        rels.forEach(r => {
          // All rels are origin-based (unilateral), target is always destino
          const targetId = r.concepto_destino_id;
          const targetShapeId = conceptToShape[targetId];

          if (targetShapeId && targetShapeId !== shapeId) {
            lines.push({
              sourceShapeId: shapeId,
              targetShapeId: targetShapeId,
              type: r.tipo_relacion
            });
          }
        });

        activeRelationLines = lines;
        if (lines.length > 0) {
          renderMapShapes();
        } else {
          showToast('No hay relaciones mapeadas visualmente.', 'info');
        }
      } else {
        showToast('Esta raza no tiene relaciones registradas.', 'info');
      }
    } catch (e) {
      console.error(e);
      showToast('Error cargando relaciones', 'error');
    }
  }

  function renderMapRegionLabels() {
    const labelsEl = document.getElementById('mapRegionLabels');
    if (!labelsEl) return;
    
    if (mapLabelMode === 'none') {
      labelsEl.style.display = 'none';
      return;
    }
    labelsEl.style.display = '';

    const wrap = document.getElementById('mapCanvasWrap');
    if (!wrap) return;
    const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;

    // Reset usage status
    for (const id in mapPinCache) mapPinCache[id].used = false;

    const allShapes = [];
    mapRegions.forEach(r => {
      allShapes.push({ data: r, type: 'region', parent: null });
      (r.locations || []).forEach(loc => {
        allShapes.push({ data: loc, type: 'location', parent: r });
      });
    });

    allShapes.forEach(item => {
      const s = item.data;
      if (!s.points?.length) return;

      const cx = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
      const cy = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;

      const screenX = cx * mapScale + mapPan.x;
      const screenY = cy * mapScale + mapPan.y;

      // Culling with margin
      const margin = 100 * mapScale;
      if (screenX < -margin || screenX > wrapW + margin || screenY < -margin || screenY > wrapH + margin) return;

      let pinObj = mapPinCache[s.id];
      if (!pinObj) {
        // Create new
        const pin = document.createElement('div');
        pin.className = 'wb-map-pin' + (item.type === 'location' ? ' location-pin' : '');
        labelsEl.appendChild(pin);
        pinObj = { el: pin, used: true, lastMode: null, lastShowRaces: null, lastItemType: item.type };
        mapPinCache[s.id] = pinObj;
      }
      
      pinObj.used = true;
      pinObj.el.style.display = '';
      
      pinObj.el.style.left = screenX + 'px';
      pinObj.el.style.top = screenY + 'px';

      // Re-render internal content if mode or race-toggle changed
      if (pinObj.lastMode !== mapLabelMode || pinObj.lastShowRaces !== mapShowRaces || pinObj.lastItemType !== item.type) {
        pinObj.lastMode = mapLabelMode;
        pinObj.lastShowRaces = mapShowRaces;
        pinObj.lastItemType = item.type;
        
        let overridePinColor = s.color;
        let overrideIconContent = s.icon || (item.type === 'region' ? '⬡' : '📍');
        let overrideName = s.name || (item.type === 'region' ? 'Región' : 'Locación');

        if (mapShowRaces && mapRacesCache && mapRacesCache[s.id] && mapRacesCache[s.id].length > 0) {
          const rc = mapRacesCache[s.id][0];
          overrideIconContent = rc.icono_url || typeIcon('Raza'); overrideName = rc.titulo;
        }

        pinObj.el.innerHTML = '';
        pinObj.el.style.setProperty('--shape-color', overridePinColor);
        pinObj.el.style.setProperty('--shape-color-alpha', hexToRgba(overridePinColor, 0.3));
        pinObj.el.style.setProperty('--pin-scale', mapLabelScale);

        const inner = document.createElement('div');
        inner.className = 'wb-pin-inner';
        inner.onclick = () => openShapeView(s, item.type, item.parent);
        
        if (mapShowRaces && mapRacesCache && mapRacesCache[s.id] && mapRacesCache[s.id].length > 0) {
          const rc = mapRacesCache[s.id][0];
          inner.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); fetchAndShowRaceRelations(rc, s.id); };
        }

        if (mapLabelMode === 'both' || mapLabelMode === 'icon') {
          const circle = document.createElement('div'); circle.className = 'wb-pin-circle';
          if (overrideIconContent.startsWith('http') || overrideIconContent.startsWith('data:')) {
            circle.innerHTML = `<img src="${overrideIconContent}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          } else circle.textContent = overrideIconContent;
          inner.appendChild(circle);
          const tip = document.createElement('div'); tip.className = 'wb-pin-tip';
          inner.appendChild(tip);
        }
        if (mapLabelMode === 'both' || mapLabelMode === 'name') {
          const nameBox = document.createElement('div'); nameBox.className = 'wb-pin-name';
          nameBox.textContent = overrideName;
          inner.appendChild(nameBox);
        }
        pinObj.el.appendChild(inner);
      } else {
        // Just update existing scale property if simple mode didn't change
        pinObj.el.style.setProperty('--pin-scale', mapLabelScale);
      }
    });

    // Clean up unused
    for (const id in mapPinCache) {
      if (!mapPinCache[id].used) mapPinCache[id].el.style.display = 'none';
    }
  }

  function openShapeView(shape, type, parent) {
    selectedShapeId = shape.id;
    renderMapShapes();

    const modal = document.getElementById('modalViewShape');
    if (!modal) return;

    // Header & Banner logic
    const banner = document.getElementById('viewShapeBanner');
    const landscapes = shape.landscapes || [];
    if (landscapes.length > 0) {
      banner.style.backgroundImage = `url("${landscapes[0]}")`;
    } else {
      // Clear JS override to let CSS gradient show
      banner.style.backgroundImage = ''; 
    }

    document.getElementById('viewShapeName').textContent = shape.name || (type === 'region' ? 'Región' : 'Locación');
    document.getElementById('viewShapeDesc').textContent = shape.desc || '';
    
    // Toggle description visibility if empty
    document.getElementById('viewShapeDesc').style.display = shape.desc ? 'block' : 'none';

    const typeBadge = document.getElementById('viewShapeType');
    if (typeBadge) typeBadge.textContent = type === 'region' ? 'REGIÓN' : 'LOCACIÓN';

    const iconEl = document.getElementById('viewShapeIcon');
    iconEl.innerHTML = '';
    let iconContent = shape.icon || (type === 'region' ? '⬡' : '📍');
    if (iconContent.startsWith('http')) {
      iconEl.innerHTML = `<img src="${iconContent}" alt="">`;
    } else {
      iconEl.textContent = iconContent;
    }
    iconEl.style.borderColor = shape.color;

    // Landscapes Section
    const landscapesSection = document.getElementById('viewShapeLandscapesSection');
    if (type === 'region' || type === 'location') {
      window.ANIM.show(landscapesSection, 'anim-fade-in');
      renderLandscapeCarousel(shape);
    } else {
      window.ANIM.hide(landscapesSection, 'anim-fade-out');
    }

    // Related Concepts (Context) & Descriptor
    window.ANIM.hide(document.getElementById('viewShapeDescriptorSection'), 'anim-fade-out');
    renderRelatedConcepts(shape);

    // Show child locations (only for regions)
    const childrenSection = document.getElementById('viewShapeChildrenSection');
    const childrenEl = document.getElementById('viewShapeChildren');
    if (type === 'region') {
      window.ANIM.show(childrenSection, 'anim-fade-in');
      const frag = document.createDocumentFragment();
      const locs = shape.locations || [];
      if (!locs.length) {
        childrenEl.innerHTML = '<div style="font-family:\'Etna\';font-size:11px;color:rgba(255,255,255,0.25);padding:10px">Sin locaciones internas.</div>';
      } else {
        locs.forEach(loc => {
          const row = document.createElement('div');
          row.className = 'wb-shape-child-item';
          row.innerHTML = `<div class="wb-hier-loc-dot" style="width:12px;height:12px;border-radius:50%;background:${loc.color};flex-shrink:0"></div><span style="font-family:\'Etna\';font-size:13px;color:rgba(255,255,255,0.8);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${loc.name || 'Locación'}</span>`;
          row.addEventListener('click', (e) => { 
            e.stopPropagation();
            openShapeView(loc, 'location', shape); 
          });
          frag.appendChild(row);
        });
        childrenEl.innerHTML = '';
        childrenEl.appendChild(frag);
      }
    } else {
      window.ANIM.hide(childrenSection, 'anim-fade-out');
    }

    window.ANIM.show(modal, 'anim-modal-in');
    document.getElementById('closeViewShape').onclick = () => { window.ANIM.hide(modal, 'anim-modal-out'); selectedShapeId = null; renderMapShapes(); };

    document.getElementById('viewShapeAddLandscapeBtn').onclick = () => {
      document.getElementById('viewShapeLandscapeInput').click();
    };

    const moveBtn = document.getElementById('moveLocationBtn');
    if (type === 'location') {
      moveBtn.style.display = 'block';
      moveBtn.onclick = () => openMoveLocationModal(shape, parent);
    } else {
      moveBtn.style.display = 'none';
    }

    document.getElementById('deleteShapeBtn').onclick = () => {
      if (!confirm(`¿Eliminar "${shape.name}"?`)) return;
      if (type === 'region') {
        mapRegions = mapRegions.filter(r => r.id !== shape.id);
      } else if (parent) {
        parent.locations = (parent.locations || []).filter(l => l.id !== shape.id);
      }
      selectedShapeId = null; renderMapShapes(); renderHierarchyTree();
      window.ANIM.hide(modal, 'anim-modal-out'); saveMapData();
    };

    document.getElementById('editShapeBtn').onclick = () => {
      window.ANIM.hide(modal, 'anim-modal-out');
      openEditShapeModal(shape, type, parent);
    };
  }

  function openEditShapeModal(shape, type, parent = null) {
    isEditingShape = true;
    editingShapeRef = shape;
    editingShapeType = type;

    if (type === 'region') {
      const modal = document.getElementById('modalNewRegion');
      document.getElementById('modalNewRegionTitle').textContent = `Editar Región: ${shape.name}`;
      document.getElementById('saveNewRegionBtn').textContent = 'GUARDAR CAMBIOS';
      
      document.getElementById('regionName').value = shape.name || '';
      document.getElementById('regionColor').value = shape.color || '#5a8fd4';
      document.getElementById('regionDesc').value = shape.desc || '';
      
      // Select icon
      selectedRegionIcon = shape.icon || '⬡';
      const btns = document.querySelectorAll('#regionIconGrid .wb-icon-btn[data-icon]');
      const customBtn = document.getElementById('customRegionIconBtn');
      btns.forEach(b => b.classList.toggle('selected', b.dataset.icon === selectedRegionIcon));
      
      if (selectedRegionIcon.startsWith('http')) {
        customBtn.innerHTML = `<img src="${selectedRegionIcon}" alt="">`;
        customBtn.classList.add('selected');
        btns.forEach(b => b.classList.remove('selected'));
      } else {
        customBtn.innerHTML = '+ Subir';
        customBtn.classList.remove('selected');
      }
      
      // Landscapes
      tempLandscapes = [...(shape.landscapes || [])];
      renderLandscapePreviews();

      window.ANIM.show(modal, 'anim-modal-in');
    } else {
      const modal = document.getElementById('modalNewLocation');
      document.getElementById('modalNewLocationTitle').textContent = `Editar Locación: ${shape.name}`;
      document.getElementById('saveNewLocationBtn').textContent = 'GUARDAR CAMBIOS';
      document.getElementById('locationParentName').textContent = parent?.name || 'Región';
      
      document.getElementById('locationName').value = shape.name || '';
      document.getElementById('locationColor').value = shape.color || '#db6f4e';
      document.getElementById('locationDesc').value = shape.desc || '';
      
      // Select icon
      selectedLocationIcon = shape.icon || '📍';
      const btns = document.querySelectorAll('#locationIconGrid .wb-icon-btn[data-icon]');
      const customBtn = document.getElementById('customLocationIconBtn');
      btns.forEach(b => b.classList.toggle('selected', b.dataset.icon === selectedLocationIcon));
      
      if (selectedLocationIcon.startsWith('http')) {
        customBtn.innerHTML = `<img src="${selectedLocationIcon}" alt="">`;
        customBtn.classList.add('selected');
        btns.forEach(b => b.classList.remove('selected'));
      } else {
        customBtn.innerHTML = '+ Subir';
        customBtn.classList.remove('selected');
      }

      // Landscapes
      tempLandscapes = [...(shape.landscapes || [])];
      renderLandscapePreviews();

      window.ANIM.show(modal, 'anim-modal-in');
    }
  }

  function openMoveLocationModal(location, sourceRegion) {
    const modal = document.getElementById('modalMoveLocation');
    document.getElementById('moveLocationName').textContent = location.name;
    const listEl = document.getElementById('moveLocationList');
    listEl.innerHTML = '';

    const otherRegions = mapRegions.filter(r => r.id !== sourceRegion.id);
    if (!otherRegions.length) {
      listEl.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-family:\'Etna\';font-size:12px;padding:10px">No hay otras regiones disponibles.</div>';
    } else {
      otherRegions.forEach(target => {
        const item = document.createElement('div');
        item.className = 'wb-region-selection-item';
        item.style.cssText = 'display:flex;align-items:center;padding:12px;background:rgba(255,255,255,0.06);border-radius:12px;cursor:pointer;transition:background 0.2s;border:1px solid rgba(255,255,255,0.04)';
        item.innerHTML = `
          <div style="width:12px;height:12px;border-radius:50%;background:${target.color};margin-right:12px"></div>
          <span style="font-family:\'Etna\';font-size:14px;color:white;flex:1">${target.name}</span>
          <span style="font-family:\'Etna\';font-size:11px;color:rgba(255,255,255,0.4)">${(target.locations || []).length} loc.</span>
        `;
        item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.12)');
        item.addEventListener('mouseleave', () => item.style.background = 'rgba(255,255,255,0.06)');
        item.addEventListener('click', () => {
          moveLocationToRegion(location, sourceRegion, target);
          window.ANIM.hide(modal, 'anim-modal-out');
        });
        listEl.appendChild(item);
      });
    }

    window.ANIM.show(modal, 'anim-modal-in');
  }

  function moveLocationToRegion(location, sourceRegion, targetRegion) {
    // 1. Remove from source
    sourceRegion.locations = (sourceRegion.locations || []).filter(l => l.id !== location.id);
    // 2. Add to target
    if (!targetRegion.locations) targetRegion.locations = [];
    targetRegion.locations.push(location);

    showToast(`✔ Movido "${location.name}" a "${targetRegion.name}"`, 'success');
    window.ANIM.hide(document.getElementById('modalViewShape'), 'anim-modal-out');
    renderMapShapes();
    renderHierarchyTree();
    saveMapData();
  }

  function renderHierarchyTree() {
    const tree = document.getElementById('mapHierTree');
    tree.innerHTML = '';

    if (!mapRegions.length) {
      tree.innerHTML = '<div class="wb-map-hier-empty">Sin regiones aún.<br>Usa ⬡ para trazar una.</div>';
      return;
    }

    mapRegions.forEach(r => {
      const regionEl = document.createElement('div'); regionEl.className = 'wb-hier-region';

      const locs = r.locations || [];
      const headerEl = document.createElement('div');
      headerEl.className = 'wb-hier-region-header';

      let rIcon = '';
      if (r.icon) {
        if (r.icon.startsWith('http')) rIcon = `<img src="${r.icon}" class="wb-hier-icon-img">`;
        else rIcon = r.icon;
      } else rIcon = '⬡';

      headerEl.innerHTML = `
        <div class="wb-hier-region-dot" style="border:1px solid ${r.color};color:${r.color}">${rIcon}</div>
        <span class="wb-hier-region-name">${r.name || 'Región'}</span>
        <div class="wb-hier-region-actions">
          <button class="wb-hier-action-btn" title="Ver región">👁</button>
          <button class="wb-hier-action-btn del" title="Eliminar">🗑</button>
        </div>
        <button class="wb-hier-region-toggle">${locs.length ? '▾' : '▸'}</button>`;

      headerEl.querySelector('[title="Ver región"]').addEventListener('click', e => { e.stopPropagation(); openShapeView(r, 'region', null); });
      headerEl.querySelector('[title="Eliminar"]').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar región "${r.name}"?`)) return;
        mapRegions = mapRegions.filter(x => x.id !== r.id);
        regionEl.remove(); renderMapShapes(); saveMapData();
      });

      const locsEl = document.createElement('div'); locsEl.className = 'wb-hier-locations';

      const toggleBtn = headerEl.querySelector('.wb-hier-region-toggle');
      let expanded = true;
      const toggleExpand = () => { expanded = !expanded; locsEl.style.display = expanded ? '' : 'none'; toggleBtn.textContent = expanded ? '▾' : '▸'; };
      toggleBtn.addEventListener('click', e => { e.stopPropagation(); toggleExpand(); });
      headerEl.addEventListener('click', () => { selectedShapeId = r.id; renderMapShapes(); });

      locs.forEach(loc => {
        const locRow = document.createElement('div'); locRow.className = 'wb-hier-location-row';

        let lIcon = '';
        if (loc.icon) {
          if (loc.icon.startsWith('http')) lIcon = `<img src="${loc.icon}" class="wb-hier-icon-img">`;
          else lIcon = loc.icon;
        } else lIcon = '📍';

        locRow.innerHTML = `<div class="wb-hier-loc-dot" style="border:1px solid ${loc.color};color:${loc.color}">${lIcon}</div><span class="wb-hier-loc-name">${loc.name || 'Locación'}</span><button class="wb-hier-action-btn del" title="Eliminar locación" style="margin-left:auto">🗑</button>`;
        locRow.querySelector('.wb-hier-action-btn').addEventListener('click', e => {
          e.stopPropagation();
          if (!confirm(`¿Eliminar locación "${loc.name}"?`)) return;
          r.locations = (r.locations || []).filter(l => l.id !== loc.id);
          locRow.remove(); renderMapShapes(); saveMapData();
        });
        locRow.addEventListener('click', () => { openShapeView(loc, 'location', r); });
        locsEl.appendChild(locRow);
      });

      // Add location button
      const addLocBtn = document.createElement('button'); addLocBtn.className = 'wb-hier-add-location-btn';
      addLocBtn.innerHTML = '<span>+ Locación</span>';
      addLocBtn.addEventListener('click', e => {
        e.stopPropagation();
        drawingParentId = r.id;
        mapTool = 'location';
        document.querySelectorAll('.wb-mft-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'location'));
        document.getElementById('mapCanvasWrap').style.cursor = 'crosshair';
        updateHintBar();
        showToast(`✏ Traza la locación dentro de "${r.name}"`);
      });
      locsEl.appendChild(addLocBtn);

      regionEl.appendChild(headerEl); regionEl.appendChild(locsEl);
      tree.appendChild(regionEl);
    });
  }

  // ── MAP SAVE / LOAD ───────────────────────
  async function saveMapData() {
    // 1. Migrate base64 to Cloudinary if needed
    if (mapImage?.url && mapImage.url.startsWith('data:')) {
      showToast('☁ Migrando mapa a la nube...');
      try {
        const blob = dataURLtoBlob(mapImage.url);
        const newUrl = await uploadToCloudinary(blob, 'worldbuilding/maps');
        mapImage.url = newUrl;
      } catch (e) {
        console.error('Error migrando mapa:', e);
      }
    }

    const mapState = { regions: mapRegions, mapImage };
    const storageKey = `rk_wb_map_${projectId}${worldId || ''}`;

    try {
      localStorage.setItem(storageKey, JSON.stringify(mapState));
    } catch (e) {
      console.error('Local Storage Error:', e);
      if (e.name === 'QuotaExceededError') {
        showToast('⚠️ Memoria local llena. El mapa se guardará solo en la nube.', 'error');
      }
    }

    if (!seccionWBId) { showToast('🗺 Mapa guardado localmente'); return; }
    const key = `__MAP_${seccionWBId}`;
    let { data: cont } = await sb.from('contenidos').select('id').eq('titulo', key).eq('tipo_plantilla', 'wb_mapa').maybeSingle();
    if (!cont) {
      const { data: nc } = await sb.from('contenidos').insert({ proyecto_id: projectId, titulo: key, tipo_plantilla: 'wb_mapa', creado_por: currentUser.id }).select().single();
      cont = nc;
    }
    if (!cont) return;

    const regionsLight = mapRegions.map(r => ({ ...r }));
    const payload = {
      contenido_id: cont.id,
      tipo: 'mapa_data',
      data: { regions: regionsLight, mapImage }, // Guardamos el mapa (URL) también en Supabase
      orden: 0
    };

    const { data: existing } = await sb.from('bloques').select('id').eq('contenido_id', cont.id).maybeSingle();
    if (existing) await sb.from('bloques').update(payload).eq('id', existing.id);
    else await sb.from('bloques').insert(payload);

    showToast('🗺 Mapa guardado');
    renderHierarchyTree(); renderMapShapes();
    mapDirty = false;
  }

  async function loadMapData() {
    const pref = window.RKCache.get(`prefetch_p_${projectId}`);
    let state = pref?.mapData || null;

    if (!state) {
      const storageKey = `rk_wb_map_${projectId}${worldId || ''}`;
      let stored = localStorage.getItem(storageKey);
      if (stored) {
        try { state = JSON.parse(stored); } catch (e) { }
      }
    }

    // Si no hay nada local o en el pre-fetch, verificar la nube
    if (!state && seccionWBId) {
      const key = `__MAP_${seccionWBId}`;
      const { data: cont } = await sb.from('contenidos').select('id').eq('titulo', key).eq('tipo_plantilla', 'wb_mapa').maybeSingle();
      if (cont) {
        const { data: b } = await sb.from('bloques').select('data').eq('contenido_id', cont.id).maybeSingle();
        if (b?.data) {
          state = b.data;
        }
      }
    }

    if (!state) return;

    mapRegions = state.regions || [];
    if (state.mapImage) {
      mapImage = state.mapImage;
      _mapW = mapImage.w || 2000; _mapH = mapImage.h || 1400;
      const canvasEl = document.getElementById('mapCanvas');
      const overlayEl = document.getElementById('mapOverlayCanvas');
      const relCanvas = document.getElementById('mapRelationsCanvas');
      if (canvasEl && overlayEl) {
        canvasEl.width = _mapW; canvasEl.height = _mapH;
        overlayEl.width = _mapW; overlayEl.height = _mapH;
        if (relCanvas) { relCanvas.width = _mapW; relCanvas.height = _mapH; }
        const ctx = canvasEl.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          fitMapToContainer();
          renderMapShapes();
          renderHierarchyTree();
        };
        img.src = mapImage.url;
      }
      window.ANIM.hide(document.getElementById('mapEmptyState'), 'anim-fade-out');
      window.ANIM.show(document.getElementById('mapActiveArea'), 'anim-fade-in');
    } else if (mapRegions.length) {
      window.ANIM.hide(document.getElementById('mapEmptyState'), 'anim-fade-out');
      window.ANIM.show(document.getElementById('mapActiveArea'), 'anim-fade-in');
      renderMapShapes(); renderHierarchyTree();
    }
  }

  // ══════════════════════════════════════════
  //  MODALS SETUP
  // ══════════════════════════════════════════
  function setupModals() {
    // New Concept
    const ncModal = document.getElementById('modalNewConcept');
    document.getElementById('closeModalNewConcept').addEventListener('click', () => window.ANIM.hide(ncModal, 'anim-modal-out'));
    document.getElementById('cancelModalNewConcept').addEventListener('click', () => window.ANIM.hide(ncModal, 'anim-modal-out'));
    ncModal.addEventListener('click', e => { if (e.target === ncModal) window.ANIM.hide(ncModal, 'anim-modal-out'); });
    document.getElementById('newConceptIconBox').addEventListener('click', () => document.getElementById('newConceptIconInput').click());
    document.getElementById('newConceptIconInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "profile");
      if (cropped) {
        newConceptIconDataURL = cropped;
        const img = document.getElementById('newConceptIconPreview');
        img.src = cropped;
        img.style.display = 'block';
        document.getElementById('newConceptIconBox').querySelector('.modal-icon-hint').style.display = 'none';
      }
    });
    document.getElementById('saveNewConceptBtn').addEventListener('click', saveNewConcept);

    // Move Location Modal
    const moveModal = document.getElementById('modalMoveLocation');
    document.getElementById('closeMoveLocationModal').addEventListener('click', () => window.ANIM.hide(moveModal, 'anim-modal-out'));
    document.getElementById('cancelMoveLocation').addEventListener('click', () => window.ANIM.hide(moveModal, 'anim-modal-out'));
    moveModal.addEventListener('click', e => { if (e.target === moveModal) window.ANIM.hide(moveModal, 'anim-modal-out'); });

    // New Region
    const nrModal = document.getElementById('modalNewRegion');
    const closeRegion = () => { 
      window.ANIM.hide(nrModal, 'anim-modal-out'); 
      _pendingPolygon = null; 
      polygonPoints = []; 
      isEditingShape = false;
      editingShapeRef = null;
      editingShapeType = null;
      tempLandscapes = [];
      renderLandscapePreviews();
      renderMapShapes(); 
    };
    document.getElementById('closeModalNewRegion').addEventListener('click', closeRegion);
    document.getElementById('cancelModalNewRegion').addEventListener('click', closeRegion);
    document.getElementById('saveNewRegionBtn').addEventListener('click', () => {
      const name = document.getElementById('regionName').value.trim();
      if (!name) { showToast('ℹ Escribe un nombre para la región', 'error'); return; }
      
      if (isEditingShape && editingShapeType === 'region' && editingShapeRef) {
        editingShapeRef.name = name;
        editingShapeRef.color = document.getElementById('regionColor').value;
        editingShapeRef.icon = selectedRegionIcon;
        editingShapeRef.desc = document.getElementById('regionDesc').value.trim();
        showToast(`✔ Cambios en "${name}" guardados`);
      } else {
        const region = {
          id: 'region_' + Date.now(),
          name, color: document.getElementById('regionColor').value,
          icon: selectedRegionIcon,
          desc: document.getElementById('regionDesc').value.trim(),
          opacity: parseInt(document.getElementById('mapShapeOpacity').value) || 40,
          points: _pendingPolygon || [], locations: [],
          landscapes: [...tempLandscapes]
        };
        mapRegions.push(region);
        showToast(`✔ Región "${name}" creada`);
      }
      
      _pendingPolygon = null; tempLandscapes = [];
      window.ANIM.hide(nrModal, 'anim-modal-out');
      isEditingShape = false; editingShapeRef = null;
      renderMapShapes(); renderHierarchyTree(); saveMapData();
    });

    // Region Icon selection
    const regIconBtns = document.querySelectorAll('#regionIconGrid .wb-icon-btn[data-icon]');
    regIconBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        regIconBtns.forEach(b => b.classList.remove('selected'));
        document.getElementById('customRegionIconBtn').classList.remove('selected');
        btn.classList.add('selected');
        selectedRegionIcon = btn.dataset.icon;
      });
    });
    document.getElementById('customRegionIconBtn').addEventListener('click', () => document.getElementById('regionIconInput').click());
    document.getElementById('regionIconInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "profile");
      if (cropped) {
        showToast('⏳ Subiendo icono...');
        try {
          const blob = dataURLtoBlob(cropped);
          const url = await uploadToCloudinary(blob, 'worldbuilding/icons');
          selectedRegionIcon = url;
          const btn = document.getElementById('customRegionIconBtn');
          btn.innerHTML = `<img src="${url}" alt="">`;
          regIconBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        } catch (err) { showToast('✖ Error subiendo icono', 'error'); }
      }
    });

    // Landscapes setup
    document.getElementById('addRegionLandscapeBtn').onclick = () => document.getElementById('regionLandscapeInput').click();
    document.getElementById('regionLandscapeInput').onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      for (const file of files) {
        const cropped = await window.RKCrop.open(file, "banner");
        if (cropped) {
          showToast(`⏳ Subiendo paisaje...`);
          try {
            const url = await uploadToCloudinary(dataURLtoBlob(cropped), 'worldbuilding/landscapes');
            tempLandscapes.push(url);
          } catch (err) { showToast(`✖ Error: ${err.message}`, 'error'); }
        }
      }
      e.target.value = '';
      renderLandscapePreviews();
    };

    document.getElementById('viewShapeLandscapeInput').onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      
      let currentShape = null;
      // Search for the shape in all regions and their locations
      for (const r of mapRegions) {
        if (r.id === selectedShapeId) { currentShape = r; break; }
        const loc = (r.locations || []).find(l => l.id === selectedShapeId);
        if (loc) { currentShape = loc; break; }
      }
      
      if (!currentShape) return;
      for (const file of files) {
        const cropped = await window.RKCrop.open(file, "banner");
        if (cropped) {
          showToast(`⏳ Subiendo paisaje...`);
          try {
            const url = await uploadToCloudinary(dataURLtoBlob(cropped), 'worldbuilding/landscapes');
            if (!currentShape.landscapes) currentShape.landscapes = [];
            currentShape.landscapes.push(url);
          } catch (err) { showToast(`✖ Error: ${err.message}`, 'error'); }
        }
      }
      e.target.value = '';
      renderLandscapeCarousel(currentShape);
      saveMapData();
    };

    document.getElementById('closeLightbox').onclick = closeLightbox;
    document.getElementById('modalLightbox').onclick = (e) => { if (e.target.id === 'modalLightbox') closeLightbox(); };

    // New Location
    const nlModal = document.getElementById('modalNewLocation');
    const closeLocation = () => { 
      window.ANIM.hide(nlModal, 'anim-modal-out'); 
      _pendingPolygon = null; 
      polygonPoints = []; 
      isEditingShape = false;
      editingShapeRef = null;
      editingShapeType = null;
      tempLandscapes = [];
      renderLandscapePreviews();
      renderMapShapes(); 
    };
    document.getElementById('closeModalNewLocation').addEventListener('click', closeLocation);
    document.getElementById('cancelModalNewLocation').addEventListener('click', closeLocation);
    document.getElementById('saveNewLocationBtn').addEventListener('click', () => {
      const name = document.getElementById('locationName').value.trim();
      if (!name) { showToast('ℹ Escribe un nombre para la locación', 'error'); return; }
      
      if (isEditingShape && editingShapeType === 'location' && editingShapeRef) {
        editingShapeRef.name = name;
        editingShapeRef.color = document.getElementById('locationColor').value;
        editingShapeRef.icon = selectedLocationIcon;
        editingShapeRef.desc = document.getElementById('locationDesc').value.trim();
        editingShapeRef.landscapes = [...tempLandscapes];
        showToast(`✔ Cambios en "${name}" guardados`);
      } else {
        const parentRegion = mapRegions.find(r => r.id === drawingParentId);
        if (!parentRegion) { showToast('ℹ No se encontró la región padre', 'error'); closeLocation(); return; }
        const loc = {
          id: 'location_' + Date.now(),
          name, color: document.getElementById('locationColor').value,
          icon: selectedLocationIcon,
          desc: document.getElementById('locationDesc').value.trim(),
          opacity: 50,
          points: _pendingPolygon || [],
          landscapes: [...tempLandscapes]
        };
        if (!parentRegion.locations) parentRegion.locations = [];
        parentRegion.locations.push(loc);
        showToast(`✔ Locación "${name}" creada en "${parentRegion.name}"`);
      }
      
      _pendingPolygon = null; tempLandscapes = [];
      window.ANIM.hide(nlModal, 'anim-modal-out');
      isEditingShape = false; editingShapeRef = null;
      renderMapShapes(); renderHierarchyTree(); saveMapData();
    });

    // Location Landscapes
    document.getElementById('addLocationLandscapeBtn').onclick = () => document.getElementById('locationLandscapeInput').click();
    document.getElementById('locationLandscapeInput').onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      for (const file of files) {
        const cropped = await window.RKCrop.open(file, "banner");
        if (cropped) {
          showToast(`⏳ Subiendo paisaje...`);
          try {
            const url = await uploadToCloudinary(dataURLtoBlob(cropped), 'worldbuilding/landscapes');
            tempLandscapes.push(url);
          } catch (err) { showToast(`✖ Error: ${err.message}`, 'error'); }
        }
      }
      e.target.value = '';
      renderLandscapePreviews();
    };

    // Location Icon selection
    const locIconBtns = document.querySelectorAll('#locationIconGrid .wb-icon-btn[data-icon]');
    locIconBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        locIconBtns.forEach(b => b.classList.remove('selected'));
        document.getElementById('customLocationIconBtn').classList.remove('selected');
        btn.classList.add('selected');
        selectedLocationIcon = btn.dataset.icon;
      });
    });
    document.getElementById('customLocationIconBtn').addEventListener('click', () => document.getElementById('locationIconInput').click());
    document.getElementById('locationIconInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "profile");
      if (cropped) {
        showToast('⏳ Subiendo icono...');
        try {
          const url = await uploadToCloudinary(dataURLtoBlob(cropped), 'worldbuilding/icons');
          selectedLocationIcon = url;
          const btn = document.getElementById('customLocationIconBtn');
          btn.innerHTML = `<img src="${url}" alt="">`;
          locIconBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        } catch (err) { showToast('✖ Error subiendo icono', 'error'); }
      }
    });

    // Populate concept type select with macro-category groups
    const typeSelect = document.getElementById('newConceptType');
    MACRO_CATEGORIES.forEach(macro => {
      const group = document.createElement('optgroup');
      group.label = macro.label;
      macro.children.forEach(typeKey => {
        const opt = document.createElement('option');
        opt.value = typeKey;
        const t = MAIN_TYPES.find(mt => mt.key === typeKey);
        opt.textContent = t ? `${t.icon} ${t.label}` : typeKey;
        group.appendChild(opt);
      });
      typeSelect.appendChild(group);
    });

    // Edit Concept setup
    const ecModal = document.getElementById('modalEditConcept');
    document.getElementById('closeModalEditConcept').addEventListener('click', () => window.ANIM.hide(ecModal, 'anim-modal-out'));
    document.getElementById('cancelModalEditConcept').addEventListener('click', () => window.ANIM.hide(ecModal, 'anim-modal-out'));
    ecModal.addEventListener('click', e => { if (e.target === ecModal) window.ANIM.hide(ecModal, 'anim-modal-out'); });
    
    document.getElementById('editConceptIconBox').addEventListener('click', () => document.getElementById('editConceptIconInput').click());
    document.getElementById('editConceptIconInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const cropped = await window.RKCrop.open(file, "profile");
      if (cropped) {
        editConceptIconDataURL = cropped;
        const img = document.getElementById('editConceptIconPreview');
        img.src = cropped;
      }
    });

    document.getElementById('saveEditConceptBtn').addEventListener('click', saveEditConcept);
    document.getElementById('deleteEditConceptBtn').addEventListener('click', () => {
      if (currentEditingConcept) deleteConceptHierarchyDirect(currentEditingConcept);
    });

    setupConceptSlashCommand();
  }

  function setupConceptSlashCommand() {
    const input = document.getElementById('newConceptName');
    const typeSelect = document.getElementById('newConceptType');

    input.addEventListener('input', (e) => {
      const type = typeSelect.value;
      if (type !== 'Locación') { hideNcSlashDropdown(); return; }

      const val = input.value;
      if (val.startsWith('/')) {
        ncSlashActive = true;
        ncSlashQuery = val.slice(1).toLowerCase().trim();
        showNcSlashDropdown(input, ncSlashQuery);
      } else {
        hideNcSlashDropdown();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (!ncSlashActive) return;
      
      const dropdown = document.getElementById('ncSlashDropdown');
      if (!dropdown) return;
      const items = dropdown.querySelectorAll('.nc-slash-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        ncSlashHighIdx = Math.min(ncSlashHighIdx + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('highlighted', i === ncSlashHighIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        ncSlashHighIdx = Math.max(ncSlashHighIdx - 1, 0);
        items.forEach((it, i) => it.classList.toggle('highlighted', i === ncSlashHighIdx));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[ncSlashHighIdx]?.click();
      } else if (e.key === 'Escape') {
        hideNcSlashDropdown();
      }
    });
  }

  function showNcSlashDropdown(input, query) {
    let dropdown = document.getElementById('ncSlashDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'ncSlashDropdown';
      dropdown.className = 'nc-slash-dropdown';
      document.body.appendChild(dropdown);
    }

    // Collect all shapes
    const allShapes = [];
    mapRegions.forEach(r => {
      allShapes.push({ name: r.name || 'Región', icon: r.icon, type: 'region', id: r.id });
      (r.locations || []).forEach(l => {
        allShapes.push({ name: l.name || 'Locación', icon: l.icon, type: 'location', id: l.id, parentId: r.id });
      });
    });

    const matches = allShapes.filter(s => s.name.toLowerCase().includes(query)).slice(0, 10);
    
    if (!matches.length) {
      dropdown.innerHTML = '<div class="nc-slash-empty">No se encontraron lugares</div>';
    } else {
      dropdown.innerHTML = '';
      ncSlashHighIdx = 0;
      matches.forEach((s, idx) => {
        const item = document.createElement('div');
        item.className = 'nc-slash-item' + (idx === 0 ? ' highlighted' : '');
        
        let iconHtml = '';
        if (s.icon && (s.icon.startsWith('http') || s.icon.startsWith('data:'))) {
          iconHtml = `<img src="${s.icon}" alt="">`;
        } else {
          iconHtml = `<span>${s.icon || (s.type === 'region' ? '⬡' : '📍')}</span>`;
        }

        item.innerHTML = `
          <div class="nc-slash-item-icon">${iconHtml}</div>
          <div class="nc-slash-item-info">
            <span class="nc-slash-item-name">${s.name}</span>
            <span class="nc-slash-item-type">${s.type === 'region' ? 'Región' : 'Locación'}</span>
          </div>
        `;

        item.addEventListener('click', () => {
          input.value = s.name;
          _pendingSlashLink = { type: s.type, id: s.id };
          hideNcSlashDropdown();
        });
        dropdown.appendChild(item);
      });
    }

    const rect = input.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    dropdown.style.width = rect.width + 'px';
  }

  function hideNcSlashDropdown() {
    ncSlashActive = false;
    const d = document.getElementById('ncSlashDropdown');
    if (d) d.remove();
  }

  let _newConceptForType = null, _newConceptAsSubconcept = false;

  function openNewConceptModal(typeKey = null, asSub = false) {
    _newConceptForType = typeKey; _newConceptAsSubconcept = asSub;
    newConceptIconDataURL = null;
    const modal = document.getElementById('modalNewConcept');
    document.getElementById('modalNewConceptTitle').textContent = asSub ? `Nuevo Sub-concepto de ${currentConcepto?.titulo || 'Concepto'}` : (typeKey ? `Nuevo concepto (${typeKey})` : 'Nuevo Concepto');
    document.getElementById('newConceptName').value = '';
    document.getElementById('newConceptDesc').value = '';
    document.getElementById('newConceptIconPreview').src = ''; document.getElementById('newConceptIconPreview').style.display = 'none';
    document.getElementById('newConceptIconBox').querySelector('.modal-icon-hint').style.display = 'block';
    if (typeKey) document.getElementById('newConceptType').value = typeKey;
    _pendingSlashLink = null;
    hideNcSlashDropdown();
    window.ANIM.show(modal, 'anim-modal-in');
  }

  async function saveNewConcept() {
    const btn = document.getElementById('saveNewConceptBtn');
    const name = document.getElementById('newConceptName').value.trim();
    const tipo = document.getElementById('newConceptType').value;
    const desc = document.getElementById('newConceptDesc').value.trim();
    if (!name) { showToast('ℹ Escribe un nombre', 'error'); return; }
    if (!tipo) { showToast('ℹ Selecciona un tipo', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      const plantillaId = plantillasMap[tipo] || null;
      const padreId = _newConceptAsSubconcept ? (currentConcepto?.id || worldId || null) : (worldId || null);
      let iconoUrl = null;
      if (newConceptIconDataURL) {
        try { if (typeof uploadToCloudinary === 'function') iconoUrl = await uploadToCloudinary(dataURLtoBlob(newConceptIconDataURL), 'worldbuilding/iconos'); } catch (e) { }
      }
      const { data: nuevo, error } = await sb.from('conceptos').insert({ 
        seccion_id: seccionWBId, 
        plantilla_id: plantillaId, 
        padre_id: padreId, 
        titulo: name, 
        descripcion: desc,
        icono_url: iconoUrl, 
        orden: conceptosCache.length 
      }).select('*, plantillas_concepto(nombre)').single();
      if (error) throw new Error(error.message);
      conceptosCache.push(nuevo);

      // Handle Map Link if pending
      if (_pendingSlashLink) {
        // 1. Ensure 'contenidos' record exists for this concept
        let { data: cont } = await sb.from('contenidos').select('id').eq('titulo', nuevo.id).eq('tipo_plantilla', 'wb_concepto').maybeSingle();
        if (!cont) {
          const { data: newCont } = await sb.from('contenidos')
            .insert({ proyecto_id: projectId, titulo: nuevo.id, tipo_plantilla: 'wb_concepto', creado_por: currentUser.id })
            .select().single();
          cont = newCont;
        }
        
        // 2. Insert 'locacion' block to link it
        const linkData = {};
        if (_pendingSlashLink.type === 'region') linkData.region_id = _pendingSlashLink.id;
        else linkData.location_id = _pendingSlashLink.id;

        await sb.from('bloques').insert({
          contenido_id: cont.id,
          tipo: 'locacion',
          data: linkData,
          orden: 0
        });
        _pendingSlashLink = null;
      }

      window.ANIM.hide(document.getElementById('modalNewConcept'), 'anim-modal-out');
      renderHub(); renderTypesGrid(); renderConceptTree();
      refreshConceptDetail();
      if (_newConceptAsSubconcept && currentConcepto) renderSubconceptsSidebar(currentConcepto);
      else if (currentMacroHub) showMacroConceptHub(currentMacroHub);
      showToast(`✔ "${name}" creado`);
    } catch (e) { showToast('✖ ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '¡CREAR!'; }
  }

  function openEditConceptModal(concepto) {
    currentEditingConcept = concepto;
    editConceptIconDataURL = null;
    
    const modal = document.getElementById('modalEditConcept');
    document.getElementById('editConceptName').value = concepto.titulo || '';
    document.getElementById('editConceptDesc').value = concepto.descripcion || '';
    
    const preview = document.getElementById('editConceptIconPreview');
    const tipo = concepto.plantillas_concepto?.nombre || '';
    preview.src = concepto.icono_url || '';
    preview.onerror = () => { preview.src = ''; }; // fallback if no url
    
    // Fill the disabled type select for context
    const typeSelect = document.getElementById('editConceptType');
    typeSelect.innerHTML = `<option value="${tipo}" selected>${tipo}</option>`;
    
    window.ANIM.show(modal, 'anim-modal-in');
  }

  async function saveEditConcept() {
    if (!currentEditingConcept) return;
    const btn = document.getElementById('saveEditConceptBtn');
    const name = document.getElementById('editConceptName').value.trim();
    const desc = document.getElementById('editConceptDesc').value.trim();
    
    if (!name) { showToast('ℹ Escribe un nombre', 'error'); return; }
    
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      let iconoUrl = currentEditingConcept.icono_url;
      if (editConceptIconDataURL) {
        if (typeof uploadToCloudinary === 'function') {
          iconoUrl = await uploadToCloudinary(dataURLtoBlob(editConceptIconDataURL), 'worldbuilding/iconos');
        }
      }
      
      const { error } = await sb.from('conceptos')
        .update({ titulo: name, icono_url: iconoUrl, descripcion: desc })
        .eq('id', currentEditingConcept.id);
        
      if (error) throw error;
      
      // Update cache
      currentEditingConcept.titulo = name;
      currentEditingConcept.icono_url = iconoUrl;
      currentEditingConcept.descripcion = desc;
      
      const idx = conceptosCache.findIndex(c => c.id === currentEditingConcept.id);
      if (idx >= 0) conceptosCache[idx] = { ...currentEditingConcept };
      
      window.ANIM.hide(document.getElementById('modalEditConcept'), 'anim-modal-out');
      renderHub(); renderTypesGrid(); renderConceptTree();
      refreshConceptDetail();
      showToast('✔ Concepto actualizado');
    } catch (e) {
      showToast('✖ ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'GUARDAR CAMBIOS';
    }
  }

  function getAllDescendantIds(parentId) {
    let results = [];
    const children = conceptosCache.filter(c => c.padre_id === parentId);
    children.forEach(child => {
      results.push(child.id);
      results = results.concat(getAllDescendantIds(child.id));
    });
    return results;
  }

  async function deleteConceptHierarchyDirect(concept) {
    const descendants = getAllDescendantIds(concept.id);
    const totalCount = descendants.length + 1;
    const msg = totalCount > 1 
      ? `¿Eliminar "${concept.titulo}" y sus ${descendants.length} sub-concepto(s)?`
      : `¿Eliminar "${concept.titulo}"?`;
      
    if (!confirm(msg)) return;

    try {
      showToast('⏳ Eliminando...');
      const allIds = [concept.id, ...descendants];
      
      // 1. Desvincular/eliminar mensajes relacionados a estos conceptos
      await sb.from('mensajes').update({ reply_to_id: null }).in('concepto_id', allIds);
      await sb.from('mensajes').delete().in('concepto_id', allIds);

      // 2. Eliminar relaciones de los conceptos (concepto_relaciones)
      await sb.from('concepto_relaciones').delete().in('concepto_origen_id', allIds);
      await sb.from('concepto_relaciones').delete().in('concepto_destino_id', allIds);
      
      // 3. Obtener contenidos asociados a estos conceptos
      const { data: contents } = await sb.from('contenidos').select('id').in('titulo', allIds);
      if (contents && contents.length) {
        const contentIds = contents.map(c => c.id);
        // 3.a. Eliminar de la tabla relaciones (contenidos relaciones)
        await sb.from('relaciones').delete().in('origen_id', contentIds);
        await sb.from('relaciones').delete().in('destino_id', contentIds);
        // 3.b. Eliminar bloques vinculados a los contenidos
        await sb.from('bloques').delete().in('contenido_id', contentIds);
        // 3.c. Eliminar los contenidos propiamente dichos
        await sb.from('contenidos').delete().in('id', contentIds);
      }

      // 4. Anular padre_id por auto-referencia antes de borrar los conceptos
      await sb.from('conceptos').update({ padre_id: null }).in('id', allIds);

      // 5. Eliminar conceptos
      const { error } = await sb.from('conceptos').delete().in('id', allIds);
      if (error) throw error;

      conceptosCache = conceptosCache.filter(c => !allIds.includes(c.id));
      
      // Limpiar caches de prefetch
      window.RKCache.remove(`prefetch_p_${projectId}`);
      window.RKCache.remove(`deep_blocks_${projectId}`);
      window.RKCache.remove(`deep_rels_${projectId}`);

      window.ANIM.hide(document.getElementById('modalEditConcept'), 'anim-modal-out');
      renderTypesGrid(); renderHub(); renderConceptTree();
      if (currentConcepto && allIds.includes(currentConcepto.id)) {
        closeConceptDetail();
      } else {
        refreshConceptDetail();
      }
      showToast('✔ Eliminado correctamente');
    } catch (err) {
      showToast('✖ ' + err.message, 'error');
    }
  }

  // ── CONCEPT EXPLORER (VS Code-style tree) ──
  let explorerCollapsed = {};   // { folderId: true/false }
  let activeContextMenu = null; // currently open context menu

  function loadExplorerState() {
    try { explorerCollapsed = JSON.parse(localStorage.getItem('rk_wb_explorer_state') || '{}'); } catch { explorerCollapsed = {}; }
  }
  function saveExplorerState() {
    try { localStorage.setItem('rk_wb_explorer_state', JSON.stringify(explorerCollapsed)); } catch {}
  }

  function renderConceptTree(searchQuery = '') {
    loadExplorerState();
    const tree = document.getElementById('ipConceptTree');
    tree.innerHTML = '';
    if (!conceptosCache.length) { tree.innerHTML = '<p class="ip-rp-empty">Sin conceptos aún.</p>'; return; }

    const q = searchQuery.toLowerCase().trim();

    // Get top-level concepts (direct children of the world)
    const topLevel = conceptosCache.filter(c => {
      const tipo = c.plantillas_concepto?.nombre;
      if (!tipo || tipo.toLowerCase() === 'world') return false;
      return c.padre_id === worldId || (!worldId && !c.padre_id);
    });

    // Group by MACRO_CATEGORIES
    MACRO_CATEGORIES.forEach(macro => {
      // Collect all concepts matching any child type in this macro-category
      let macroItems = [];
      macro.children.forEach(typeKey => {
        const matching = topLevel.filter(c => c.plantillas_concepto?.nombre === typeKey);
        macroItems = macroItems.concat(matching);
      });

      if (!macroItems.length && !q) return;

      let filteredItems = macroItems;
      if (q) {
        filteredItems = macroItems.filter(c => conceptMatchesSearch(c, q));
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
        renderConceptTree(document.getElementById('ipSearch')?.value || '');
      });
      folder.appendChild(header);

      if (!isCollapsed) {
        const children = document.createElement('div');
        children.className = 'wb-explorer-children';

        // Group items by specific sub-type within the macro-category
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
            subHeader.textContent = typeData ? typeData.label : t;
            children.appendChild(subHeader);
            bySubType[t].forEach(c => {
              children.appendChild(buildExplorerNode(c, 1, q));
            });
          });
        } else {
          filteredItems.forEach(c => {
            children.appendChild(buildExplorerNode(c, 1, q));
          });
        }
        folder.appendChild(children);
      }

      tree.appendChild(folder);
    });

    // Also render any concepts that don't fit in any macro-category
    const knownTypes = new Set(MACRO_CATEGORIES.flatMap(mc => mc.children));
    const uncategorized = topLevel.filter(c => !knownTypes.has(c.plantillas_concepto?.nombre));
    if (uncategorized.length) {
      let filteredUncat = uncategorized;
      if (q) {
        filteredUncat = uncategorized.filter(c => conceptMatchesSearch(c, q));
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
          renderConceptTree(document.getElementById('ipSearch')?.value || '');
        });
        folder.appendChild(header);
        if (!isCollapsed) {
          const children = document.createElement('div');
          children.className = 'wb-explorer-children';
          filteredUncat.forEach(c => {
            children.appendChild(buildExplorerNode(c, 1, q));
          });
          folder.appendChild(children);
        }
        tree.appendChild(folder);
      }
    }
  }

  function conceptMatchesSearch(concept, query) {
    if ((concept.titulo || '').toLowerCase().includes(query)) return true;
    // Check children recursively
    const children = conceptosCache.filter(c => c.padre_id === concept.id);
    return children.some(c => conceptMatchesSearch(c, query));
  }

  function buildExplorerNode(concept, depth, searchQuery = '') {
    const children = conceptosCache.filter(c => c.padre_id === concept.id && c.plantillas_concepto?.nombre?.toLowerCase() !== 'world');
    const hasChildren = children.length > 0;
    const folderId = `node_${concept.id}`;
    const isCollapsed = explorerCollapsed[folderId] && !searchQuery;

    const wrap = document.createElement('div');
    wrap.className = 'wb-explorer-node-wrap';

    const node = document.createElement('div');
    node.className = 'wb-explorer-item';
    node.dataset.id = concept.id;
    node.style.paddingLeft = `${12 + depth * 16}px`;

    // Highlight search matches
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

    // Click to open concept detail
    node.addEventListener('click', (e) => {
      if (e.target.closest('.wb-explorer-chevron')) {
        explorerCollapsed[folderId] = !explorerCollapsed[folderId];
        saveExplorerState();
        renderConceptTree(document.getElementById('ipSearch')?.value || '');
        return;
      }
      // Highlight active
      document.querySelectorAll('.wb-explorer-item').forEach(n => n.classList.remove('active'));
      node.classList.add('active');
      openConceptDetail(concept);
    });

    // Right-click context menu
    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showExplorerContextMenu(e, concept);
    });

    wrap.appendChild(node);

    // Render children recursively, grouped by sub-category
    if (hasChildren && !isCollapsed) {
      const childContainer = document.createElement('div');
      childContainer.className = 'wb-explorer-children';

      // Group children by their type
      const childByType = {};
      let filteredChildren = children;
      if (searchQuery) {
        filteredChildren = children.filter(c => conceptMatchesSearch(c, searchQuery));
      }

      filteredChildren.forEach(c => {
        const t = c.plantillas_concepto?.nombre || 'Otro';
        if (!childByType[t]) childByType[t] = [];
        childByType[t].push(c);
      });

      // If all children are same type, don't add sub-category headers
      const typeKeys = Object.keys(childByType);
      if (typeKeys.length > 1) {
        typeKeys.forEach(t => {
          const subHeader = document.createElement('div');
          subHeader.className = 'wb-explorer-sub-category';
          subHeader.style.paddingLeft = `${12 + (depth + 1) * 16}px`;
          subHeader.textContent = t;
          childContainer.appendChild(subHeader);
          childByType[t].forEach(c => {
            childContainer.appendChild(buildExplorerNode(c, depth + 1, searchQuery));
          });
        });
      } else {
        filteredChildren.forEach(c => {
          childContainer.appendChild(buildExplorerNode(c, depth + 1, searchQuery));
        });
      }

      wrap.appendChild(childContainer);
    }

    return wrap;
  }

  function showExplorerContextMenu(e, concept) {
    closeExplorerContextMenu();

    const menu = document.createElement('div');
    menu.className = 'wb-explorer-ctx-menu';
    menu.innerHTML = `
      <button class="wb-ctx-item" data-action="subconcept"><span>➕</span> Crear sub-concepto</button>
      <button class="wb-ctx-item" data-action="edit"><span>✏️</span> Editar</button>
      <div class="wb-ctx-divider"></div>
      <button class="wb-ctx-item wb-ctx-danger" data-action="delete"><span>🗑</span> Eliminar</button>`;

    menu.querySelector('[data-action="subconcept"]').addEventListener('click', () => {
      closeExplorerContextMenu();
      openNewConceptModal(null, true);
      // Temporarily set currentConcepto for the subconcept parent
      const prevConcept = currentConcepto;
      currentConcepto = concept;
      // The modal will use currentConcepto as padre_id
      const onClose = () => {
        if (!document.getElementById('modalNewConcept').classList.contains('hidden')) return;
        currentConcepto = prevConcept;
        document.getElementById('modalNewConcept').removeEventListener('transitionend', onClose);
      };
    });

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeExplorerContextMenu();
      openEditConceptModal(concept);
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      closeExplorerContextMenu();
      deleteConceptHierarchyDirect(concept);
    });


    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', closeExplorerContextMenu, { once: true });
    }, 0);
  }

  function closeExplorerContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  function setupSearch() {
    const searchInput = document.getElementById('ipSearch');
    const searchWrap = searchInput?.closest('.wb-explorer-search-wrap');
    const searchToggle = document.getElementById('rpSearchToggle');
    const expandBtn = document.getElementById('rpExpandBtn');

    // Default state: collapsed
    if (searchWrap) searchWrap.classList.add('collapsed');

    if (searchToggle && searchWrap) {
      searchToggle.addEventListener('click', () => {
        const isCollapsed = searchWrap.classList.toggle('collapsed');
        searchToggle.classList.toggle('active', !isCollapsed);
        
        if (!isCollapsed) {
          // Smooth focus after animation starts
          setTimeout(() => searchInput.focus(), 150);
        } else if (searchInput.value.trim() !== '') {
          // Optional: Clear search when collapsing if it has content
          // searchInput.value = '';
          // renderConceptTree('');
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        renderConceptTree(q);
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        document.getElementById('ipRightPanel').classList.toggle('expanded');
      });
    }

    const collapseBtn = document.getElementById('rpCollapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        document.getElementById('ipRightPanel').classList.toggle('collapsed');
      });
    }
  }

  function setupSidebar() {
    document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
    
    // Hover sounds for items
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('mouseenter', playSidebarHoverSound);
    });
  }

  // ── UTILITIES ─────────────────────────────
  function showToast(msg, type) {
    if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(22,8,40,0.96);border:1px solid ${type === 'error' ? 'rgba(168,34,33,0.6)' : 'rgba(219,111,78,0.5)'};color:white;font-family:'Etna';font-size:13px;padding:10px 22px;border-radius:20px;pointer-events:none;white-space:nowrap;`;
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
    const n = bstr.length, u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function randomColor() {
    const colors = ['#db6f4e', '#5a8fd4', '#7b5ea7', '#4a9b6f', '#c85050', '#96783c'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ── LANDSCAPES HELPERS ──────────────

  function getThumbnailUrl(url) {
    if (!url || !url.includes('cloudinary.com') || !url.includes('/upload/')) return url;
    // Insert transformation after /upload/
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/c_scale,w_400,q_auto,f_auto/${parts[1]}`;
  }

  function renderLandscapePreviews() {
    const regionCont = document.getElementById('regionLandscapePreviews');
    const locationCont = document.getElementById('locationLandscapePreviews');
    
    [regionCont, locationCont].forEach(cont => {
      if (!cont) return;
      cont.innerHTML = '';
      tempLandscapes.forEach((url, i) => {
        const item = document.createElement('div'); item.className = 'wb-landscape-preview-item';
        item.innerHTML = `<img src="${getThumbnailUrl(url)}" loading="lazy"><div class="del">✕</div>`;
        item.querySelector('.del').onclick = () => { tempLandscapes.splice(i, 1); renderLandscapePreviews(); };
        cont.appendChild(item);
      });
    });
  }

  function renderLandscapeCarousel(region) {
    const carousel = document.getElementById('viewShapeCarousel');
    carousel.innerHTML = '';
    const images = region.landscapes || [];
    if (!images.length) {
      carousel.innerHTML = '<div style="font-family:\'Etna\';font-size:11px;color:rgba(255,255,255,0.25);padding:10px">No hay paisajes aún.</div>';
      return;
    }
    images.forEach(url => {
      const item = document.createElement('div'); item.className = 'wb-landscape-item';
      item.innerHTML = `<img src="${getThumbnailUrl(url)}" loading="lazy" alt="Landscape">`;
      item.onclick = () => openLightbox(url);
      carousel.appendChild(item);
    });
  }

  function openLightbox(url) {
    const lb = document.getElementById('modalLightbox');
    document.getElementById('lightboxImg').src = url;
    window.ANIM.show(lb, 'anim-modal-in');
  }

  function closeLightbox() {
    window.ANIM.hide(document.getElementById('modalLightbox'), 'anim-modal-out');
  }

  // ── RELATED CONCEPTS HELPERS ──────────

  async function renderRelatedConcepts(shape) {
    const section = document.getElementById('viewShapeRelatedConceptsSection');
    const container = document.getElementById('viewShapeRelatedConcepts');
    const descriptorSection = document.getElementById('viewShapeDescriptorSection');
    const descriptorContainer = document.getElementById('viewShapeDescriptor');

    if (!section || !container || !descriptorSection || !descriptorContainer) return;

    if (!shape.name) { 
      window.ANIM.hide(section, 'anim-fade-out'); 
      window.ANIM.hide(descriptorSection, 'anim-fade-out'); 
      return; 
    }

    try {
      let candidateIds = new Set();

      // 1. Blocks link (explicit)
      let blocks = globalLocationBlocksCache;
      if (!blocks || blocks.length === 0) blocks = await prefetchLocationBlocks();

      if (blocks && blocks.length > 0) {
        blocks.forEach(b => {
          const d = b.data || {};
          if (d.region_id === shape.id || d.location_id === shape.id) {
            if (b.contenidos?.titulo) candidateIds.add(b.contenidos.titulo);
          }
        });
      }

      // 2. Name match (implicit)
      const sName = shape.name.toLowerCase().trim();
      if (sName !== 'región' && sName !== 'locación' && sName.length > 2) {
        conceptosCache.forEach(c => {
          if (!c.titulo) return;
          const cTitle = c.titulo.toLowerCase().trim();
          if (cTitle === sName || (sName.length > 3 && (cTitle.includes(sName) || sName.includes(cTitle)))) {
            candidateIds.add(c.id);
          }
        });
      }

      if (candidateIds.size === 0) {
        window.ANIM.hide(section, 'anim-fade-out');
        window.ANIM.hide(descriptorSection, 'anim-fade-out');
        return;
      }

      const candidates = Array.from(candidateIds)
        .map(id => conceptosCache.find(c => c.id === id))
        .filter(Boolean);

      if (candidates.length === 0) {
        window.ANIM.hide(section, 'anim-fade-out');
        window.ANIM.hide(descriptorSection, 'anim-fade-out');
        return;
      }

      // IDENTIFY DESCRIPTOR
      // Logical priority:
      // a) Exact name match (Highest priority)
      // b) Concept with explicit block link (Fallback)
      let descriptor = null;
      
      // 1. Check exact name match first
      descriptor = candidates.find(c => c.titulo?.toLowerCase().trim() === sName);

      // 2. Fallback to block links if no exact name match
      if (!descriptor && blocks) {
        const explicitLink = blocks.find(b => {
          const d = b.data || {};
          return (d.region_id === shape.id || d.location_id === shape.id);
        });
        if (explicitLink) descriptor = conceptosCache.find(c => c.id === explicitLink.contenidos?.titulo);
      }

      // RENDER DESCRIPTOR
      if (descriptor) {
        window.ANIM.show(descriptorSection, 'anim-fade-in');
        const tipo = descriptor.plantillas_concepto?.nombre || 'Concepto';
        const icono = descriptor.icono_url;
        
        descriptorContainer.innerHTML = `
          <div class="wb-descriptor-icon">
            ${icono ? `<img src="${icono}" alt="">` : `<span>${typeIcon(tipo)}</span>`}
          </div>
          <div class="wb-descriptor-info">
            <span class="wb-descriptor-label">Concepto Descriptor</span>
            <span class="wb-descriptor-title">${descriptor.titulo}</span>
            <span class="wb-descriptor-hint">Haz clic para expandir información</span>
          </div>
        `;

        descriptorContainer.onclick = () => {
          window.ANIM.hide(document.getElementById('modalViewShape'), 'anim-modal-out');
          const tabBtn = document.querySelector('.wb-tab[data-tab="conceptos"]');
          if (tabBtn) tabBtn.click();
          openConceptDetail(descriptor);
        };
      } else {
        window.ANIM.hide(descriptorSection, 'anim-fade-out');
      }

      // RENDER OTHERS (Filter out the descriptor)
      const related = candidates.filter(c => descriptor ? c.id !== descriptor.id : true);

      if (related.length === 0) {
        window.ANIM.hide(section, 'anim-fade-out');
      } else {
        window.ANIM.show(section, 'anim-fade-in');
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        related.forEach(c => {
          const bub = document.createElement('div');
          bub.className = 'wb-hub-concept-bubble';
          const tipo = c.plantillas_concepto?.nombre || 'Concepto';
          const icono = c.icono_url;
          bub.innerHTML = `
            <div class="wb-bubble-icon">
              ${icono ? `<img src="${icono}" alt="">` : typeIcon(tipo)}
            </div>
            <span>${c.titulo}</span>`;
          bub.addEventListener('click', () => {
            window.ANIM.hide(document.getElementById('modalViewShape'), 'anim-modal-out');
            const tabBtn = document.querySelector('.wb-tab[data-tab="conceptos"]');
            if (tabBtn) tabBtn.click();
            openConceptDetail(c);
          });
          frag.appendChild(bub);
        });
        container.appendChild(frag);
      }
    } catch (e) {
      console.error('Error rendering related concepts:', e);
      window.ANIM.hide(section, 'anim-fade-out');
      window.ANIM.hide(descriptorSection, 'anim-fade-out');
    }
  }

  async function prefetchLocationBlocks() {
    try {
      const { data } = await sb.from('bloques')
        .select(`data, contenidos!inner(id, titulo)`)
        .eq('tipo', 'locacion');
      if (data) globalLocationBlocksCache = data;
      return data;
    } catch (e) {
      console.error('Error prefetching location blocks:', e);
      return [];
    }
  }


  window.addEventListener('resize', () => {
    document.querySelectorAll('.wb-block').forEach(updateBlockMasonry);
  });

  init().catch(console.error);
})();
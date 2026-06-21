/**
 * REIKEN SYNC — Yjs CRDT synchronization via Supabase
 * Reemplaza el sistema de guardado manual + auto-save + broadcast draw-step
 *
 * Dependencias: Y (window.Y desde CDN), supabaseClient (window.supabaseClient)
 */

class ReikenPanelSync {
  constructor(panelId, cWidth, cHeight, existingChannel) {
    this.panelId = panelId;
    this.cWidth = cWidth;
    this.cHeight = cHeight;
    this.channel = existingChannel || null;
    this.persistTimer = null;
    this.ready = false;
    this._isApplyingRemote = false;
    this._hasRemoteLayers = false;

    // Yjs doc & shared types — created in init() after Y is loaded
    this.doc = null;
    this.layers = null;
    this.dialogues = null;
    this.bgColor = null;

    // Observer: on remote changes, notify listeners
    this._onRemoteUpdate = null;
  }

  /** Initialize: wait for Yjs → create doc → load from Supabase → subscribe */
  async init() {
    await (window.__yjsPromise || Promise.reject(new Error('__yjsPromise not found')));
    if (!window.Y) throw new Error('Yjs library not loaded');

    this.doc = new window.Y.Doc();
    this.layers = this.doc.getArray('layers');
    this.dialogues = this.doc.getArray('dialogues');
    this.bgColor = this.doc.getText('bgColor');

    await this._loadFromSupabase();
    this._listenToDoc();
    // Subscribe to sync handshake on existing channel
    if (this.channel) {
      // Sync handshake: late-joiner pide estado completo a pares conectados
      // Solo respondemos si el update es pequeño (<100KB) para no saturar Realtime.
      // Si es grande, el late joiner obtiene los datos del persist periódico (~5s).
      this.channel.on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        if (!payload) return;
        try {
          const sv = new Uint8Array(payload.sv);
          const update = window.Y.encodeStateAsUpdate(this.doc, sv);
          if (update.length > 0 && update.length < 100000) {
            this.channel.send({
              type: 'broadcast',
              event: 'sync-response',
              payload: { update: Array.from(new Uint8Array(update)) }
            });
          }
        } catch (e) {}
      });

      this.channel.on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        if (!payload || !payload.update) return;
        try {
          const uint8 = new Uint8Array(payload.update);
          if (uint8.length === 0) return;
          this._isApplyingRemote = true;
          window.Y.applyUpdate(this.doc, uint8, 'remote');
          this._isApplyingRemote = false;
          if (this._onRemoteUpdate) this._onRemoteUpdate();
        } catch (e) {
          this._isApplyingRemote = false;
        }
      });
    }
    this.ready = true;

    // Pedir sync a pares conectados (late-joiner handshake)
    if (this.channel) {
      try {
        const sv = window.Y.encodeStateVector(this.doc);
        this.channel.send({
          type: 'broadcast',
          event: 'sync-request',
          payload: { sv: Array.from(new Uint8Array(sv)) }
        });
      } catch (e) {}
    }
  }

  /** Fetch latest Yjs snapshot from Supabase and apply to doc (with timeout) */
  async _loadFromSupabase() {
    try {
      const result = await Promise.race([
        supabaseClient
          .from('paneles_doc')
          .select('yjs_snapshot')
          .eq('panel_id', this.panelId)
          .maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
      const data = result.data;
      if (data?.yjs_snapshot) {
        const raw = data.yjs_snapshot;
        const uint8 = typeof raw === 'string' ? hexToUint8Array(raw) : new Uint8Array(raw);
        if (uint8.length > 0) {
          this._hasRemoteLayers = true;
          this._isApplyingRemote = true;
          window.Y.applyUpdate(this.doc, uint8, 'remote');
          this._isApplyingRemote = false;
        }
      }
    } catch (e) {
      if (e.message === 'timeout') {
        console.warn('[ReikenSync] Supabase query timed out (table paneles_doc may not exist)');
      } else {
        console.warn('[ReikenSync] Error loading from Supabase:', e);
      }
    }
  }

  /** Listen for local Yjs changes → schedule persist (live sync via draw-step/canvas-sync) */
  _listenToDoc() {
    this.doc.on('update', (update, origin) => {
      if (origin === 'remote' || !this.channel) return;
      this._schedulePersist();
    });
  }

  /** Debounced persist to Supabase */
  _schedulePersist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 5000);
  }

  /** Encode full Yjs doc and upsert to paneles_doc (bytea via hex string) */
  async persist() {
    try {
      const state = window.Y.encodeStateAsUpdate(this.doc);
      await supabaseClient.from('paneles_doc').upsert({
        panel_id: this.panelId,
        yjs_snapshot: `\\x${uint8ArrayToHex(new Uint8Array(state))}`,
        updated_at: new Date().toISOString()
      }, { onConflict: 'panel_id' });
    } catch (e) {
      console.warn('[ReikenSync] Persist error:', e);
    }
  }

  /** Set callback for remote updates (to re-render canvas) */
  onRemoteUpdate(cb) {
    this._onRemoteUpdate = cb;
  }

  /** Capture current canvas layers into Yjs doc */
  syncCanvasToYjs(layersData, bgColorVal, dialoguesArr) {
    if (!this.ready) return;

    // Layers
    const yLayers = this.layers;
    // Clear existing
    while (yLayers.length > 0) yLayers.delete(0, 1);

    layersData.forEach(l => {
      const dataUrl = l.canvas.toDataURL('image/png');
      const pixels = dataURLToUint8Array(dataUrl);
      const map = new window.Y.Map();
      map.set('id', l.id);
      map.set('opacity', l.opacity);
      map.set('pixels', pixels);
      yLayers.push([map]);
    });

    // Background color
    this.bgColor.delete(0, this.bgColor.length);
    this.bgColor.insert(0, bgColorVal);

    // Dialogues
    const yDialogues = this.dialogues;
    while (yDialogues.length > 0) yDialogues.delete(0, 1);
    dialoguesArr.forEach(d => {
      const map = new window.Y.Map();
      Object.keys(d).forEach(k => map.set(k, d[k]));
      yDialogues.push([map]);
    });
  }

  /** Apply Yjs doc state to canvas layers. Returns { layers, bgColor, dialogues } */
  applyToCanvas() {
    if (!this.ready) return null;

    const result = {
      layers: this.layers.toArray().map(l => {
        const pixels = l.get('pixels');
        return {
          id: l.get('id'),
          opacity: l.get('opacity'),
          dataUrl: pixels ? uint8ArrayToDataURL(pixels) : null
        };
      }),
      bgColor: this.bgColor.toString() || '#ffffff',
      dialogues: this.dialogues.toArray().map(d => {
        const obj = {};
        d.forEach((v, k) => { obj[k] = v; });
        return obj;
      })
    };

    // Also apply background color to the doc bgColor if empty
    if (!this.bgColor.toString()) {
      this.bgColor.delete(0, this.bgColor.length);
      this.bgColor.insert(0, result.bgColor);
    }

    return result;
  }

  /** Clean up */
  destroy() {
    clearTimeout(this.persistTimer);
    if (this.channel) {
      supabaseClient.removeChannel(this.channel);
    }
    if (this.doc) this.doc.destroy();
    this.ready = false;
  }
}

// ── Helpers ──────────────────────────────

function dataURLToUint8Array(dataUrl) {
  if (!dataUrl) return new Uint8Array(0);
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return arr;
}

function uint8ArrayToDataURL(uint8) {
  if (!uint8 || uint8.length === 0) return null;
  const blob = new Blob([uint8], { type: 'image/png' });
  return URL.createObjectURL(blob);
}

/** Convert Uint8Array to hex string for PostgREST bytea format */
function uint8ArrayToHex(uint8) {
  return Array.from(uint8).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Parse hex string (with or without \\x prefix) back to Uint8Array */
function hexToUint8Array(hex) {
  const cleanHex = hex.startsWith('\\x') ? hex.slice(2) : hex;
  const bytes = cleanHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || [];
  return new Uint8Array(bytes);
}

window.ReikenPanelSync = ReikenPanelSync;
window.dataURLToUint8Array = dataURLToUint8Array;
window.uint8ArrayToDataURL = uint8ArrayToDataURL;
window.uint8ArrayToHex = uint8ArrayToHex;
window.hexToUint8Array = hexToUint8Array;

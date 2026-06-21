/**
 * Reiken Workspace — Motor de Persistencia Híbrido (Dual-Storage) para Planificación
 * rk_planning_db.js
 */

(function () {
  const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const LOCAL_KEY = (pid) => `rk_plan_local_${pid}`;

  // Helper de generación de UUIDs ligeros en local
  function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Funciones auxiliares para LocalStorage
  function getLocalPlan(projectId) {
    try {
      const raw = localStorage.getItem(LOCAL_KEY(projectId));
      if (!raw) return { seasons: [], plotlines: [], episodes: [], cards: [] };
      const parsed = JSON.parse(raw);
      return {
        seasons: parsed.seasons || [],
        plotlines: parsed.plotlines || [],
        episodes: parsed.episodes || [],
        cards: parsed.cards || []
      };
    } catch (e) {
      console.error("RKPlanning DB: Error leyendo LocalStorage", e);
      return { seasons: [], plotlines: [], episodes: [], cards: [] };
    }
  }

  function saveLocalPlan(projectId, data) {
    try {
      localStorage.setItem(LOCAL_KEY(projectId), JSON.stringify(data));
    } catch (e) {
      console.error("RKPlanning DB: Error guardando en LocalStorage", e);
    }
  }

  // Objeto Global RKPlanning
  const RKPlanning = {
    isLocalMode: false,

    /**
     * Carga todos los datos de planificación del proyecto.
     * Si no hay datos, inicializa la estructura por defecto.
     */
    async load(projectId) {
      if (!projectId) return { seasons: [], plotlines: [], episodes: [], cards: [] };

      // Si ya sabemos que estamos en modo local
      if (this.isLocalMode || !sb) {
        return this._loadLocalAndInitialize(projectId);
      }

      try {
        // Consultar seasons
        const { data: seasons, error: errS } = await sb.from("rk_seasons").select("*").eq("proyecto_id", projectId).order("orden", { ascending: true });
        if (errS) throw errS;

        const { data: plotlines, error: errP } = await sb.from("rk_plotlines").select("*").eq("proyecto_id", projectId).order("orden", { ascending: true });
        if (errP) throw errP;

        const { data: episodes, error: errE } = await sb.from("rk_episodes").select("*").eq("proyecto_id", projectId).order("orden", { ascending: true });
        if (errE) throw errE;

        const { data: cards, error: errC } = await sb.from("rk_plot_cards").select("*").eq("proyecto_id", projectId);
        if (errC) throw errC;

        // Si la base de datos respondió bien pero está completamente vacía, inicializamos por defecto
        if (!seasons || seasons.length === 0) {
          console.log("RKPlanning DB: Proyecto vacío detectado en nube. Inicializando plantilla por defecto...");
          return await this._initializeCloudDefaults(projectId);
        }

        return { seasons, plotlines, episodes, cards };
      } catch (err) {
        // Fallback inmediato si la tabla no existe (ej. error 42P01 de Postgres)
        console.warn("RKPlanning DB: Activando fallback de almacenamiento Local-First. Motivo:", err.message || err);
        this.isLocalMode = true;
        return this._loadLocalAndInitialize(projectId);
      }
    },

    // --- Auxiliar: Cargar e Inicializar Local ---
    _loadLocalAndInitialize(projectId) {
      const plan = getLocalPlan(projectId);
      if (plan.seasons.length === 0) {
        console.log("RKPlanning DB: Inicializando plantilla por defecto en LocalStorage...");
        const defaultSeason = {
          id: generateUUID(),
          proyecto_id: projectId,
          nombre: "Temporada 1",
          descripcion: "Primer arco narrativo del proyecto.",
          orden: 0
        };
        const defaultEpisodes = [
          { id: generateUUID(), proyecto_id: projectId, season_id: defaultSeason.id, numero: 1, titulo: "El Inicio", orden: 0 },
          { id: generateUUID(), proyecto_id: projectId, season_id: defaultSeason.id, numero: 2, titulo: "Nuevos Descubrimientos", orden: 1 },
          { id: generateUUID(), proyecto_id: projectId, season_id: defaultSeason.id, numero: 3, titulo: "Punto de Giro", orden: 2 }
        ];
        const defaultPlotlines = [
          { id: generateUUID(), proyecto_id: projectId, season_id: defaultSeason.id, nombre: "Trama Principal", color: "#db6f4e", orden: 0 },
          { id: generateUUID(), proyecto_id: projectId, season_id: defaultSeason.id, nombre: "Trama Secundaria", color: "#9b5de5", orden: 1 }
        ];

        plan.seasons.push(defaultSeason);
        plan.episodes = defaultEpisodes;
        plan.plotlines = defaultPlotlines;
        saveLocalPlan(projectId, plan);
      }
      return plan;
    },

    // --- Auxiliar: Inicializar Cloud con Defaults ---
    async _initializeCloudDefaults(projectId) {
      try {
        const { data: sData, error: errS } = await sb.from("rk_seasons").insert({
          proyecto_id: projectId,
          nombre: "Temporada 1",
          descripcion: "Primer arco narrativo del proyecto.",
          orden: 0
        }).select().single();
        if (errS) throw errS;

        const defaultEpisodes = [
          { proyecto_id: projectId, season_id: sData.id, numero: 1, titulo: "El Inicio", orden: 0 },
          { proyecto_id: projectId, season_id: sData.id, numero: 2, titulo: "Nuevos Descubrimientos", orden: 1 },
          { proyecto_id: projectId, season_id: sData.id, numero: 3, titulo: "Punto de Giro", orden: 2 }
        ];
        const { data: epData, error: errE } = await sb.from("rk_episodes").insert(defaultEpisodes).select();
        if (errE) throw errE;

        const defaultPlotlines = [
          { proyecto_id: projectId, season_id: sData.id, nombre: "Trama Principal", color: "#db6f4e", orden: 0 },
          { proyecto_id: projectId, season_id: sData.id, nombre: "Trama Secundaria", color: "#9b5de5", orden: 1 }
        ];
        const { data: plData, error: errP } = await sb.from("rk_plotlines").insert(defaultPlotlines).select();
        if (errP) throw errP;

        return {
          seasons: [sData],
          episodes: epData,
          plotlines: plData,
          cards: []
        };
      } catch (err) {
        console.error("RKPlanning DB: Error al escribir valores por defecto en nube, volviendo a Local", err);
        this.isLocalMode = true;
        return this._loadLocalAndInitialize(projectId);
      }
    },

    // ==========================================
    // SEASONS / TEMPORADAS
    // ==========================================
    async saveSeason(projectId, season) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        if (!season.id) {
          season.id = generateUUID();
          season.proyecto_id = projectId;
          season.orden = plan.seasons.length;
          plan.seasons.push(season);
        } else {
          const idx = plan.seasons.findIndex(s => s.id === season.id);
          if (idx !== -1) plan.seasons[idx] = { ...plan.seasons[idx], ...season };
        }
        saveLocalPlan(projectId, plan);
        return season;
      }

      try {
        if (!season.id) {
          const { data, error } = await sb.from("rk_seasons").insert({ ...season, proyecto_id: projectId }).select().single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await sb.from("rk_seasons").update(season).eq("id", season.id).select().single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube, guardando localmente", err);
        this.isLocalMode = true;
        return this.saveSeason(projectId, season);
      }
    },

    async deleteSeason(projectId, id) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        plan.seasons = plan.seasons.filter(s => s.id !== id);
        plan.episodes = plan.episodes.filter(e => e.season_id !== id);
        plan.plotlines = plan.plotlines.filter(p => p.season_id !== id);
        // Borrar tarjetas de estas tramas
        const plIds = plan.plotlines.filter(p => p.season_id === id).map(p => p.id);
        plan.cards = plan.cards.filter(c => !plIds.includes(c.plotline_id));
        saveLocalPlan(projectId, plan);
        return true;
      }

      try {
        const { error } = await sb.from("rk_seasons").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al borrar, ejecutando local", err);
        this.isLocalMode = true;
        return this.deleteSeason(projectId, id);
      }
    },

    // ==========================================
    // PLOTLINES / TRAMAS
    // ==========================================
    async savePlotline(projectId, plotline) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        if (!plotline.id) {
          plotline.id = generateUUID();
          plotline.proyecto_id = projectId;
          plotline.orden = plan.plotlines.filter(p => p.season_id === plotline.season_id).length;
          plan.plotlines.push(plotline);
        } else {
          const idx = plan.plotlines.findIndex(p => p.id === plotline.id);
          if (idx !== -1) plan.plotlines[idx] = { ...plan.plotlines[idx], ...plotline };
        }
        saveLocalPlan(projectId, plan);
        return plotline;
      }

      try {
        if (!plotline.id) {
          const { data, error } = await sb.from("rk_plotlines").insert({ ...plotline, proyecto_id: projectId }).select().single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await sb.from("rk_plotlines").update(plotline).eq("id", plotline.id).select().single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al guardar trama", err);
        this.isLocalMode = true;
        return this.savePlotline(projectId, plotline);
      }
    },

    async deletePlotline(projectId, id) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        plan.plotlines = plan.plotlines.filter(p => p.id !== id);
        plan.cards = plan.cards.filter(c => c.plotline_id !== id);
        saveLocalPlan(projectId, plan);
        return true;
      }

      try {
        const { error } = await sb.from("rk_plotlines").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al borrar trama", err);
        this.isLocalMode = true;
        return this.deletePlotline(projectId, id);
      }
    },

    // ==========================================
    // EPISODES / EPISODIOS
    // ==========================================
    async saveEpisode(projectId, episode) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        if (!episode.id) {
          episode.id = generateUUID();
          episode.proyecto_id = projectId;
          episode.orden = plan.episodes.filter(e => e.season_id === episode.season_id).length;
          plan.episodes.push(episode);
        } else {
          const idx = plan.episodes.findIndex(e => e.id === episode.id);
          if (idx !== -1) plan.episodes[idx] = { ...plan.episodes[idx], ...episode };
        }
        saveLocalPlan(projectId, plan);
        return episode;
      }

      try {
        if (!episode.id) {
          const { data, error } = await sb.from("rk_episodes").insert({ ...episode, proyecto_id: projectId }).select().single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await sb.from("rk_episodes").update(episode).eq("id", episode.id).select().single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al guardar episodio", err);
        this.isLocalMode = true;
        return this.saveEpisode(projectId, episode);
      }
    },

    async deleteEpisode(projectId, id) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        plan.episodes = plan.episodes.filter(e => e.id !== id);
        plan.cards = plan.cards.filter(c => c.episode_id !== id);
        saveLocalPlan(projectId, plan);
        return true;
      }

      try {
        const { error } = await sb.from("rk_episodes").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al borrar episodio", err);
        this.isLocalMode = true;
        return this.deleteEpisode(projectId, id);
      }
    },

    // ==========================================
    // CARDS / TARJETAS
    // ==========================================
    async saveCard(projectId, card) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        if (!card.id) {
          card.id = generateUUID();
          card.proyecto_id = projectId;
          plan.cards.push(card);
        } else {
          const idx = plan.cards.findIndex(c => c.id === card.id);
          if (idx !== -1) plan.cards[idx] = { ...plan.cards[idx], ...card };
        }
        saveLocalPlan(projectId, plan);
        return card;
      }

      try {
        if (!card.id) {
          const { data, error } = await sb.from("rk_plot_cards").insert({ ...card, proyecto_id: projectId }).select().single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await sb.from("rk_plot_cards").update(card).eq("id", card.id).select().single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al guardar tarjeta", err);
        this.isLocalMode = true;
        return this.saveCard(projectId, card);
      }
    },

    async deleteCard(projectId, id) {
      if (this.isLocalMode || !sb) {
        const plan = getLocalPlan(projectId);
        plan.cards = plan.cards.filter(c => c.id !== id);
        saveLocalPlan(projectId, plan);
        return true;
      }

      try {
        const { error } = await sb.from("rk_plot_cards").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("RKPlanning DB: Fallo en nube al borrar tarjeta", err);
        this.isLocalMode = true;
        return this.deleteCard(projectId, id);
      }
    },

    // ==========================================
    // IMPORTACIÓN COMPLETA
    // ==========================================
    async importFullPlan(projectId, fullPlan) {
      if (this.isLocalMode || !sb) {
        saveLocalPlan(projectId, fullPlan);
        return true;
      }

      try {
        // En nube, para importar borramos lo previo e insertamos todo de nuevo
        await sb.from("rk_seasons").delete().eq("proyecto_id", projectId);
        await sb.from("rk_plotlines").delete().eq("proyecto_id", projectId);
        await sb.from("rk_episodes").delete().eq("proyecto_id", projectId);
        await sb.from("rk_plot_cards").delete().eq("proyecto_id", projectId);

        if (fullPlan.seasons?.length) {
          const { error } = await sb.from("rk_seasons").insert(fullPlan.seasons.map(s => ({ ...s, proyecto_id: projectId })));
          if (error) throw error;
        }
        if (fullPlan.plotlines?.length) {
          const { error } = await sb.from("rk_plotlines").insert(fullPlan.plotlines.map(p => ({ ...p, proyecto_id: projectId })));
          if (error) throw error;
        }
        if (fullPlan.episodes?.length) {
          const { error } = await sb.from("rk_episodes").insert(fullPlan.episodes.map(e => ({ ...e, proyecto_id: projectId })));
          if (error) throw error;
        }
        if (fullPlan.cards?.length) {
          const { error } = await sb.from("rk_plot_cards").insert(fullPlan.cards.map(c => ({ ...c, proyecto_id: projectId })));
          if (error) throw error;
        }
        return true;
      } catch (err) {
        console.error("RKPlanning DB: Error al importar plan a la nube, guardando local", err);
        this.isLocalMode = true;
        saveLocalPlan(projectId, fullPlan);
        return true;
      }
    }
  };

  window.RKPlanning = RKPlanning;
})();

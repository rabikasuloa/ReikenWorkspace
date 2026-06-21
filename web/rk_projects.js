/**
 * REIKEN PROJECTS
 * Lógica del dashboard de proyectos.
 */

(function initProjects() {
  const listEl = document.getElementById("projectsList");
  if (!listEl) return;

  const emptyEl = document.getElementById("projectsEmpty");
  const createModal = document.getElementById("createProjectModal");
  const saveBtn = document.getElementById("saveProjectBtn");
  
  let paletteIndex = 0;
  const PALETTES = [
    "linear-gradient(135deg,rgba(180,100,55,0.88),rgba(130,60,30,0.88))",
    "linear-gradient(135deg,rgba(70,80,160,0.88),rgba(40,50,120,0.88))",
    "linear-gradient(135deg,rgba(60,130,100,0.88),rgba(30,90,65,0.88))",
    "linear-gradient(135deg,rgba(140,55,130,0.88),rgba(90,25,90,0.88))",
    "linear-gradient(135deg,rgba(170,70,70,0.88),rgba(110,30,30,0.88))",
  ];

  async function forceRefreshProjects() {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      // Verificación de Onboarding: Si el usuario es nuevo y no tiene roles asignados
      const { data: uRoles } = await supabaseClient.from("usuario_roles").select("id").eq("user_id", user.id);
      if (!uRoles || !uRoles.length) {
        showToast("¡Bienvenido! Completa tu perfil y horario de trabajo para empezar.", "success");
        setTimeout(() => { window.location.href = "personalization.html"; }, 1500);
        return;
      }

      const { data: memberships } = await supabaseClient.from("proyecto_miembros").select("proyecto_id").eq("user_id", user.id);
      if (!memberships || !memberships.length) {
        window.RKCache.save("user_projects", []);
        renderProjectsList([]);
        return;
      }
      const pIds = memberships.map(m => m.proyecto_id);
      const { data: projects } = await supabaseClient.from("proyectos").select("*").in("id", pIds).order("created_at", { ascending: false });
      const freshProjects = projects || [];
      window.RKCache.save("user_projects", freshProjects, 60);
      renderProjectsList(freshProjects);
    } catch (e) {
      console.error("Error refreshing projects list:", e);
    }
  }

  async function loadProjects() {
    // 1. Intentar cargar desde caché (si RKPreloader ya terminó o teníamos de antes)
    const cachedProjects = window.RKCache.get("user_projects");
    if (cachedProjects && cachedProjects.length) {
      renderProjectsList(cachedProjects);
      // Silenciosamente refresca en el fondo
      forceRefreshProjects();
      return;
    }

    // 2. Si no hay caché, escuchamos el evento del Preloader
    document.addEventListener('rk-cache-ready', () => {
      const p = window.RKCache.get("user_projects");
      if (p && p.length) renderProjectsList(p);
      else if (emptyEl) emptyEl.style.display = "flex";
    }, { once: true });
  }

  function renderProjectsList(projects) {
    if (!projects || !projects.length) {
      if (emptyEl) emptyEl.style.display = "flex";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    listEl.innerHTML = "";
    projects.forEach(p => renderProjectCard(p));
    listEl.appendChild(emptyEl); // Keep it at the end
  }

  function renderProjectCard(project) {
    const palette = PALETTES[paletteIndex++ % PALETTES.length];
    const card = document.createElement("div");
    card.className = "project-card";
    card.style.background = palette;
    card.dataset.id = project.id;

    card.innerHTML = `
      <div class="project-card-top">
        <div class="project-card-icon">
          ${project.icono_url ? `<img src="${project.icono_url}" loading="lazy">` : ""}
        </div>
        <div class="project-card-info">
          <h3 class="project-card-name">${project.nombre || "Sin nombre"}</h3>
          <p class="project-card-desc">${project.descripcion || ""}</p>
        </div>
        <button class="project-card-edit" title="Editar">
          <img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774918492/bqy6anncltiqszuimuso.png" loading="lazy">
        </button>
      </div>
      <div class="project-card-banner">
        ${project.banner_url ? `<img src="${project.banner_url}" loading="lazy">` : ""}
      </div>
    `;

    card.querySelector(".project-card-edit").onclick = (e) => {
      e.stopPropagation();
      openEditProjectModal(project);
    };

    card.onclick = () => window.location.href = `index_projects.html?id=${project.id}`;
    listEl.appendChild(card);
  }

  // ── CREAR PROYECTO ───────────────────────────
  let modalBannerURL = null;
  let modalIconURL   = null;
  let pendingMembers = [];

  document.getElementById("openCreateModal")?.addEventListener("click", () => {
    modalBannerURL = null; modalIconURL = null; pendingMembers = [];
    document.getElementById("modalBannerPreview").src = "";
    document.getElementById("modalIconPreview").src = "";
    document.getElementById("modalProjectName").value = "";
    document.getElementById("modalProjectDesc").value = "";
    document.getElementById("addMembersCreateBtn").textContent = "👥 Añadir miembros";
    window.ANIM.show(createModal, 'anim-modal-in');
  });

  const closeC = document.getElementById("closeCreateModal"); if(closeC) closeC.onclick = () => window.ANIM.hide(createModal, 'anim-modal-out');
  const cancelC = document.getElementById("cancelCreateModal"); if(cancelC) cancelC.onclick = () => window.ANIM.hide(createModal, 'anim-modal-out');

  const bannerB = document.getElementById("modalBannerBox"); if(bannerB) bannerB.onclick = () => document.getElementById("modalBannerInput").click();
  const bannerI = document.getElementById("modalBannerInput"); if(bannerI) bannerI.onchange = async (e) => {
    const file = e.target.files[0];
    if (file && (modalBannerURL = await RKCrop.open(file, "banner"))) {
      const img = document.getElementById("modalBannerPreview");
      img.src = modalBannerURL;
      img.classList.add("loaded");
      document.getElementById("modalBannerBox").classList.add("has-image");
    }
  };

  const iconB = document.getElementById("modalIconBox"); if(iconB) iconB.onclick = () => document.getElementById("modalIconInput").click();
  const iconI = document.getElementById("modalIconInput"); if(iconI) iconI.onchange = async (e) => {
    const file = e.target.files[0];
    if (file && (modalIconURL = await RKCrop.open(file, "profile"))) {
      const img = document.getElementById("modalIconPreview");
      img.src = modalIconURL;
      img.classList.add("loaded");
      document.getElementById("modalIconBox").classList.add("has-image");
    }
  };

  const addMB = document.getElementById("addMembersCreateBtn"); if(addMB) addMB.onclick = async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    openUserPicker([user.id, ...pendingMembers], (id) => {
      pendingMembers.push(id);
      document.getElementById("addMembersCreateBtn").textContent = `👥 Añadir miembros (${pendingMembers.length})`;
    });
  };

  if(saveBtn) saveBtn.onclick = async () => {
    const name = document.getElementById("modalProjectName").value.trim();
    if (!name) return showToast("Escribe un nombre", "error");
    
    saveBtn.disabled = true; saveBtn.textContent = "Guardando...";
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      const newProj = { nombre: name, descripcion: document.getElementById("modalProjectDesc").value.trim() };
      
      if (modalBannerURL) newProj.banner_url = await uploadToCloudinary(dataURLtoBlob(modalBannerURL), "banners_proyectos");
      if (modalIconURL) newProj.icono_url = await uploadToCloudinary(dataURLtoBlob(modalIconURL), "iconos_proyectos");

      const { data: inserted, error } = await supabaseClient.from("proyectos").insert(newProj).select().single();
      if (error) throw error;

      await supabaseClient.from("proyecto_miembros").insert({ proyecto_id: inserted.id, user_id: user.id, rol_en_proyecto: "creador" });
      if (pendingMembers.length) {
        await supabaseClient.from("proyecto_miembros").insert(pendingMembers.map(uid => ({ proyecto_id: inserted.id, user_id: uid, rol_en_proyecto: "miembro" })));
      }

      window.RKCache.clearNamespace("user_projects");
      window.RKCache.clearNamespace("prefetch_p_");
      showToast("✔ Proyecto creado");
      window.ANIM.hide(createModal, 'anim-modal-out');
      await forceRefreshProjects();
    } catch(e) { showToast(e.message, "error"); }
    finally { saveBtn.disabled = false; saveBtn.textContent = "¡HECHO!"; }
  };

  // ── EDITAR PROYECTO ───────────────────────────
  let editingId = null;
  let editBannerURL = null;
  let editIconURL = null;

  async function openEditProjectModal(project) {
    editingId = project.id; editBannerURL = null; editIconURL = null;
    let m = document.getElementById("editProjectModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "editProjectModal";
      m.className = "modal-overlay hidden";
      m.innerHTML = `
        <div class="modal-box">
          <div class="modal-header"><h2>Editar Proyecto</h2><button class="modal-close" id="closeEditModal">✕</button></div>
          <div class="modal-banner-box" id="editBannerBox"><img id="editBannerPreview"><span class="modal-banner-hint">Cambiar banner</span></div>
          <input type="file" id="editBannerInput" accept="image/*" hidden>
          <div class="modal-row">
            <div class="modal-icon-box" id="editIconBox"><img id="editIconPreview"><span class="modal-icon-hint">+</span></div>
            <div class="modal-fields">
              <input id="editProjectName" type="text" class="modal-input" placeholder="Nombre">
              <textarea id="editProjectDesc" class="modal-textarea" placeholder="Descripción" rows="3"></textarea>
            </div>
          </div>
          <input type="file" id="editIconInput" accept="image/*" hidden>
          <button class="button-secondary" id="addMembersEditBtn" style="width:100%;margin-bottom:10px">👥 Añadir miembros</button>
          <div class="modal-footer" style="justify-content:space-between">
            <button class="button-delete" id="deleteProjectBtn">🗑 Eliminar</button>
            <div style="display:flex;gap:10px"><button class="button-secondary" id="cancelEditModal">Cancelar</button><button class="button-main" id="saveEditBtn">¡HECHO!</button></div>
          </div>
        </div>
      `;
      document.body.appendChild(m);

      document.getElementById("closeEditModal").onclick = () => window.ANIM.hide(m, 'anim-modal-out');
      document.getElementById("cancelEditModal").onclick = () => window.ANIM.hide(m, 'anim-modal-out');
      document.getElementById("editBannerBox").onclick = () => document.getElementById("editBannerInput").click();
      document.getElementById("editIconBox").onclick = () => document.getElementById("editIconInput").click();

      document.getElementById("editBannerInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file && (editBannerURL = await RKCrop.open(file, "banner"))) {
          const img = document.getElementById("editBannerPreview");
          img.src = editBannerURL;
          img.classList.add("loaded");
          document.getElementById("editBannerBox").classList.add("has-image");
        }
      };
      document.getElementById("editIconInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (file && (editIconURL = await RKCrop.open(file, "profile"))) {
          const img = document.getElementById("editIconPreview");
          img.src = editIconURL;
          img.classList.add("loaded");
          document.getElementById("editIconBox").classList.add("has-image");
        }
      };

      document.getElementById("addMembersEditBtn").onclick = async () => {
        const { data: existing } = await supabaseClient.from("proyecto_miembros").select("user_id").eq("proyecto_id", editingId);
        const exclude = existing.map(m => m.user_id);
        openUserPicker(exclude, async (uid) => {
          await supabaseClient.from("proyecto_miembros").insert({ proyecto_id: editingId, user_id: uid, rol_en_proyecto: "miembro" });
          showToast("✔ Miembro añadido");
        });
      };

  const saveEditBtn = document.getElementById("saveEditBtn");
  if (saveEditBtn) saveEditBtn.onclick = async () => {
    const name = document.getElementById("editProjectName")?.value.trim();
    if (!name) return showToast("Escribe un nombre", "error");
    const btn = document.getElementById("saveEditBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    try {
      const up = { nombre: name, descripcion: document.getElementById("editProjectDesc")?.value.trim() || "" };
      if (editBannerURL) up.banner_url = await uploadToCloudinary(dataURLtoBlob(editBannerURL), "banners_proyectos");
      if (editIconURL) up.icono_url = await uploadToCloudinary(dataURLtoBlob(editIconURL), "iconos_proyectos");
      await supabaseClient.from("proyectos").update(up).eq("id", editingId);
      showToast("✔ Cambios guardados");
      loadProjects();
      window.ANIM.hide(m, 'anim-modal-out');
    } catch(e) { showToast(e.message, "error"); }
    finally { if (btn) { btn.disabled = false; btn.textContent = "¡HECHO!"; } }
  };

  const delBtn = document.getElementById("deleteProjectBtn");
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm("¿Eliminar proyecto para siempre?")) return;
    const pass = prompt("Confirma con la contraseña maestra:");
    if (pass === "#KonathanLabiksuNayueloby200269&") {
      try {
        // 1. Eliminar miembros del proyecto
        await supabaseClient.from("proyecto_miembros").delete().eq("proyecto_id", editingId);

        // 2. Desvincular mensajes auto-referenciados (reply_to_id) de este proyecto y eliminarlos
        await supabaseClient.from("mensajes").update({ reply_to_id: null }).eq("proyecto_id", editingId);
        await supabaseClient.from("mensajes").delete().eq("proyecto_id", editingId);

        // 3. Obtener storyboards para encontrar las escenas y borrar sus paneles
        const { data: sbs } = await supabaseClient.from("storyboards").select("id").eq("proyecto_id", editingId);
        const sbIds = sbs ? sbs.map(s => s.id) : [];
        if (sbIds.length) {
          const { data: scenes } = await supabaseClient.from("escenas").select("id").in("storyboard_id", sbIds);
          if (scenes && scenes.length) {
            const sceneIds = scenes.map(sc => sc.id);
            // 3.a. Eliminar paneles vinculados a las escenas de este proyecto
            await supabaseClient.from("paneles").delete().in("escena_id", sceneIds);
            // 3.b. Eliminar escenas
            await supabaseClient.from("escenas").delete().in("id", sceneIds);
          }
          // 3.c. Eliminar storyboards
          await supabaseClient.from("storyboards").delete().in("id", sbIds);
        }

        // 4. Obtener las secciones del proyecto
        const { data: secs } = await supabaseClient.from("secciones").select("id").eq("proyecto_id", editingId);
        const secIds = secs ? secs.map(s => s.id) : [];

        // 5. Obtener los conceptos vinculados a las secciones
        let conceptIds = [];
        if (secIds.length) {
          const { data: concepts } = await supabaseClient.from("conceptos").select("id").in("seccion_id", secIds);
          if (concepts && concepts.length) {
            conceptIds = concepts.map(c => c.id);
          }
        }

        // 6. Eliminar relaciones de conceptos
        if (conceptIds.length) {
          await supabaseClient.from("concepto_relaciones").delete().in("concepto_origen_id", conceptIds);
          await supabaseClient.from("concepto_relaciones").delete().in("concepto_destino_id", conceptIds);
        }

        // 7. Obtener los contenidos para eliminar relaciones de contenidos y bloques
        const { data: contents } = await supabaseClient.from("contenidos").select("id").eq("proyecto_id", editingId);
        if (contents && contents.length) {
          const contentIds = contents.map(c => c.id);
          // 7.a. Eliminar de la tabla relaciones (contenidos relaciones)
          await supabaseClient.from("relaciones").delete().in("origen_id", contentIds);
          await supabaseClient.from("relaciones").delete().in("destino_id", contentIds);
          // 7.b. Eliminar bloques vinculados a los contenidos
          await supabaseClient.from("bloques").delete().in("contenido_id", contentIds);
          // 7.c. Eliminar los contenidos
          await supabaseClient.from("contenidos").delete().in("id", contentIds);
        }

        // 8. Eliminar conceptos (primero anular padre_id por auto-referencia, luego borrar)
        if (conceptIds.length) {
          await supabaseClient.from("conceptos").update({ padre_id: null }).in("id", conceptIds);
          await supabaseClient.from("conceptos").delete().in("id", conceptIds);
        }

        // 9. Eliminar escenas que hayan quedado vinculadas por seccion_id directa (si las hay)
        if (secIds.length) {
          const { data: extraScenes } = await supabaseClient.from("escenas").select("id").in("seccion_id", secIds);
          if (extraScenes && extraScenes.length) {
            const extraSceneIds = extraScenes.map(sc => sc.id);
            await supabaseClient.from("paneles").delete().in("escena_id", extraSceneIds);
            await supabaseClient.from("escenas").delete().in("id", extraSceneIds);
          }
        }

        // 10. Eliminar secciones de este proyecto
        await supabaseClient.from("secciones").delete().eq("proyecto_id", editingId);

        // 11. Finalmente, eliminar el proyecto propiamente dicho
        const { error: errProj } = await supabaseClient.from("proyectos").delete().eq("id", editingId);
        if (errProj) throw errProj;

        window.RKCache.clearNamespace("user_projects");
        window.RKCache.clearNamespace("prefetch_p_");
        showToast("✔ Proyecto eliminado");
        await forceRefreshProjects();
        window.ANIM.hide(m, 'anim-modal-out');
      } catch (err) {
        console.error("Error al eliminar proyecto:", err);
        showToast("Error al eliminar: " + err.message, "error");
      }
    } else {
      showToast("Contraseña incorrecta", "error");
    }
  };
}

    const nIn = document.getElementById("editProjectName"); if(nIn) nIn.value = project.nombre || "";
    const dIn = document.getElementById("editProjectDesc"); if(dIn) dIn.value = project.descripcion || "";
    const bPr = document.getElementById("editBannerPreview"); if(bPr) bPr.src = project.banner_url || "";
    const iPr = document.getElementById("editIconPreview"); if(iPr) iPr.src = project.icono_url || "";
    window.ANIM.show(m, 'anim-modal-in');
  }

  loadProjects();

  // Sidebar controls
  document.getElementById("sidebarToggle")?.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("collapsed"));

  // Sidebar hover sounds
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('mouseenter', () => window.RKSound?.play('hover'));
  });

  // Delegación de eventos para botones globales
  document.addEventListener("click", e => {
    if (e.target.closest("#appearanceBtn")) { injectAppearanceModal(); window.ANIM.show(document.getElementById("appearanceModal"), 'anim-modal-in'); }
    if (e.target.closest("#configBtn")) { injectConfigModal(); window.ANIM.show(document.getElementById("configModal"), 'anim-modal-in'); }
    if (e.target.closest("#profileBtn")) { toggleProfileCard(e.target.closest("#profileBtn")); }
  });

})();

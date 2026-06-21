/**
 * REIKEN PERSONALIZATION
 * Lógica de la página de edición de perfil.
 */

(function initPersonalization() {
  const container = document.getElementById("rolesPrincipalContainer");
  if (!container) return;

  const state = {
    primaryRole:    null,
    secondaryRoles: [],
    availability:   {}, 
    avatarDataURL:  null,
    profileDataURL: null,
    bannerDataURL:  null,
  };

  const rolPrincipalBtn       = document.getElementById("rolPrincipalBtn");
  const rolSecundarioBtn      = document.getElementById("rolSecundarioBtn");
  const rolPrincipalDropdown  = document.getElementById("rolPrincipalDropdown");
  const rolSecundarioDropdown = document.getElementById("rolSecundarioDropdown");
  const rolesPrincipalContainer   = document.getElementById("rolesPrincipalContainer");
  const rolesSecundariosContainer = document.getElementById("rolesSecundariosContainer");

  // Al hacer clic, alternar dropdowns
  rolPrincipalBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.ANIM.toggle(rolPrincipalDropdown, 'anim-slide-up', 'anim-slide-down-out');
    window.ANIM.hide(rolSecundarioDropdown, 'anim-slide-down-out');
  });

  rolSecundarioBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.ANIM.toggle(rolSecundarioDropdown, 'anim-slide-up', 'anim-slide-down-out');
    window.ANIM.hide(rolPrincipalDropdown, 'anim-slide-down-out');
  });

  document.addEventListener("click", () => {
    window.ANIM.hide(rolPrincipalDropdown, 'anim-slide-down-out');
    window.ANIM.hide(rolSecundarioDropdown, 'anim-slide-down-out');
  });

  async function loadRoles() {
    const { data, error } = await supabaseClient.from("roles").select("*");
    if (error || !data) return;

    rolPrincipalDropdown.innerHTML  = "";
    rolSecundarioDropdown.innerHTML = "";

    data.forEach(role => {
      const iconUrl = role.icon_url || ROLE_ICONS[role.nombre] || "";
      const iconHTML = iconUrl ? `<img class="dropdown-role-icon" src="${iconUrl}" alt="">` : `<div class="dropdown-circle"></div>`;

      // Item Rol Principal
      const it1 = document.createElement("div");
      it1.className = "dropdown-item";
      it1.innerHTML = `<div class="dropdown-row">${iconHTML}<span>${role.nombre}</span></div>`;
      it1.onclick = () => {
        state.primaryRole = { id: role.id, nombre: role.nombre };
        rolesPrincipalContainer.innerHTML = `<span class="role-tag">${iconUrl ? `<img class="role-tag-icon" src="${iconUrl}">` : ''}${role.nombre}</span>`;
        window.ANIM.hide(rolPrincipalDropdown, 'anim-slide-down-out');
      };
      rolPrincipalDropdown.appendChild(it1);

      // Item Rol Secundario
      const it2 = document.createElement("div");
      it2.className = "dropdown-item";
      it2.innerHTML = `<div class="dropdown-row">${iconHTML}<span>${role.nombre}</span></div><span class="dropdown-check"></span>`;
      it2.onclick = () => {
        const isSelected = state.secondaryRoles.some(r => r.id == role.id);
        if (isSelected) {
            state.secondaryRoles = state.secondaryRoles.filter(r => r.id != role.id);
            it2.querySelector(".dropdown-check").textContent = "";
            it2.classList.remove("selected");
            rolesSecundariosContainer.querySelector(`[data-id="${role.id}"]`)?.remove();
        } else {
            state.secondaryRoles.push({ id: role.id, nombre: role.nombre });
            it2.querySelector(".dropdown-check").textContent = "✔";
            it2.classList.add("selected");
            const tag = document.createElement("span");
            tag.className = "role-tag";
            tag.dataset.id = role.id;
            tag.innerHTML = `${iconUrl ? `<img class="role-tag-icon" src="${iconUrl}">` : ''}${role.nombre}`;
            rolesSecundariosContainer.appendChild(tag);
        }
      };
      rolSecundarioDropdown.appendChild(it2);
    });
  }

  loadRoles();

  async function loadExistingUserData() {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      // 1. Cargar datos de Usuarios (alias, color_alias, foto_url, banner_url)
      const { data: userData } = await supabaseClient.from("usuarios").select("*").eq("id", user.id).single();
      if (userData) {
        const aliasInput = document.getElementById("aliasInput");
        const colorInput = document.getElementById("colorInput");
        const colorWheel = document.getElementById("colorWheel");
        const aliasPreview = document.getElementById("aliasPreview");

        if (aliasInput && userData.alias) {
          aliasInput.value = userData.alias;
          if (aliasPreview) aliasPreview.textContent = userData.alias;
        }
        if (colorInput && userData.color_alias) {
          colorInput.value = userData.color_alias;
          if (colorWheel) colorWheel.value = userData.color_alias;
          if (aliasPreview) aliasPreview.style.color = userData.color_alias;
        }
        if (userData.foto_url) {
          const profilePreview = document.getElementById("profilePreview");
          if (profilePreview) {
            profilePreview.src = userData.foto_url;
            profilePreview.classList.add("loaded");
            document.querySelector(".profile-photo")?.classList.add("has-image");
          }
          const avatarPreview = document.getElementById("avatarPreview");
          if (avatarPreview) {
            avatarPreview.src = userData.foto_url;
            avatarPreview.classList.add("loaded");
            document.querySelector(".profile-box")?.classList.add("has-image");
          }
        }
        if (userData.banner_url) {
          const bannerPreview = document.getElementById("bannerPreview");
          if (bannerPreview) {
            bannerPreview.src = userData.banner_url;
            bannerPreview.classList.add("loaded");
            document.querySelector(".banner-box")?.classList.add("has-image");
          }
        }
      }

      // 2. Cargar Roles asignados
      const { data: userRoles } = await supabaseClient.from("usuario_roles").select("*, roles(*)").eq("user_id", user.id);
      if (userRoles && userRoles.length) {
        userRoles.forEach(ur => {
          if (!ur.roles) return;
          const role = ur.roles;
          const iconUrl = role.icon_url || window.ROLE_ICONS[role.nombre] || "";
          if (ur.tipo === "principal") {
            state.primaryRole = { id: role.id, nombre: role.nombre };
            rolesPrincipalContainer.innerHTML = `<span class="role-tag">${iconUrl ? `<img class="role-tag-icon" src="${iconUrl}">` : ''}${role.nombre}</span>`;
          } else if (ur.tipo === "secundario") {
            if (!state.secondaryRoles.some(r => r.id == role.id)) {
              state.secondaryRoles.push({ id: role.id, nombre: role.nombre });
              const tag = document.createElement("span");
              tag.className = "role-tag";
              tag.dataset.id = role.id;
              tag.innerHTML = `${iconUrl ? `<img class="role-tag-icon" src="${iconUrl}">` : ''}${role.nombre}`;
              rolesSecundariosContainer.appendChild(tag);

              // Marcar check en dropdown si ya cargó
              const items = [...rolSecundarioDropdown.querySelectorAll(".dropdown-item")];
              const item = items.find(i => i.textContent.includes(role.nombre));
              if (item) {
                item.classList.add("selected");
                const chk = item.querySelector(".dropdown-check");
                if (chk) chk.textContent = "✔";
              }
            }
          }
        });
      }

      // 3. Cargar Disponibilidad
      const { data: dispo } = await supabaseClient.from("disponibilidad").select("*").eq("user_id", user.id);
      if (dispo && dispo.length) {
        dispo.forEach(d => {
          state.availability[d.dia] = { inicio: d.hora_inicio || "", fin: d.hora_fin || "" };
          const span = document.querySelector(`.days span[data-day="${d.dia}"]`);
          if (span) span.classList.add("active");
        });
        // Sincronizar el select con el primer día activo
        const firstActive = dispo[0];
        if (firstActive) {
          const daySelect = document.getElementById("daySelect");
          const startTime = document.getElementById("startTime");
          const endTime = document.getElementById("endTime");
          if (daySelect) daySelect.value = firstActive.dia;
          if (startTime) startTime.value = firstActive.hora_inicio || "";
          if (endTime) endTime.value = firstActive.hora_fin || "";
        }
      }

    } catch (e) {
      console.warn("Error cargando perfil existente:", e);
    }
  }

  loadExistingUserData();

  // Gestión de imágenes
  const avatarInput = document.getElementById("avatarInput");
  const profilePhotoBox = document.querySelector(".profile-photo");
  const bannerBox = document.getElementById("bannerPreview");

  document.querySelector(".profile-box")?.addEventListener("click", () => avatarInput?.click());
  profilePhotoBox?.addEventListener("click", () => document.getElementById("profileUpload")?.click());
  bannerBox?.addEventListener("click", () => document.getElementById("bannerInput")?.click());

  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    if (file && (state.avatarDataURL = await RKCrop.open(file, "avatar"))) {
      const img = document.getElementById("avatarPreview");
      img.src = state.avatarDataURL;
      img.classList.add("loaded");
      document.querySelector(".profile-box")?.classList.add("has-image");
    }
  });

  document.getElementById("profileUpload")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file && (state.profileDataURL = await RKCrop.open(file, "profile"))) {
      const img = document.getElementById("profilePreview");
      img.src = state.profileDataURL;
      img.classList.add("loaded");
      document.querySelector(".profile-photo")?.classList.add("has-image");
    }
  });

  document.getElementById("bannerInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file && (state.bannerDataURL = await RKCrop.open(file, "banner"))) {
      const img = document.getElementById("bannerPreview");
      img.src = state.bannerDataURL;
      img.classList.add("loaded");
      document.querySelector(".banner-box")?.classList.add("has-image");
    }
  });

  // Disponibilidad
  document.querySelectorAll(".days span").forEach(span => {
    span.addEventListener("click", () => {
      span.classList.toggle("active");
      const day = span.dataset.day;
      if (span.classList.contains("active")) state.availability[day] = { inicio: "", fin: "" };
      else delete state.availability[day];
    });
  });

  const syncSchedule = () => {
    const day = document.getElementById("daySelect")?.value;
    if (day && state.availability[day]) {
      state.availability[day].inicio = document.getElementById("startTime")?.value || "";
      state.availability[day].fin = document.getElementById("endTime")?.value || "";
    }
  };
  ["daySelect", "startTime", "endTime"].forEach(id => document.getElementById(id)?.addEventListener("change", syncSchedule));

  // Guardar Roles
  document.getElementById("saveRoles")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveRoles");
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("Inicie sesión");

      if (state.avatarDataURL) {
        const url = await uploadToCloudinary(dataURLtoBlob(state.avatarDataURL), "avatars");
        await supabaseClient.from("usuarios").update({ foto_url: url }).eq("id", user.id);
      }

      await supabaseClient.from("usuario_roles").delete().eq("user_id", user.id);
      const roles = [];
      if (state.primaryRole) roles.push({ user_id: user.id, rol_id: state.primaryRole.id, tipo: "principal" });
      state.secondaryRoles.forEach(r => roles.push({ user_id: user.id, rol_id: r.id, tipo: "secundario" }));
      if (roles.length) await supabaseClient.from("usuario_roles").insert(roles);
      
      showToast("✔ Roles actualizados");
    } catch (e) { showToast(e.message, "error"); }
    finally { btn.disabled = false; btn.textContent = "Actualizar"; }
  });

  // Guardar Perfil (Alias, Color, Fuente, Banner, FotoPerfil)
  document.getElementById("saveProfile")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveProfile");
    const nameInput = document.getElementById("aliasInput");
    const colorInput = document.getElementById("colorInput");
    const fontInput = document.getElementById("fontFileInput");
    
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      const updates = { 
        alias: nameInput?.value.trim(), 
        color_alias: colorInput?.value.trim() 
      };

      if (state.profileDataURL) updates.foto_url = await uploadToCloudinary(dataURLtoBlob(state.profileDataURL), "avatars");
      if (state.bannerDataURL) updates.banner_url = await uploadToCloudinary(dataURLtoBlob(state.bannerDataURL), "banners");
      
      const fontFile = fontInput?.files[0];
      if (fontFile) updates.fuente_alias = await uploadToCloudinary(fontFile, "fonts", "raw");

      await supabaseClient.from("usuarios").update(updates).eq("id", user.id);
      showToast("✔ Perfil actualizado");
    } catch (e) { showToast(e.message, "error"); }
    finally { btn.disabled = false; btn.textContent = "Actualizar"; }
  });

  // Guardar Disponibilidad
  document.getElementById("saveDisponibilidad")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveDisponibilidad");
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      syncSchedule();
      const rows = Object.entries(state.availability).filter(([,v]) => v.inicio && v.fin).map(([dia, v]) => ({
        user_id: user.id, dia, hora_inicio: v.inicio, hora_fin: v.fin
      }));
      if (!rows.length) throw new Error("Seleccione al menos un día con horario");
      await supabaseClient.from("disponibilidad").delete().eq("user_id", user.id);
      await supabaseClient.from("disponibilidad").insert(rows);
      showToast("✔ Disponibilidad actualizada");
    } catch (e) { showToast(e.message, "error"); }
    finally { btn.disabled = false; btn.textContent = "Actualizar"; }
  });

  document.getElementById("finishBtn")?.addEventListener("click", () => window.location.href = "index_projects.html");
})();

// Alias Preview and Font Loader
(function initAliasPreview() {
  const input = document.getElementById("aliasInput");
  const preview = document.getElementById("aliasPreview");
  const colorIn = document.getElementById("colorInput");
  const colorWheel = document.getElementById("colorWheel");
  const fontFile = document.getElementById("fontFileInput");
  if (!input) return;

  const update = () => {
    preview.textContent = input.value || "Tu alias";
    preview.style.color = colorIn.value;
  };

  input.oninput = update;
  colorIn.oninput = update;
  colorWheel.oninput = () => { colorIn.value = colorWheel.value; update(); };
  
  fontFile.onchange = () => {
    const file = fontFile.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const name = "TmpFont_" + Date.now();
      const face = new FontFace(name, `url(${url})`);
      face.load().then(f => {
        document.fonts.add(f);
        preview.style.fontFamily = `'${name}', sans-serif`;
      });
    }
  };

  // ── Staggered card entrance ──
  document.addEventListener('DOMContentLoaded', () => {
    window.ANIM.stagger('.personalization-container', 200, 'anim-card-in');
  });
})();

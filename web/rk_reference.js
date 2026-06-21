/**
 * REIKEN REFERENCE BOARD
 * Maneja el tablón de referencias (Individual y Compartido) y la co-presencia de Avatares
 */

window.RKReference = {
  currentTab: 'individual',
  currentMode: 'view', // 'view' | 'edit'
  images: {
    individual: [],
    shared: []
  },
  transform: { x: 0, y: 0, scale: 1 },
  selectedImageId: null,
  panelId: null,
  channel: null, // set from escena.js
  currentUser: null,

  init(panelId, currentUser) {
    this.panelId = panelId;
    this.currentUser = currentUser;
    this.cacheKey = `rk_refs_ind_${panelId}`;
    
    // Load local (Individual)
    try {
      const stored = localStorage.getItem(this.cacheKey);
      if (stored) this.images.individual = JSON.parse(stored);
    } catch(e){}

    this.bindEvents();
    this.render();
    
    // Load remote (Shared)
    this.loadSharedFromDB();
  },

  async loadSharedFromDB() {
    if(!this.panelId || !window.supabaseClient) return;
    try {
      const { data: panel } = await window.supabaseClient.from('paneles').select('canvas_data').eq('id', this.panelId).single();
      if(panel && panel.canvas_data && panel.canvas_data.referencias) {
        this.images.shared = panel.canvas_data.referencias;
        if (this.currentTab === 'shared') this.render();
      }
    } catch(e) {
      console.error("Error loading shared references:", e);
    }
  },

  async saveSharedToDB() {
    if(!this.panelId || !window.supabaseClient) return;
    try {
      const { data: panel } = await window.supabaseClient.from('paneles').select('canvas_data').eq('id', this.panelId).single();
      const currentData = panel?.canvas_data || {};
      currentData.referencias = this.images.shared;
      await window.supabaseClient.from('paneles').update({ canvas_data: currentData }).eq('id', this.panelId);
    } catch(e) {
      console.error("Error saving shared references:", e);
    }
  },

  setChannel(channel) {
    this.channel = channel;
  },

  handleRemoteSync(payload) {
    if (payload.userId === this.currentUser?.id) return;
    this.images.shared = payload.images;
    if (this.currentTab === 'shared') this.render();
  },

  broadcastUpdate() {
    if (this.currentTab === 'shared' && this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'ref-sync',
        payload: {
          userId: this.currentUser?.id,
          images: this.images.shared
        }
      });
      // Save to Supabase persistently
      this.saveSharedToDB();
    } else {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.images.individual));
    }
  },

  bindEvents() {
    const win = document.getElementById('refBoardWindow');
    const header = document.getElementById('refBoardHeader');
    const toggleBtn = document.getElementById('toggleRefBoardBtn');
    const closeBtn = document.getElementById('closeRefBoardBtn');
    const btnView = document.getElementById('refModeView');
    const btnEdit = document.getElementById('refModeEdit');
    const btnAdd = document.getElementById('refAddImgBtn');
    const fileInput = document.getElementById('refFileInput');
    const tabs = document.querySelectorAll('.ref-tab');

    // Toggle window
    toggleBtn?.addEventListener('click', () => {
      window.ANIM.toggle(win, 'anim-scale-in', 'anim-scale-out');
    });
    closeBtn?.addEventListener('click', () => window.ANIM.hide(win, 'anim-scale-out'));

    // Window Dragging
    let isDraggingWin = false, wx = 0, wy = 0;
    header.addEventListener('pointerdown', e => {
      if(e.target.closest('.ref-tabs') || e.target.closest('.action-btn')) return;
      isDraggingWin = true;
      wx = e.clientX - win.offsetLeft;
      wy = e.clientY - win.offsetTop;
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove', e => {
      if (!isDraggingWin) return;
      win.style.left = (e.clientX - wx) + 'px';
      win.style.top = (e.clientY - wy) + 'px';
    });
    header.addEventListener('pointerup', e => {
      isDraggingWin = false;
      header.releasePointerCapture(e.pointerId);
    });

    // Keyboard Deletion
    window.addEventListener('keydown', e => {
      if(win.classList.contains('hidden')) return;
      if(this.currentMode !== 'edit') return;
      if((e.key === 'Delete' || e.key === 'Backspace') && this.selectedImageId) {
        if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        this.images[this.currentTab] = this.images[this.currentTab].filter(i => i.id !== this.selectedImageId);
        this.selectedImageId = null;
        this.broadcastUpdate();
        this.render();
      }
    });

    // Modes
    btnView.addEventListener('click', () => {
      this.currentMode = 'view';
      btnView.classList.add('active');
      btnEdit.classList.remove('active');
      this.selectedImageId = null;
      this.render();
      document.getElementById('refCanvasWrapper').classList.remove('editing');
    });
    btnEdit.addEventListener('click', () => {
      this.currentMode = 'edit';
      btnEdit.classList.add('active');
      btnView.classList.remove('active');
      document.getElementById('refCanvasWrapper').classList.add('editing');
    });

    const btnAutoPack = document.getElementById('refAutoPackBtn');
    if (btnAutoPack) {
      btnAutoPack.addEventListener('click', () => this.autoPack());
    }

    // Tabs
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.type;
        this.selectedImageId = null;
        this.render();
      });
    });

    // Adding Images
    btnAdd.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      
      const file = e.target.files[0];
      const dataUrl = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(file);
      });

      // Find center of current view
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString();
        const targetList = this.images[this.currentTab];
        
        const newImgObj = {
          id: tempId,
          url: dataUrl, // Local Base64 temporary URL
          x: -this.transform.x + 50,
          y: -this.transform.y + 50,
          width: img.width > 300 ? 300 : img.width,
          height: img.width > 300 ? (img.height * (300/img.width)) : img.height,
          isUploading: true // Flag to show a spinner / styling
        };
        
        targetList.push(newImgObj);
        this.render(); // Render instantly with local image!

        // Upload to Cloudinary to save massive space and allow reliable syncing in background
        try {
          if (window.uploadToCloudinary) {
            const cdnUrl = await window.uploadToCloudinary(file, "referencias");
            if (cdnUrl) {
              newImgObj.url = cdnUrl;
            }
          }
        } catch (err) {
          console.error("Cloudinary upload failed for reference, keeping base64", err);
        }

        // Remove uploading flag
        newImgObj.isUploading = false;
        
        // Finalize state and broadcast/sync
        this.broadcastUpdate();
        this.render(); // Re-render to clear temporary base64 and show clean image
      };
      
      fileInput.value = "";
    });

    // Pan & Zoom
    const body = document.getElementById('refBoardBody');
    let isPanning = false, startX, startY, origX, origY;
    
    body.addEventListener('pointerdown', e => {
      // In edit mode, allow panning ONLY if clicking directly on empty space
      if (this.currentMode === 'edit' && e.target.closest('.ref-img')) return;
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = this.transform.x;
      origY = this.transform.y;
      body.setPointerCapture(e.pointerId);
    });

    body.addEventListener('pointermove', e => {
      if (!isPanning) return;
      this.transform.x = origX + (e.clientX - startX);
      this.transform.y = origY + (e.clientY - startY);
      this.applyTransform();
    });

    body.addEventListener('pointerup', e => {
      isPanning = false;
      body.releasePointerCapture(e.pointerId);
    });

    body.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = body.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.max(0.1, Math.min(this.transform.scale * zoomAmount, 5));
      const ratio = newScale / this.transform.scale;
      
      this.transform.x = mouseX - (mouseX - this.transform.x) * ratio;
      this.transform.y = mouseY - (mouseY - this.transform.y) * ratio;
      this.transform.scale = newScale;
      
      this.applyTransform();
    });
  },

  applyTransform() {
    const wrapper = document.getElementById('refCanvasWrapper');
    wrapper.style.transform = `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.scale})`;
  },

  autoPack() {
    const list = this.images[this.currentTab];
    if (!list || list.length === 0) return;

    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const padding = 20;
    const maxWidth = 1000;

    list.forEach(img => {
      if (currentX + img.width > maxWidth && currentX > 0) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }
      img.x = currentX;
      img.y = currentY;
      
      currentX += img.width + padding;
      if (img.height > rowHeight) rowHeight = img.height;
    });

    this.broadcastUpdate();
    this.render();
  },

  render() {
    const wrapper = document.getElementById('refCanvasWrapper');
    wrapper.innerHTML = '';
    const list = this.images[this.currentTab];

    list.forEach(imgData => {
      const el = document.createElement('div');
      let classes = ['ref-img'];
      if (this.selectedImageId === imgData.id) classes.push('selected');
      if (imgData.isUploading) classes.push('uploading');
      el.className = classes.join(' ');
      el.style.left = imgData.x + 'px';
      el.style.top = imgData.y + 'px';
      el.style.width = imgData.width + 'px';
      el.style.height = imgData.height + 'px';
      
      const img = document.createElement('img');
      img.src = imgData.url;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.draggable = false;

      const delBtn = document.createElement('div');
      delBtn.className = 'ref-img-delete';
      delBtn.innerHTML = '✕';
      delBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.images[this.currentTab] = this.images[this.currentTab].filter(i => i.id !== imgData.id);
        this.selectedImageId = null;
        this.broadcastUpdate();
        this.render();
      });

      const resizer = document.createElement('div');
      resizer.className = 'ref-img-resize';
      
      // Resize logic
      let isResizing = false, rx=0, ry=0, origW, origH;
      resizer.addEventListener('pointerdown', e => {
        if(this.currentMode !== 'edit') return;
        e.stopPropagation();
        isResizing = true;
        rx = e.clientX; ry = e.clientY;
        origW = imgData.width; origH = imgData.height;
        resizer.setPointerCapture(e.pointerId);
      });
      resizer.addEventListener('pointermove', e => {
        if(!isResizing) return;
        const scale = this.transform.scale;
        const dx = (e.clientX - rx) / scale;
        const dy = (e.clientY - ry) / scale;
        imgData.width = origW + dx;
        imgData.height = origH + dy;
        el.style.width = imgData.width + 'px';
        el.style.height = imgData.height + 'px';
      });
      resizer.addEventListener('pointerup', e => {
        if(!isResizing) return;
        isResizing = false;
        resizer.releasePointerCapture(e.pointerId);
        this.broadcastUpdate();
      });

      // Drag logic
      let isDraggingImg = false, px=0, py=0, ox, oy;
      el.addEventListener('pointerdown', e => {
        // --- EYEDROPPER LOGIC ---
        if (window.RKActiveTool && window.RKActiveTool() === 'eyedropper') {
          e.stopPropagation();
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const rect = img.getBoundingClientRect();
          const scaleX = img.naturalWidth / rect.width;
          const scaleY = img.naturalHeight / rect.height;

          const x = (e.clientX - rect.left) * scaleX;
          const y = (e.clientY - rect.top) * scaleY;

          const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          const hex = "#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join("");
          if (window.RKApplyColor) window.RKApplyColor(hex);
          return;
        }

        if(this.currentMode !== 'edit') return;
        e.stopPropagation();

        // 1. Manage selection classes directly in DOM
        document.querySelectorAll('.ref-img').forEach(item => item.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedImageId = imgData.id;

        // 2. Bring to front directly in DOM (appending element to parent moves it to top)
        wrapper.appendChild(el);

        // 3. Bring to front in data array
        const list = this.images[this.currentTab];
        const idx = list.findIndex(i => i.id === imgData.id);
        if(idx > -1 && idx < list.length - 1) {
          const [removed] = list.splice(idx, 1);
          list.push(removed);
        }

        // 4. Start dragging on the same alive element
        isDraggingImg = true;
        px = e.clientX; py = e.clientY;
        ox = imgData.x; oy = imgData.y;
        el.setPointerCapture(e.pointerId);

        const moveHandler = moveE => {
          if(!isDraggingImg) return;
          const scale = this.transform.scale;
          imgData.x = ox + (moveE.clientX - px) / scale;
          imgData.y = oy + (moveE.clientY - py) / scale;
          el.style.left = imgData.x + 'px';
          el.style.top = imgData.y + 'px';
        };

        const upHandler = upE => {
          if(!isDraggingImg) return;
          isDraggingImg = false;
          el.releasePointerCapture(upE.pointerId);
          el.removeEventListener('pointermove', moveHandler);
          el.removeEventListener('pointerup', upHandler);
          
          this.broadcastUpdate();
          this.render(); // Clean rebuild of deletion and resize handles
        };

        el.addEventListener('pointermove', moveHandler);
        el.addEventListener('pointerup', upHandler);
      });

      el.appendChild(img);
      el.appendChild(delBtn);
      el.appendChild(resizer);
      wrapper.appendChild(el);
    });

    this.applyTransform();
  }
};

// --- PRESENCE AVATARS ---
window.RKPresence = {
  channel: null,
  setChannel(channel) {
    this.channel = channel;
  },
  renderAvatars(usersArray) {
    const container = document.getElementById('presenceContainer');
    if(!container) return;
    container.innerHTML = '';

    // Deduplicar usuarios por ID para evitar "avatares fantasma" si Supabase duplica presencias
    const uniqueUsersMap = new Map();
    usersArray.forEach(u => {
      if (u && u.id) uniqueUsersMap.set(u.id, u);
    });

    // Agrega el usuario local si no está en la lista de presencias aún
    const curUser = window.currentUser || window.RKReference.currentUser;
    if (curUser && !uniqueUsersMap.has(curUser.id)) {
        uniqueUsersMap.set(curUser.id, {
            id: curUser.id,
            alias: document.getElementById("sidebarAlias")?.textContent || "Tú",
            colorAlias: document.getElementById("sidebarAlias")?.style.color || "#fff",
            avatarUrl: document.getElementById("sidebarAvatarImg")?.src || "icons/Tu.png"
        });
    }

    const allUsers = Array.from(uniqueUsersMap.values());

    allUsers.forEach(u => {
      const img = document.createElement('img');
      img.className = 'presence-avatar';
      img.src = u.avatarUrl || 'icons/Tu.png';
      img.title = u.alias || 'Usuario';
      img.style.borderColor = u.colorAlias || '#db6f4e';
      img.dataset.uid = u.id;

      // Interaction for local user
      if (curUser && u.id === curUser.id) {
        img.classList.add('is-local');
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleReactionPicker(curUser.id);
        });
      }

      // Contenedor individual relativo para anclar la animación
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.appendChild(img);

      container.appendChild(wrapper);
    });

    // Cierra el picker si se hace clic fuera
    document.addEventListener('click', this.closeReactionPicker);
  },

  toggleReactionPicker(userId) {
    let picker = document.getElementById('rk-reaction-picker');
    if (picker) {
      picker.remove();
      return;
    }

    picker = document.createElement('div');
    picker.id = 'rk-reaction-picker';
    picker.className = 'reaction-picker';
    
    // Emojis
    const emojis = ['👍', '🎉', '🔥', '❤️', '😮', '😂', '💡', '👏'];
    let emojisHtml = '<div class="reaction-picker-header">Emojis</div><div class="reaction-grid">';
    emojis.forEach(e => {
      emojisHtml += `<div class="reaction-item" data-type="emoji" data-content="${e}">${e}</div>`;
    });
    emojisHtml += '</div>';

    // Stickers
    // Use predefined stickers from Reikanales if available
    let stickers = [
      'https://res.cloudinary.com/dyy6zbkop/image/upload/v1774987836/yx0jtu7jte38qbqwsy68.png',
      'icons/ReikenIcon.png'
    ];

    if (window.RKCanales && window.RKCanales.getStickers) {
      const globalStickers = window.RKCanales.getStickers();
      if (globalStickers && globalStickers.length > 0) {
        stickers = globalStickers;
      }
    }

    let stickersHtml = '<div class="reaction-picker-header" style="margin-top:10px;">Stickers</div><div class="reaction-grid stickers">';
    stickers.forEach(s => {
      stickersHtml += `<div class="reaction-item" data-type="sticker" data-content="${s}"><img src="${s}" class="reaction-sticker"></div>`;
    });
    stickersHtml += '</div>';

    picker.innerHTML = emojisHtml + stickersHtml;

    picker.addEventListener('click', (e) => {
      e.stopPropagation(); // Evitar que cierre inmediatamente
      const item = e.target.closest('.reaction-item');
      if (!item) return;

      const type = item.dataset.type;
      const content = item.dataset.content;

      // Emit over Realtime Channel
      if (this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'reaction',
          payload: { userId, type, content }
        });
      }

      // Show locally immediately
      this.showReaction({ userId, type, content });
      picker.remove();
    });

    document.body.appendChild(picker);
  },

  closeReactionPicker(e) {
    if (e.target.closest('#rk-reaction-picker') || e.target.closest('.presence-avatar.is-local')) return;
    const picker = document.getElementById('rk-reaction-picker');
    if (picker) picker.remove();
  },

  showReaction({ userId, type, content }) {
    const avatar = document.querySelector(`.presence-avatar[data-uid="${userId}"]`);
    if (!avatar) return;

    const wrapper = avatar.parentElement;
    if (!wrapper) return;

    const floatEl = document.createElement('div');
    floatEl.className = 'reaction-float';

    if (type === 'emoji') {
      floatEl.textContent = content;
    } else if (type === 'sticker') {
      const img = document.createElement('img');
      img.src = content;
      floatEl.appendChild(img);
    }
    window.RKSound?.play('clickconcept');

    wrapper.appendChild(floatEl);

    // Remove after animation
    setTimeout(() => {
      floatEl.remove();
    }, 2000);
  },

  pulseAvatar(userId) {
    const avatar = document.querySelector(`.presence-avatar[data-uid="${userId}"]`);
    if(avatar) {
      avatar.classList.add('active-drawing');
      clearTimeout(avatar._pulseTimer);
      avatar._pulseTimer = setTimeout(() => {
        avatar.classList.remove('active-drawing');
      }, 500);
    }
  }
};

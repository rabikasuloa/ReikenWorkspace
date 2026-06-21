/**
 * REIKEN CROP SYSTEM
 * Sistema global de recorte de imágenes.
 */

window.RKCrop = {
  overlay: null, canvas: null, ctx: null,
  confirm: null, cancel: null, zoom: null, title: null,
  image: new Image(),
  type: "profile",
  scale: 1, minScale: 1, maxScale: 5,
  imgX: 0, imgY: 0,
  crop: { x: 0, y: 0, w: 0, h: 0 },
  dragging: false,
  resizing: false,
  activeHandle: null,
  dragStartCrop: null,
  dragStartMouse: null,
  resolve: null,
  
  init() {
    this._inject();
    this.overlay = document.getElementById("cropOverlay");
    this.canvas  = document.getElementById("cropCanvas");
    if (!this.canvas) return;
    this.ctx     = this.canvas.getContext("2d");
    this.confirm = document.getElementById("cropConfirm");
    this.cancel  = document.getElementById("cropCancel");
    this.zoom    = document.getElementById("zoomSlider");
    this.title   = document.getElementById("cropTitle");
    this.setupEvents();
  },

  _inject() {
    if (document.getElementById("cropOverlay")) return;
    const style = document.createElement("style");
    style.textContent = `
      .crop-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
      .crop-box { background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 25px; width: 85vw; max-width: 900px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
      .crop-header { display: flex; justify-content: space-between; align-items: center; }
      .crop-header h2 { font-family: 'Etna'; color: #fff; margin: 0; font-size: 1.2rem; letter-spacing: 1px; }
      .crop-canvas-wrap { background: #000; border-radius: 12px; overflow: hidden; position: relative; cursor: move; }
      .crop-controls { display: flex; align-items: center; gap: 15px; }
      .crop-zoom { flex: 1; accent-color: #db6f4e; }
      .crop-footer { display: flex; justify-content: flex-end; gap: 12px; }
      .btn-crop-cancel { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-family: 'Etna'; transition: all 0.2s; }
      .btn-crop-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }
      .btn-crop-confirm { background: #db6f4e; border: none; color: #fff; padding: 10px 30px; border-radius: 12px; cursor: pointer; font-family: 'Etna'; font-weight: bold; transition: all 0.2s; box-shadow: 0 4px 15px rgba(219,111,78,0.3); }
      .btn-crop-confirm:hover { background: #e87f5e; transform: translateY(-2px); }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "cropOverlay";
    overlay.className = "crop-overlay hidden";
    overlay.innerHTML = `
      <div class="crop-box">
        <div class="crop-header"><h2 id="cropTitle">Editar Imagen</h2></div>
        <div class="crop-canvas-wrap"><canvas id="cropCanvas"></canvas></div>
        <div class="crop-controls">
          <span style="color:rgba(255,255,255,0.5); font-size:12px; font-family:'Etna'">ZOOM</span>
          <input type="range" id="zoomSlider" class="crop-zoom" min="0" max="100" value="0">
        </div>
        <div class="crop-footer">
          <button class="btn-crop-cancel" id="cropCancel">CANCELAR</button>
          <button class="btn-crop-confirm" id="cropConfirm">CONFIRMAR</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  getHandleAt(x, y) {
    const threshold = 15;
    const c = this.crop;
    if (Math.hypot(x - c.x, y - c.y) < threshold) return 'tl';
    if (Math.hypot(x - (c.x + c.w), y - c.y) < threshold) return 'tr';
    if (Math.hypot(x - c.x, y - (c.y + c.h)) < threshold) return 'bl';
    if (Math.hypot(x - (c.x + c.w), y - (c.y + c.h)) < threshold) return 'br';
    return null;
  },

  setupEvents() {
    this.canvas.onmousedown = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const isCircle = (this.type === "profile" || this.type === "avatar");
      if (!isCircle) {
        this.activeHandle = this.getHandleAt(mouseX, mouseY);
        if (this.activeHandle) {
          this.resizing = true;
          this.dragStartCrop = { ...this.crop };
          this.dragStartMouse = { x: mouseX, y: mouseY };
          return;
        }
      }
      this.dragging = true;
    };

    window.addEventListener("mouseup", () => {
      this.dragging = false;
      this.resizing = false;
      this.activeHandle = null;
    });

    this.canvas.onmousemove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const isCircle = (this.type === "profile" || this.type === "avatar");
      
      if (!isCircle && !this.dragging && !this.resizing) {
        const handle = this.getHandleAt(mouseX, mouseY);
        if (handle === 'tl' || handle === 'br') {
          this.canvas.style.cursor = 'nwse-resize';
        } else if (handle === 'tr' || handle === 'bl') {
          this.canvas.style.cursor = 'nesw-resize';
        } else {
          this.canvas.style.cursor = 'move';
        }
      }

      if (this.resizing) {
        const dx = mouseX - this.dragStartMouse.x;
        const dy = mouseY - this.dragStartMouse.y;
        const minSize = 50;

        let newX = this.dragStartCrop.x;
        let newY = this.dragStartCrop.y;
        let newW = this.dragStartCrop.w;
        let newH = this.dragStartCrop.h;

        if (this.activeHandle === 'tl') {
          newX = Math.min(this.dragStartCrop.x + dx, this.dragStartCrop.x + this.dragStartCrop.w - minSize);
          newW = this.dragStartCrop.w - (newX - this.dragStartCrop.x);
          newY = Math.min(this.dragStartCrop.y + dy, this.dragStartCrop.y + this.dragStartCrop.h - minSize);
          newH = this.dragStartCrop.h - (newY - this.dragStartCrop.y);
        } else if (this.activeHandle === 'tr') {
          newW = Math.max(minSize, this.dragStartCrop.w + dx);
          newY = Math.min(this.dragStartCrop.y + dy, this.dragStartCrop.y + this.dragStartCrop.h - minSize);
          newH = this.dragStartCrop.h - (newY - this.dragStartCrop.y);
        } else if (this.activeHandle === 'bl') {
          newX = Math.min(this.dragStartCrop.x + dx, this.dragStartCrop.x + this.dragStartCrop.w - minSize);
          newW = this.dragStartCrop.w - (newX - this.dragStartCrop.x);
          newH = Math.max(minSize, this.dragStartCrop.h + dy);
        } else if (this.activeHandle === 'br') {
          newW = Math.max(minSize, this.dragStartCrop.w + dx);
          newH = Math.max(minSize, this.dragStartCrop.h + dy);
        }

        if (newX < 0) { newW += newX; newX = 0; }
        if (newY < 0) { newH += newY; newY = 0; }
        if (newX + newW > this.canvas.width) { newW = this.canvas.width - newX; }
        if (newY + newH > this.canvas.height) { newH = this.canvas.height - newY; }

        this.crop.x = newX;
        this.crop.y = newY;
        this.crop.w = newW;
        this.crop.h = newH;

        this.clamp();
        this.draw();
        return;
      }

      if (!this.dragging) return;
      
      // Also scale movement delta for panning since mouse position is scaled
      const dx = e.movementX * (this.canvas.width / rect.width);
      const dy = e.movementY * (this.canvas.height / rect.height);
      this.imgX += dx;
      this.imgY += dy;
      this.clamp();
      this.draw();
    };

    this.canvas.onwheel = (e) => {
      e.preventDefault();
      this.scale *= (e.deltaY < 0 ? 1.1 : 0.9);
      this.applyZoom();
    };

    if (this.zoom) {
      this.zoom.oninput = () => {
        const p = this.zoom.value / 100;
        this.scale = this.minScale + p * (this.maxScale - this.minScale);
        this.applyZoom(false);
      };
    }

    if (this.cancel) {
      this.cancel.onclick = () => {
        window.ANIM.hide(this.overlay, 'anim-fade-out');
        if (this.resolve) this.resolve(null);
      };
    }

    if (this.confirm) {
      this.confirm.onclick = () => {
        const tmp = document.createElement("canvas");
        const tctx = tmp.getContext("2d");
        tmp.width = this.crop.w; tmp.height = this.crop.h;
        tctx.drawImage(this.image, 
          (this.crop.x - this.imgX) / this.scale,
          (this.crop.y - this.imgY) / this.scale,
          this.crop.w / this.scale,
          this.crop.h / this.scale,
          0, 0, this.crop.w, this.crop.h
        );
        window.ANIM.hide(this.overlay, 'anim-fade-out');
        if (this.resolve) this.resolve(tmp.toDataURL());
      };
    }
  },

  open(file, type = "profile") {
    if (!this.overlay) this.init();
    return new Promise((res) => {
      this.resolve = res;
      this.type = type;
      if (this.title) {
        this.title.textContent = 
          type === "profile" ? "Foto de perfil" :
          type === "banner" ? "Ajustar Mapa / Banner" : "Ajustar Imagen";
      }
      this.image = new Image();
      this.image.onload = () => {
        this.canvas.width = window.innerWidth * 0.8;
        this.canvas.height = window.innerHeight * 0.7;
        
        let ratio = this.image.width / this.image.height;
        if (type === "profile" || type === "avatar") ratio = 1;

        this.crop.w = this.canvas.width * 0.7;
        this.crop.h = this.crop.w / ratio;

        if (this.crop.h > this.canvas.height * 0.7) {
          this.crop.h = this.canvas.height * 0.7;
          this.crop.w = this.crop.h * ratio;
        }

        this.crop.x = (this.canvas.width - this.crop.w) / 2;
        this.crop.y = (this.canvas.height - this.crop.h) / 2;
        
        const sX = this.crop.w / this.image.width;
        const sY = this.crop.h / this.image.height;
        this.minScale = Math.max(sX, sY);
        this.maxScale = this.minScale * 5;
        this.scale = this.minScale;
        this.imgX = this.crop.x - (this.image.width * this.scale - this.crop.w) / 2;
        this.imgY = this.crop.y - (this.image.height * this.scale - this.crop.h) / 2;
        if (this.zoom) this.zoom.value = 0;
        this.draw();
        window.ANIM.show(this.overlay, 'anim-fade-in');
      };
      this.image.src = URL.createObjectURL(file);
    });
  },

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const isCircle = (this.type === "profile" || this.type === "avatar");
    if (isCircle) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(this.crop.x + this.crop.w/2, this.crop.y + this.crop.h/2, this.crop.w/2, 0, Math.PI*2);
      this.ctx.clip();
    }
    this.ctx.drawImage(this.image, this.imgX, this.imgY, this.image.width * this.scale, this.image.height * this.scale);
    if (isCircle) this.ctx.restore();
    
    this.ctx.fillStyle = "rgba(0,0,0,0.6)";
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    if (isCircle) this.ctx.arc(this.crop.x+this.crop.w/2, this.crop.y+this.crop.h/2, this.crop.w/2, 0, Math.PI*2);
    else this.ctx.rect(this.crop.x, this.crop.y, this.crop.w, this.crop.h);
    this.ctx.fill("evenodd");
    
    this.ctx.strokeStyle = "#fff";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    if (isCircle) this.ctx.arc(this.crop.x+this.crop.w/2, this.crop.y+this.crop.h/2, this.crop.w/2, 0, Math.PI*2);
    else this.ctx.rect(this.crop.x, this.crop.y, this.crop.w, this.crop.h);
    this.ctx.stroke();

    // Dibujar manejadores de cambio de tamaño si no es circular
    if (!isCircle) {
      const c = this.crop;
      this.ctx.fillStyle = "#db6f4e";
      this.ctx.strokeStyle = "#fff";
      this.ctx.lineWidth = 2;
      const hs = 8;
      
      const corners = [
        { x: c.x, y: c.y },
        { x: c.x + c.w, y: c.y },
        { x: c.x, y: c.y + c.h },
        { x: c.x + c.w, y: c.y + c.h }
      ];

      corners.forEach(p => {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, hs, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      });
    }
  },

  clamp() {
    const sX = this.crop.w / this.image.width;
    const sY = this.crop.h / this.image.height;
    this.minScale = Math.max(sX, sY);
    this.maxScale = this.minScale * 5;
    if (this.scale < this.minScale) {
      this.scale = this.minScale;
    }
    
    this.imgX = Math.max(this.crop.x + this.crop.w - this.image.width * this.scale, Math.min(this.imgX, this.crop.x));
    this.imgY = Math.max(this.crop.y + this.crop.h - this.image.height * this.scale, Math.min(this.imgY, this.crop.y));
  },

  applyZoom(updSlider = true) {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
    if (updSlider && this.zoom) {
      this.zoom.value = ((this.scale - this.minScale) / (this.maxScale - this.minScale)) * 100;
    }
    this.clamp();
    this.draw();
  }
};

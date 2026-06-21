// ============================================================
// SCRIPT PAGE — Bloc de Notas con Soporte de Píldoras (Pills)
// ============================================================
(function () {
  if (!document.getElementById("scriptEditor")) return;

  const sb = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get("sceneId");
  if (!sceneId) { window.location.href = "storyboard.html"; return; }

  // ── DOM ────────────────────────────────────────────────────
  const backBtn = document.getElementById("backBtn");
  const sceneTitle = document.getElementById("sceneTitle");
  const saveScriptBtn = document.getElementById("saveScriptBtn");
  const scriptEditor = document.getElementById("scriptEditor");
  const btnAutoPaneles = document.getElementById("btnAutoPaneles");
  const btnTutorialScript = document.getElementById("btnTutorialScript");
  const tutorialScriptBox = document.getElementById("tutorialScriptBox");

  // Zen, Format & Fountain DOM
  const btnZenMode = document.getElementById("btnZenMode");
  const scriptFormatSelect = document.getElementById("scriptFormatSelect");
  const btnImportFountain = document.getElementById("btnImportFountain");
  const btnExportFountain = document.getElementById("btnExportFountain");
  const fountainFileInput = document.getElementById("fountainFileInput");
  const scriptHeaderTrigger = document.getElementById("scriptHeaderTrigger");

  // Slash Menu DOM
  const slashMenu = document.getElementById("slashMenu");
  const slashMenuList = document.getElementById("slashMenuList");

  let currentScene = null;
  let characters = [];

  // Slash Menu State
  let filteredChars = [];
  let menuSelectedIdx = 0;
  let isMenuOpen = false;
  let slashNode = null;
  let slashOffset = -1;

  // ============================================================
  // EVENTOS DEL EDITOR (Pills y Slash Menu)
  // ============================================================

  scriptEditor.addEventListener("keydown", (e) => {
    if (isMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveMenu(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveMenu(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmMenu();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      } else if (!e.key.match(/^[\w\u00C0-\u024F]$/) && e.key !== "Backspace") {
        // Cualquier otra tecla (espacio, etc) cierra el menú
        closeMenu();
      }
      return;
    }

    // ── NAVEGACIÓN Y EDICIÓN BUG-FREE ──
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    // A. Interceptar ENTER para evitar clonar clases indeseadas y anidamientos
    if (e.key === "Enter") {
      e.preventDefault();
      const range = sel.getRangeAt(0);
      let node = sel.anchorNode;

      // Buscar el div hijo directo del editor
      let currentDiv = null;
      while (node && node !== scriptEditor) {
        if (node.parentNode === scriptEditor && node.tagName === 'DIV') {
          currentDiv = node;
          break;
        }
        node = node.parentNode;
      }

      if (!currentDiv || scriptEditor.children.length === 0) {
        // Editor vacío o fuera de div raíz: creamos un bloque limpio
        const cleanDiv = document.createElement("div");
        cleanDiv.appendChild(document.createElement("br"));
        scriptEditor.appendChild(cleanDiv);

        const newRange = document.createRange();
        newRange.setStart(cleanDiv, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        formatScriptLines();
        return;
      }

      // Dividir el div actual en la posición del cursor
      const splitRange = range.cloneRange();
      splitRange.selectNodeContents(currentDiv);
      splitRange.setStart(range.startContainer, range.startOffset);
      const textAfter = splitRange.extractContents();

      // Crear div siguiente limpio de clases heredadas
      const newDiv = document.createElement("div");
      if (textAfter.textContent.trim() === "" && textAfter.children.length === 0) {
        newDiv.appendChild(document.createElement("br"));
      } else {
        newDiv.appendChild(textAfter);
      }

      currentDiv.parentNode.insertBefore(newDiv, currentDiv.nextSibling);

      // Si el div original quedó vacío, le ponemos un <br>
      if (currentDiv.innerHTML === "") {
        currentDiv.appendChild(document.createElement("br"));
      }

      // Mover caret al inicio del nuevo bloque
      const newRange = document.createRange();
      newRange.setStart(newDiv, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      formatScriptLines();
      if (typeof updateActiveLineHighlight === "function") {
        updateActiveLineHighlight();
      }
      return;
    }

    // B. Interceptar TAB para evitar que el foco salte a los botones de la UI
    if (e.key === "Tab") {
      e.preventDefault();
      const range = sel.getRangeAt(0);
      const tabNode = document.createTextNode("\u00a0\u00a0\u00a0\u00a0");
      range.insertNode(tabNode);
      range.setStartAfter(tabNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      formatScriptLines();
      return;
    }

    // C. Interceptar BACKSPACE al inicio del div para fusionar filas de forma limpia
    if (e.key === "Backspace") {
      const range = sel.getRangeAt(0);
      if (range.startOffset === 0 && range.collapsed) {
        let node = sel.anchorNode;
        let currentDiv = null;
        while (node && node !== scriptEditor) {
          if (node.parentNode === scriptEditor && node.tagName === 'DIV') {
            currentDiv = node;
            break;
          }
          node = node.parentNode;
        }

        if (currentDiv) {
          const prevDiv = currentDiv.previousSibling;
          if (prevDiv && prevDiv.tagName === 'DIV') {
            e.preventDefault();
            
            const lengthBefore = prevDiv.childNodes.length;
            
            // Si el bloque previo solo tiene un marcador vacío, lo limpiamos
            if (prevDiv.innerHTML === "<br>" || prevDiv.innerHTML === "") {
              prevDiv.innerHTML = "";
            }

            // Fusionar nodos hijos excepto br innecesarios
            if (currentDiv.innerHTML !== "<br>" && currentDiv.innerHTML !== "") {
              while (currentDiv.firstChild) {
                prevDiv.appendChild(currentDiv.firstChild);
              }
            }

            currentDiv.parentNode.removeChild(currentDiv);

            // Posicionar cursor en la unión
            const newRange = document.createRange();
            if (prevDiv.childNodes.length > 0) {
              const targetNode = prevDiv.childNodes[Math.min(lengthBefore, prevDiv.childNodes.length - 1)];
              if (targetNode.nodeType === Node.TEXT_NODE) {
                newRange.setStart(targetNode, targetNode.textContent.length);
              } else {
                newRange.setStartAfter(targetNode);
              }
            } else {
              newRange.setStart(prevDiv, 0);
            }
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            formatScriptLines();
            if (typeof updateActiveLineHighlight === "function") {
              updateActiveLineHighlight();
            }
          }
        }
      }
    }
  });

  // D. Interceptar PEGAR para limpiar HTML basura y mantener bloques planos
  scriptEditor.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const range = sel.getRangeAt(0);
    range.deleteContents();
    
    const lines = text.split(/\r?\n/);
    
    if (lines.length === 1) {
      const textNode = document.createTextNode(lines[0]);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      let node = sel.anchorNode;
      let currentDiv = null;
      while (node && node !== scriptEditor) {
        if (node.parentNode === scriptEditor && node.tagName === 'DIV') {
          currentDiv = node;
          break;
        }
        node = node.parentNode;
      }
      
      if (!currentDiv) {
        const html = lines.map(line => `<div>${line || "<br>"}</div>`).join("");
        document.execCommand("insertHTML", false, html);
      } else {
        const textNode = document.createTextNode(lines[0]);
        range.insertNode(textNode);
        
        const splitRange = range.cloneRange();
        splitRange.selectNodeContents(currentDiv);
        splitRange.setStartAfter(textNode);
        const textAfter = splitRange.extractContents();
        
        let lastDiv = currentDiv;
        for (let j = 1; j < lines.length; j++) {
          const newDiv = document.createElement("div");
          newDiv.textContent = lines[j];
          
          if (j === lines.length - 1 && textAfter.childNodes.length > 0) {
            newDiv.appendChild(textAfter);
          }
          
          if (!newDiv.innerHTML) newDiv.appendChild(document.createElement("br"));
          
          currentDiv.parentNode.insertBefore(newDiv, lastDiv.nextSibling);
          lastDiv = newDiv;
        }
        
        const newRange = document.createRange();
        const textLen = lines[lines.length - 1].length;
        if (lastDiv.firstChild && lastDiv.firstChild.nodeType === Node.TEXT_NODE) {
          newRange.setStart(lastDiv.firstChild, textLen);
        } else {
          newRange.setStart(lastDiv, 0);
        }
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
    
    formatScriptLines();
    if (typeof updateActiveLineHighlight === "function") {
      updateActiveLineHighlight();
    }
  });

  scriptEditor.addEventListener("input", () => {
    // Si el editor queda vacío (por ejemplo al borrar todo), aseguramos estructura de div limpia
    if (scriptEditor.children.length === 0 || scriptEditor.innerHTML.trim() === "") {
      scriptEditor.innerHTML = "<div><br></div>";
      const newRange = document.createRange();
      newRange.setStart(scriptEditor.firstChild, 0);
      newRange.collapse(true);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(newRange);
      formatScriptLines();
      return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const node = sel.anchorNode;
    // Solo operamos en nodos de texto, para no romper HTML
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      if (isMenuOpen) closeMenu();
      return;
    }

    const textBeforeCaret = node.textContent.slice(0, sel.anchorOffset);
    const slashIdx = textBeforeCaret.lastIndexOf("/");

    if (slashIdx === -1) {
      if (isMenuOpen) closeMenu();
      return;
    }

    const query = textBeforeCaret.slice(slashIdx + 1);
    if (/\s/.test(query)) {
      if (isMenuOpen) closeMenu();
      return; // Si hay espacios después del /, cancelamos
    }

    // Filtrar personajes
    filteredChars = characters.filter(c => c.name.toLowerCase().startsWith(query.toLowerCase()));

    if (filteredChars.length === 0) {
      if (isMenuOpen) closeMenu();
      return;
    }

    slashNode = node;
    slashOffset = slashIdx;
    menuSelectedIdx = 0;
    openMenu(sel.getRangeAt(0));
  });

  // ============================================================
  // LOGICA DEL MENÚ FLOTANTE
  // ============================================================

  function openMenu(caretRange) {
    isMenuOpen = true;
    window.ANIM.show(slashMenu, 'anim-slide-up');
    renderMenuItems();

    // Posicionar usando getBoundingClientRect del rango
    const rect = caretRange.getBoundingClientRect();
    slashMenu.style.position = "fixed";
    slashMenu.style.left = Math.max(4, rect.left) + "px";
    slashMenu.style.top = (rect.bottom + 6) + "px";
  }

  function closeMenu() {
    isMenuOpen = false;
    slashNode = null;
    slashOffset = -1;
    filteredChars = [];
    window.ANIM.hide(slashMenu, 'anim-slide-down-out');
  }

  function moveMenu(dir) {
    menuSelectedIdx = (menuSelectedIdx + dir + filteredChars.length) % filteredChars.length;
    renderMenuItems();
  }

  function renderMenuItems() {
    slashMenuList.innerHTML = "";
    filteredChars.forEach((char, idx) => {
      const item = document.createElement("div");
      item.className = "slash-menu-item" + (idx === menuSelectedIdx ? " selected" : "");

      const dot = document.createElement("div");
      dot.className = "slash-menu-color";
      dot.style.backgroundColor = char.color || "#fff";

      const label = document.createElement("span");
      label.className = "slash-menu-name";
      label.textContent = char.name;

      item.appendChild(dot);
      item.appendChild(label);

      item.addEventListener("mousedown", e => {
        e.preventDefault(); // Evitar perder el foco
        insertDialoguePill(char);
      });
      item.addEventListener("mouseenter", () => {
        menuSelectedIdx = idx;
        renderMenuItems();
      });

      slashMenuList.appendChild(item);
    });

    slashMenuList.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  }

  function confirmMenu() {
    if (filteredChars[menuSelectedIdx]) insertDialoguePill(filteredChars[menuSelectedIdx]);
  }

  // Cerrar si se hace clic fuera
  document.addEventListener("mousedown", e => {
    if (isMenuOpen && !slashMenu.contains(e.target)) closeMenu();
  });

  // ============================================================
  // INSERCIÓN DE PÍLDORAS (PILLS) INMUTABLES
  // ============================================================

  function insertDialoguePill(char) {
    if (!slashNode) { closeMenu(); return; }

    const sel = window.getSelection();

    // 1. Reemplazar el texto que inicia con / por nada
    const fullText = slashNode.textContent;
    const textBeforeSlash = fullText.slice(0, slashOffset);
    const textAfterCursor = fullText.slice(sel.anchorOffset);

    slashNode.textContent = textBeforeSlash;

    // 2. Crear la píldora HTML (contenteditable=false)
    const pill = document.createElement("span");
    pill.contentEditable = "false";
    pill.style.color = char.color || "#db6f4e";
    pill.style.fontWeight = "bold";
    // El formato '> Nombre:' ayuda a que nuestro parser de innerText lo capture igual
    pill.textContent = `> ${char.name}: `;

    // 3. Crear nodo de texto siguiente con un espacio (o el texto que sobraba)
    const spaceNode = document.createTextNode(" " + textAfterCursor);

    // 4. Insertar en el DOM justo después del nodo de texto modificado
    if (slashNode.nextSibling) {
      slashNode.parentNode.insertBefore(pill, slashNode.nextSibling);
      slashNode.parentNode.insertBefore(spaceNode, pill.nextSibling);
    } else {
      slashNode.parentNode.appendChild(pill);
      slashNode.parentNode.appendChild(spaceNode);
    }

    // 5. Mover el cursor después del espacio inicial del textNode
    const r = document.createRange();
    r.setStart(spaceNode, 1);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);

    closeMenu();
  }

  // ============================================================
  // GUARDAR
  // ============================================================
  saveScriptBtn.addEventListener("click", async () => {
    saveScriptBtn.disabled = true;
    saveScriptBtn.textContent = "Guardando...";

    try {
      // Guardamos el HTML interno para preservar los spans inmutables
      const content = scriptEditor.innerHTML;
      const { error } = await sb.from("escenas").update({ contenido_script: content }).eq("id", sceneId);
      if (error) throw new Error(error.message);
      window.showToast ? window.showToast("✔ Script guardado") : (saveScriptBtn.textContent = "Guardado ✔");
    } catch (err) {
      console.error(err);
      window.showToast ? window.showToast("✖ " + err.message, "error") : alert("Error: " + err.message);
    } finally {
      setTimeout(() => {
        saveScriptBtn.disabled = false;
        saveScriptBtn.textContent = "Guardar";
      }, 1500);
    }
  });

  // ============================================================
  // TUTORIAL INTERACTIVO (BALATRO STYLE)
  // ============================================================
  const tutorialLinesScript = [
    // 0: Intro
    { text: "Hmpf... Pareces algo perdido. Soy Luna. Te voy a ayudar pero que no se haga hábito.", mood: "neutral" },
    // 1: Main choice menu
    { text: "¿Qué quieres que te explique del editor de guion?", mood: "neutral",
      choices: [
        { label: "Formato de paneles", goTo: 2, color: "#7ecbff" },
        { label: "Diálogos", goTo: 5, color: "#7ecbff" },
        { label: "Guardar y generar", goTo: 8, color: "#a2ff7e" },
        { label: "Explícamelo todo", goTo: 2, isFullMode: true, color: "#db6f4e" },
        { label: "Nada, ya sé lo que hago", goTo: "close", color: "#ff6b6b" }
      ]
    },
    // ── Sección: Formato de paneles (2-4) ──
    // 2:
    { text: "Usa ~[Corchetes]~ para separar tus textos en Paneles. Si no lo haces, lo que escribas se tomará como parte de un solo panel.", mood: "neutral" },
    // 3:
    { text: "Un ejemplo por si no te ha entrado en el coco: ~[Panel 1]~, ~[Panel 2]~ etc. y bajo de ellos el contenido de cada uno.", mood: "neutral" },
    // 4: End of section — ask to continue or return to menu
    { text: "¿Quieres saber algo más del editor?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Diálogos", goTo: 5, color: "#7ecbff" },
        { label: "Guardar y generar", goTo: 8, color: "#a2ff7e" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "No, ya es suficiente", goTo: 11, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Diálogos (5-7) ──
    // 5:
    { text: "Si necesitas diálogos, escribe ^'/'^ para desplegar a los personajes de la escena. No debería costarte tanto.", mood: "neutral" },
    // 6:
    { text: "Y usa asteriscos como ~*acción*~ para que quede claro qué está sucediendo.", mood: "neutral" },
    // 7: End of section
    { text: "¿Algo más que quieras aprender?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Formato de paneles", goTo: 2, color: "#7ecbff" },
        { label: "Guardar y generar", goTo: 8, color: "#a2ff7e" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "No, ya es suficiente", goTo: 11, color: "#ff6b6b" }
      ]
    },
    // ── Sección: Guardar y generar (8-10) ──
    // 8:
    { text: "Cuando termines, pulsa ~'Generar Paneles'~. Esto sincronizará tu guion con los lienzos de los dibujantes.", mood: "neutral" },
    // 9:
    { text: "Ah, y dale al botón ~'Guardar'~ seguido. No quiero lloros si pierdes el avance por no darle a guardar.", mood: "neutral" },
    // 10: End of section
    { text: "¿Te explico algo más?", mood: "neutral", skipInFullMode: true,
      choices: [
        { label: "Formato de paneles", goTo: 2, color: "#7ecbff" },
        { label: "Diálogos", goTo: 5, color: "#7ecbff" },
        { label: "Volver al menú", goTo: 1, color: "#db6f4e" },
        { label: "No, ya es suficiente", goTo: 11, color: "#ff6b6b" }
      ]
    },
    // 11: Closing
    { text: "En fin, eso es todo. Vamos, inténtalo... Digo, ^no es que me importe^ si te sale bien o no, supongo.", mood: "ashamed_blush" }
  ];

  btnTutorialScript?.addEventListener("click", () => {
    if (window.RKTutorial) {
      window.RKTutorial.toggle(tutorialLinesScript);
    }
  });

  // ============================================================
  // AUTO-PANELES
  // ============================================================

  btnAutoPaneles?.addEventListener("click", async () => {
    // MAGIA: El innerText convertirá automáticamente nuestros spans "inmutables"
    // en texto plano puro con formato '> Nombre: '
    const rawText = scriptEditor.innerText.trim();
    if (!rawText) return window.showToast("El guion está vacío", "error");

    btnAutoPaneles.disabled = true;
    btnAutoPaneles.textContent = "Generando...";

    try {
      let panelsToCreate = [];

      const parsePanelText = (textBlock) => {
        let tags = [];
        let finalDesc = [];
        let dialogos = [];

        const lines = textBlock.split('\n');

        lines.forEach(line => {
          let text = line.trim();
          if (!text) return;

          if (/^\[.*?\]/.test(text)) return;

          // Parse manual dialogue: > Nombre: Texto
          const manualDialogMatch = text.match(/^>\s*([^:]+):\s*(.*)$/);
          if (manualDialogMatch) {
            const cName = manualDialogMatch[1].trim();
            const foundChar = characters.find(c => c.name.toLowerCase() === cName.toLowerCase());
            dialogos.push({
              personaje: { name: cName, color: foundChar ? foundChar.color : "#db6f4e" },
              texto: manualDialogMatch[2].trim()
            });
            return;
          }

          // Parse #tags
          const hashtagRegex = /#\w+/g;
          let hashtagMatch;
          while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
            tags.push(hashtagMatch[0]);
          }
          if (tags.length > 0) {
            tags.forEach(t => { text = text.replace(t, ""); });
          }

          if (text.trim()) finalDesc.push(text.trim());
        });

        let stringDesc = finalDesc.join("\n");
        if (tags.length > 0) {
          stringDesc = tags.join(" ") + "\n" + stringDesc;
        }

        return { desc: stringDesc.trim(), dialogos: dialogos };
      };

      const hasHeadings = /^\[.*?\]/m.test(rawText);

      if (hasHeadings) {
        const parts = rawText.split(/(?=\[.*?\])/g).filter(p => p.trim());
        panelsToCreate = parts.map(p => p.trim());
      } else {
        panelsToCreate = rawText.split(/\n\s*\n/).filter(p => p.trim());
      }

      if (panelsToCreate.length === 0) throw new Error("No hay contenido válido para generar paneles.");

      // 1. Obtener paneles existentes para actualizarlos sin borrar trazos visuales
      const { data: existingPanels, error: fetchErr } = await sb.from("paneles").select("*").eq("escena_id", sceneId).order("orden", { ascending: true });
      if (fetchErr) throw fetchErr;

      let lastOrden = 0;
      if (existingPanels && existingPanels.length > 0) {
        lastOrden = Math.max(...existingPanels.map(p => p.orden || 0));
      }

      let updatedCount = 0;
      let insertedCount = 0;

      // 2. Iterar sobre los bloques generados por el guion
      for (let i = 0; i < panelsToCreate.length; i++) {
        const textBlock = panelsToCreate[i];
        const parsed = parsePanelText(textBlock);

        if (existingPanels && i < existingPanels.length) {
          // Ya existe un panel en esta posición: Actualizamos su texto (respetando los trazos y fondo)
          const panel = existingPanels[i];
          const oldCanvasData = panel.canvas_data || {};

          const newCanvasData = {
            ...oldCanvasData, // preservamos visuales
            instrucciones: parsed.desc,
            dialogos: parsed.dialogos
          };

          const { error: updErr } = await sb.from("paneles").update({ canvas_data: newCanvasData }).eq("id", panel.id);
          if (updErr) throw updErr;
          updatedCount++;
        } else {
          // No existe panel para este bloque de guion: Insertamos uno nuevo
          lastOrden++;
          const insertData = {
            escena_id: sceneId,
            orden: lastOrden, // Corregido: Ya no usamos Date.now() que sobrepasaba el integer
            canvas_data: {
              imagen_url: null,
              zoom: 1,
              panX: 0,
              panY: 0,
              duracion: currentScene?.panel_duracion_default || 1.0,
              instrucciones: parsed.desc,
              dialogos: parsed.dialogos
            },
            voiceover_url: null
          };
          const { error: insErr } = await sb.from("paneles").insert([insertData]);
          if (insErr) throw insErr;
          insertedCount++;
        }
      }

      const msg = `✔ ${updatedCount} actualizados, ${insertedCount} nuevos paneles`;
      window.showToast ? window.showToast(msg) : alert(msg);
      tutorialScriptBox?.classList.add("hidden");
    } catch (e) {
      window.showToast ? window.showToast(e.message, "error") : alert(e.message);
    } finally {
      btnAutoPaneles.disabled = false;
      btnAutoPaneles.textContent = "Generar Paneles";
    }
  });

  // Back
  backBtn.addEventListener("click", () => window.history.back());

  // ============================================================
  // ZEN MODE, DYNAMIC FORMATTING & FOUNTAIN INTEGRATION
  // ============================================================

  // 1. ZEN MODE & TYPEWRITER FOCUS
  function updateActiveLineHighlight() {
    if (!document.body.classList.contains("zen-active")) return;
    
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    let node = sel.anchorNode;
    while (node && node !== scriptEditor) {
      if (node.parentNode === scriptEditor && node.tagName === 'DIV') {
        // Quitar la clase de todos los hermanos
        Array.from(scriptEditor.children).forEach(child => {
          if (child !== node) child.classList.remove('focused-line');
        });
        node.classList.add('focused-line');
        return;
      }
      node = node.parentNode;
    }
  }

  // Trigger hover menu toggle when mouse hits the top of screen
  scriptHeaderTrigger?.addEventListener("mouseenter", () => {
    if (document.body.classList.contains("zen-active")) {
      scriptHeader?.classList.add("script-header-trigger-active");
    }
  });

  scriptHeader?.addEventListener("mouseleave", () => {
    if (document.body.classList.contains("zen-active")) {
      scriptHeader?.classList.remove("script-header-trigger-active");
    }
  });

  // Eventos para resaltar la línea activa
  scriptEditor.addEventListener("keyup", updateActiveLineHighlight);
  scriptEditor.addEventListener("click", updateActiveLineHighlight);
  scriptEditor.addEventListener("focus", updateActiveLineHighlight);

  // Inicializar estado guardado de Zen Mode
  if (localStorage.getItem("rk_zen_mode") === "true") {
    document.body.classList.add("zen-active");
    if (btnZenMode) btnZenMode.textContent = "Salir Zen";
  }

  btnZenMode?.addEventListener("click", () => {
    const isZen = document.body.classList.toggle("zen-active");
    localStorage.setItem("rk_zen_mode", isZen ? "true" : "false");
    if (btnZenMode) btnZenMode.textContent = isZen ? "Salir Zen" : "Modo Zen";
    if (isZen) {
      updateActiveLineHighlight();
    } else {
      // Limpiar clase enfocada al salir
      Array.from(scriptEditor.children).forEach(child => child.classList.remove('focused-line'));
      scriptHeader?.classList.remove("script-header-trigger-active");
    }
  });

  // Atajo Ctrl+Alt+Z para alternar Zen Mode
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      btnZenMode?.click();
    }
  });

  // 2. DYNAMIC SCRIPT FORMATTING
  function formatScriptLines() {
    const children = scriptEditor.children;
    for (let child of children) {
      if (child.tagName !== 'DIV') continue;
      const text = child.innerText.trim();
      
      child.classList.remove('heading', 'dialogue', 'parenthetical', 'action');
      
      if (/^\[.*\]$/.test(text)) {
        child.classList.add('heading');
      } else if (child.querySelector('span[contenteditable="false"]')) {
        child.classList.add('dialogue');
      } else if (/^\(.*\)$/.test(text)) {
        child.classList.add('parenthetical');
      } else {
        child.classList.add('action');
      }
    }
  }

  scriptEditor.addEventListener("input", formatScriptLines);

  // Inicializar plantilla guardada
  const savedFormat = localStorage.getItem("rk_script_format") || "cine";
  if (scriptFormatSelect) {
    scriptFormatSelect.value = savedFormat;
  }
  document.body.classList.remove("format-cine", "format-teatro", "format-comic");
  document.body.classList.add(`format-${savedFormat}`);

  scriptFormatSelect?.addEventListener("change", (e) => {
    const format = e.target.value;
    document.body.classList.remove("format-cine", "format-teatro", "format-comic");
    document.body.classList.add(`format-${format}`);
    localStorage.setItem("rk_script_format", format);
    formatScriptLines(); // Recalcular clases visuales al cambiar formato
  });

  // 3. FOUNTAIN IMPORT / EXPORT
  btnExportFountain?.addEventListener("click", () => {
    let fountainLines = [];
    const children = scriptEditor.children;
    
    for (let child of children) {
      if (child.tagName !== 'DIV') continue;
      
      const text = child.innerText.trim();
      if (!text) continue;
      
      if (child.classList.contains('heading')) {
        const cleanHeading = text.replace(/^\[|\]$/g, '').trim();
        fountainLines.push(`# ${cleanHeading}`);
      } else if (child.classList.contains('dialogue')) {
        const charSpan = child.querySelector('span[contenteditable="false"]');
        if (charSpan) {
          const charName = charSpan.textContent.replace(/^>\s*|:\s*$/g, '').trim().toUpperCase();
          const dialogueText = child.textContent.replace(charSpan.textContent, '').trim();
          
          fountainLines.push(charName);
          fountainLines.push(dialogueText);
        } else {
          fountainLines.push(text);
        }
      } else if (child.classList.contains('parenthetical')) {
        fountainLines.push(text);
      } else {
        fountainLines.push(text);
      }
    }
    
    const fountainText = fountainLines.join("\n\n");
    const blob = new Blob([fountainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sceneTitle.textContent.replace("Script: ", "").trim() || "guion"}.fountain`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    window.showToast ? window.showToast("✔ Exportado como .fountain") : alert("Exportado como .fountain");
  });

  btnImportFountain?.addEventListener("click", () => {
    fountainFileInput?.click();
  });
  
  fountainFileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      parseFountainText(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset
  });

  function parseFountainText(fountainRaw) {
    const lines = fountainRaw.split(/\r?\n/);
    let htmlBlocks = [];
    
    let i = 0;
    while (i < lines.length) {
      let line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }
      
      // Encabezados de sección (#)
      if (line.startsWith('#')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
        htmlBlocks.push(`<div>[${headingText}]</div>`);
        i++;
        continue;
      }
      
      // Encabezados de escena (INT., EXT., .)
      if (line.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/i) || line.startsWith('.')) {
        const sceneText = line.startsWith('.') ? line.slice(1).trim() : line;
        htmlBlocks.push(`<div>[${sceneText.toUpperCase()}]</div>`);
        i++;
        continue;
      }
      
      // Bloques de personaje y diálogo
      if (line === line.toUpperCase() && !line.match(/^[0-9\W_]+$/) && line.length > 0 && i + 1 < lines.length) {
        const charName = line;
        let dialogueLine = lines[i + 1].trim();
        
        const foundChar = characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
        const charColor = foundChar ? foundChar.color : "#db6f4e";
        
        let blockHtml = `<div><span contenteditable="false" style="color: ${charColor}; font-weight: bold;">> ${charName}: </span>`;
        
        let advance = 2;
        // Acotación/Parenthetical inline
        if (dialogueLine.startsWith('(') && dialogueLine.endsWith(')')) {
          blockHtml += `<div class="parenthetical" style="display:inline; font-style:italic; opacity:0.7;">${dialogueLine} </div>`;
          if (i + 2 < lines.length) {
            dialogueLine = lines[i + 2].trim();
            advance = 3;
          } else {
            dialogueLine = "";
          }
        }
        
        blockHtml += `${dialogueLine}</div>`;
        htmlBlocks.push(blockHtml);
        i += advance;
        continue;
      }
      
      // Acotación individual
      if (line.startsWith('(') && line.endsWith(')')) {
        htmlBlocks.push(`<div class="parenthetical">${line}</div>`);
        i++;
        continue;
      }
      
      // Acción
      htmlBlocks.push(`<div>${line}</div>`);
      i++;
    }
    
    scriptEditor.innerHTML = htmlBlocks.join("");
    formatScriptLines();
    window.showToast ? window.showToast("✔ Fountain importado con éxito") : alert("Fountain importado");
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    const { data, error } = await sb.from("escenas").select("*").eq("id", sceneId).single();
    if (error || !data) {
      alert("Escena no encontrada.");
      window.location.href = "storyboard.html";
      return;
    }

    currentScene = data;
    sceneTitle.textContent = "Script: " + (data.titulo || "Sin Título");
    characters = Array.isArray(data.personajes) ? data.personajes : [];

    if (data.contenido_script) {
      try {
        const parsed = JSON.parse(data.contenido_script);
        if (Array.isArray(parsed)) {
          let htmlText = "";
          parsed.forEach(b => {
            if (b.type === "h1") htmlText += `<div>[${b.text}]</div><br>`;
            else if (b.type === "dialogue") {
              const charColor = b.charColor || "#db6f4e";
              htmlText += `<div><span contenteditable="false" style="color: ${charColor}; font-weight: bold;">> ${b.charName}: </span> ${b.text}</div>`;
            }
            else htmlText += `<div>${b.text}</div>`;
          });
          scriptEditor.innerHTML = htmlText;
        } else {
          scriptEditor.innerHTML = data.contenido_script;
        }
      } catch {
        // Asumimos que ya es HTML puro guardado con la nueva versión
        scriptEditor.innerHTML = data.contenido_script;
      }
    }
    
    formatScriptLines();
  }

  init();

})();

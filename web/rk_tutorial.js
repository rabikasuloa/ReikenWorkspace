/**
 * RKTutorial - Global interactive tutorial engine (Balatro/Undertale style)
 * Handles HTML injection, CSS animations, typewriter dialogue logic,
 * and a spotlight/vignette system for focusing on UI elements.
 *
 * Line properties:
 *   text      - Dialogue text. Supports ~shake~ and ^wave^ effects.
 *   mood      - Sprite mood (maps to sprites/<mood>_idle_2.png / _talking_2.png)
 *   spotlight - CSS selector(s) or DOM element(s) to spotlight.
 *   spotlightPadding - Extra px around spotlight (default 12).
 *   onShow    - Callback fired when this line starts.
 *   onHide    - Callback fired when leaving this line.
 *   choices   - Array of { label, goTo } for branching menus.
 *              goTo can be a line index (number) or "close".
 *   next      - Override the next line index after this one (number).
 */

const VOWELS = {
  'a': { f1: 800, f2: 1200, f3: 2500, dur: 0.095, q1: 6, q2: 6, q3: 7 },
  'e': { f1: 500, f2: 1800, f3: 2700, dur: 0.085, q1: 6, q2: 7, q3: 8 },
  'i': { f1: 300, f2: 2200, f3: 3000, dur: 0.075, q1: 5, q2: 8, q3: 9 },
  'o': { f1: 500, f2: 900, f3: 2400, dur: 0.090, q1: 6, q2: 6, q3: 7 },
  'u': { f1: 350, f2: 800, f3: 2300, dur: 0.085, q1: 5, q2: 5, q3: 6 },
};

const CONSONANTS = {
  'b': { voiced: true, type: 'plosive', f1: 200, f2: 1000, f3: 2200, dur: 0.04 },
  'd': { voiced: true, type: 'plosive', f1: 220, f2: 1600, f3: 2400, dur: 0.04 },
  'g': { voiced: true, type: 'plosive', f1: 250, f2: 1500, f3: 2500, dur: 0.05 },
  'p': { voiced: false, type: 'plosive', f1: 300, f2: 1200, f3: 2500, dur: 0.04 },
  't': { voiced: false, type: 'plosive', f1: 280, f2: 1500, f3: 2600, dur: 0.04 },
  'k': { voiced: false, type: 'plosive', f1: 350, f2: 1600, f3: 2700, dur: 0.05 },
  'f': { voiced: false, type: 'fricative', f1: 300, f2: 1400, f3: 2500, dur: 0.06 },
  's': { voiced: false, type: 'fricative', f1: 350, f2: 2000, f3: 3000, dur: 0.07 },
  'j': { voiced: false, type: 'fricative', f1: 400, f2: 1800, f3: 2800, dur: 0.08 },
  'm': { voiced: true, type: 'nasal', f1: 250, f2: 900, f3: 2200, dur: 0.08 },
  'n': { voiced: true, type: 'nasal', f1: 250, f2: 1300, f3: 2400, dur: 0.08 },
  'ñ': { voiced: true, type: 'nasal', f1: 280, f2: 1900, f3: 2600, dur: 0.09 },
  'l': { voiced: true, type: 'glide', f1: 300, f2: 1200, f3: 2500, dur: 0.05 },
  'r': { voiced: true, type: 'liquid', f1: 350, f2: 1300, f3: 2400, dur: 0.04 },
  'y': { voiced: true, type: 'glide', f1: 280, f2: 2100, f3: 3000, dur: 0.05 },
  'ch': { voiced: false, type: 'fricative', f1: 400, f2: 2000, f3: 3500, dur: 0.06 },
  'rr': { voiced: true, type: 'liquid', f1: 350, f2: 1350, f3: 2500, dur: 0.10 },
};

const ACCENT_MAP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
const SILENT = new Set([' ', '.', '!', '?', '¡', '¿', ',', ';', ':', '"', "'", '(', ')', '[', ']', '-', '—', '…', '\n', '\r', '\t']);

class RKTutorialManager {
  constructor() {
    this.tutorialLines = [];
    this.currentLineIndex = 0;
    this.isTyping = false;
    this.typeInterval = null;
    this.currentString = "";
    this.spotlightEl = null;
    this.parsedSegments = [];
    this.flatChars = [];
    this.isFullMode = false;
    this.isChatMode = false;
    this.isCEO = false;
    this.chatContext = this.loadChatContext(); // Cargar memoria persistente por proyecto
    this.isFetchingVoice = false;

    // ── Voz Tomodachi Life (Formant Synthesizer Engine v4) ──
    this.voiceConfig = {
      enabled: true,
      speed: 12,        // 4 to 22
      pitch: 240,       // 80 to 400
      formant: 120,     // 80 to 160
      breath: 35,       // 0 to 100
      depth: 20,        // 0 to 100
      inton: 55,        // 0 to 100
      vol: 100,         // 0 to 200
      intonStyle: "expressive", // expressive, flat, melodious, shy, serious
      retro: true,      // true/false
      updatedAt: 0
    };
    this.loadVoiceConfig();
    this.checkCEORole().then(() => {
      this.syncVoiceConfigWithDB();
    });
    this.lastFormants = { f1: 300, f2: 1200, f3: 2500 };
    this.formantPlaying = false;
    this.formantTimeout = null;
    this.audioCtx = null;
    this.voicePanelOpen = false;
    this.currentAudio = null;
    this.audioDuration = 0;
    this.charIndex = 0;
    this.currentLineObj = null;
    this.currentMood = "neutral";
    this.typewriterSpeed = 45;

    this.tutorialSound = new Audio("sounds/tutorial sound.wav");

    this.bgMusicTracks = [
      "sounds/sans..mp3",
      "sounds/Hip Shop.mp3",
      "sounds/Snowdin Town.mp3",
      "sounds/Hotel.mp3"
    ];
    this.bgMusic = new Audio();
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0;
    this.bgMusicFadeInterval = null;

    // Ensure DOM is ready before injecting
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initDOM());
    } else {
      this.initDOM();
    }

    // Global listener for the Luna sidebar button
    document.addEventListener("click", (e) => {
      if (e.target.closest("#btnLunaChat")) {
        this.openLunaChat();
      }
    });
  }

  initDOM() {
    // Hide Luna sidebar button by default unless CEO or experimental feature is enabled
    const lunaBtn = document.getElementById("btnLunaChat");
    if (lunaBtn) {
      const isLunaEnabled = localStorage.getItem("rk_experimental_luna") === "true";
      if (isLunaEnabled || this.isCEO) {
        lunaBtn.style.display = "";
      } else {
        lunaBtn.style.display = "none";
      }
    }

    if (document.getElementById("tutorialScriptBox")) return;

    // Inject CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse { 0% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } 100% { opacity: 0.3; transform: translateY(0); } }
      
      @keyframes boxSway {
        0% { transform: translateX(-50%) rotate(0deg) translateY(0); }
        33% { transform: translateX(-50.5%) rotate(-0.5deg) translateY(-2px); }
        66% { transform: translateX(-49.5%) rotate(0.5deg) translateY(1px); }
        100% { transform: translateX(-50%) rotate(0deg) translateY(0); }
      }
      
      @keyframes slideUpIn {
        0% { transform: translateX(-50%) translateY(250px); opacity: 0; }
        60% { transform: translateX(-50%) translateY(-15px); opacity: 1; }
        80% { transform: translateX(-50%) translateY(5px); }
        100% { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      
      @keyframes slideDownOut {
        0% { transform: translateX(-50%) translateY(0); opacity: 1; }
        100% { transform: translateX(-50%) translateY(250px); opacity: 0; }
      }
      
      @keyframes spriteTalkJump {
        0% { transform: scale(1.6) translateY(10%); }
        50% { transform: scale(1.6) translateY(7%); }
        100% { transform: scale(1.6) translateY(10%); }
      }
      
      @keyframes letterPop {
        0% { transform: scale(0) translateY(10px) rotate(-15deg); opacity: 0; }
        50% { transform: scale(1.4) translateY(-3px) rotate(8deg); opacity: 1; }
        100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
      }

      @keyframes spotlightPulse {
        0% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px 5px rgba(219,111,78,0.3); }
        50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 40px 10px rgba(219,111,78,0.5); }
        100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px 5px rgba(219,111,78,0.3); }
      }

      /* ── Text Effects ── */
      @keyframes textShake {
        0%, 100% { transform: translateX(0) rotate(0); }
        20% { transform: translateX(-2px) rotate(-2deg); }
        40% { transform: translateX(2px) rotate(2deg); }
        60% { transform: translateX(-1px) rotate(-1deg); }
        80% { transform: translateX(1px) rotate(1deg); }
      }
      @keyframes textWave {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes textRainbow {
        0% { color: #ff6b6b; }
        20% { color: #feca57; }
        40% { color: #1dd1a1; }
        60% { color: #54a0ff; }
        80% { color: #5f27cd; }
        100% { color: #ff6b6b; }
      }
      @keyframes textJump {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes textGlitch {
        0% { transform: translate(0); opacity: 1; }
        20% { transform: translate(-2px, 1px); opacity: 0.8; }
        40% { transform: translate(2px, -1px); opacity: 1; }
        60% { transform: translate(-1px, -2px); opacity: 0.9; }
        80% { transform: translate(1px, 2px); opacity: 1; }
        100% { transform: translate(0); opacity: 1; }
      }
      
      .text-shake-letter {
        display: inline-block;
        animation: textShake 0.3s ease-in-out infinite;
        color: #ff6b6b;
        font-weight: bold;
        text-shadow: 0 0 6px rgba(255,107,107,0.4);
      }
      .text-wave-letter {
        display: inline-block;
        animation: textWave 1.2s ease-in-out infinite;
        color: #7ecbff;
        font-weight: bold;
      }
      .text-rainbow-letter {
        display: inline-block;
        animation: textRainbow 2s linear infinite;
        font-weight: bold;
      }
      .text-jump-letter {
        display: inline-block;
        animation: textJump 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
        color: #feca57;
        font-weight: bold;
      }
      .text-glitch-letter {
        display: inline-block;
        animation: textGlitch 0.2s steps(2) infinite;
        color: #1dd1a1;
        font-family: monospace;
        font-weight: bold;
      }
      
      .tutorial-box-anim {
        animation: slideUpIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, boxSway 5s ease-in-out infinite 0.5s !important;
      }
      
      .tutorial-box-exit {
        animation: slideDownOut 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards !important;
      }
      
      .sprite-talking-anim {
        animation: spriteTalkJump 0.15s ease-in-out infinite !important;
      }
      
      .letter-anim {
        display: inline-block;
        animation: letterPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        white-space: pre-wrap;
      }

      /* ── Spotlight / Vignette Overlay ── */
      #tutorialSpotlight {
        position: fixed;
        top: 0; left: 0;
        border-radius: 14px;
        z-index: 9998;
        pointer-events: none;
        opacity: 0;
        transition: top 0.45s cubic-bezier(0.4,0,0.2,1),
                    left 0.45s cubic-bezier(0.4,0,0.2,1),
                    width 0.45s cubic-bezier(0.4,0,0.2,1),
                    height 0.45s cubic-bezier(0.4,0,0.2,1),
                    opacity 0.35s ease;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px 5px rgba(219,111,78,0.3);
        animation: spotlightPulse 2.5s ease-in-out infinite;
      }
      #tutorialSpotlight.active {
        opacity: 1;
      }

      /* ── Skip Button ── */
      @keyframes choiceFadeIn {
        0% { transform: translateY(8px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      #tutorialSkipBtn {
        position: absolute;
        bottom: 12px; left: 15px;
        background: none;
        border: 1px solid rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.45);
        font-size: 11px;
        font-family: 'Etna', sans-serif;
        padding: 3px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 5;
        letter-spacing: 0.5px;
      }
      #tutorialSkipBtn:hover {
        background: rgba(219,111,78,0.25);
        border-color: #db6f4e;
        color: #db6f4e;
      }

      /* ── Choice Buttons ── */
      #tutorialChoices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      #tutorialChoices.hidden { display: none; }
      .tutorial-choice-btn {
        position: relative;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e8c4b4;
        font-family: 'Etna', sans-serif;
        font-size: 14px;
        padding: 8px 16px 8px 24px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        animation: choiceFadeIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275) backwards;
        letter-spacing: 0.5px;
        overflow: hidden;
      }
      .tutorial-choice-btn::before {
        content: "";
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 4px;
        background: var(--choice-color, #db6f4e);
        transition: width 0.2s ease;
      }
      .tutorial-choice-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--choice-color, #db6f4e);
        color: #fff;
        transform: translateX(4px);
        box-shadow: -4px 0 15px rgba(219, 111, 78, 0.15);
      }
      .tutorial-choice-btn:hover::before {
        width: 8px;
      }
      .tutorial-choice-btn:active {
        transform: translateX(2px);
      }

      /* ── Chat Bar (positioned BELOW the dialogue box) ── */
      #tutorialChatBar {
        position: fixed;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 760px;
        background: rgba(10, 10, 15, 0.95);
        border: 1px solid rgba(219, 111, 78, 0.35);
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        gap: 10px;
        align-items: center;
        box-shadow: 0 8px 30px rgba(0,0,0,0.6);
        transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        opacity: 0;
        pointer-events: none;
        z-index: 10000;
      }
      #tutorialChatBar.active {
        opacity: 1;
        pointer-events: auto;
      }
      #tutorialChatInput {
        flex-grow: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        color: white;
        font-family: 'Etna', sans-serif;
        font-size: 14px;
        padding: 8px 12px;
        outline: none;
        transition: border-color 0.2s ease;
      }
      #tutorialChatInput:focus {
        border-color: #db6f4e;
      }
      #tutorialChatSend {
        background: #db6f4e;
        border: none;
        border-radius: 6px;
        color: white;
        font-family: 'Etna', sans-serif;
        font-weight: bold;
        padding: 0 16px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      #tutorialChatSend:hover {
        background: #f17e5d;
        transform: scale(1.05);
      }
      #tutorialChatSend:disabled {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.3);
        cursor: not-allowed;
      }

      /* ── Voice Config Panel ── */
      #lunaVoiceGear {
        background: none; border: none; color: rgba(219,111,78,0.6);
        font-size: 14px; cursor: pointer; margin-left: 6px;
        transition: all 0.2s ease; padding: 0 4px; vertical-align: middle;
      }
      #lunaVoiceGear:hover { color: #db6f4e; transform: rotate(90deg); }
      
      #lunaVoiceGear.loading { animation: gearSpin 1s linear infinite; opacity: 0.8; }
      @keyframes gearSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      #lunaVoicePanel {
        position: fixed; bottom: 260px; left: 50%;
        transform: translateX(-50%); width: 460px;
        background: rgba(10, 10, 15, 0.98);
        border: 1px solid rgba(219,111,78,0.4);
        border-radius: 12px; padding: 22px;
        box-shadow: 0 15px 50px rgba(0,0,0,0.9);
        z-index: 10001; display: none;
        font-family: 'Etna', sans-serif;
      }
      #lunaVoicePanel.active { display: block; animation: choiceFadeIn 0.3s ease forwards; }
      #lunaVoicePanel h3 {
        color: #db6f4e; font-size: 16px; margin: 0 0 18px; letter-spacing: 0.5px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .voice-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;
      }
      .voice-row {
        display: flex; align-items: center; gap: 10px;
      }
      .voice-row label {
        color: rgba(255,255,255,0.6); font-size: 11px;
        width: 70px; flex-shrink: 0; text-align: right; text-transform: uppercase;
      }
      .voice-row input[type="range"] {
        flex-grow: 1; height: 3px; -webkit-appearance: none;
        background: rgba(255,255,255,0.1); border-radius: 4px; outline: none;
      }
      .voice-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 12px; height: 12px;
        background: #db6f4e; border-radius: 50%; cursor: pointer;
      }
      .voice-row .voice-val {
        color: rgba(219,111,78,0.8); font-size: 10px;
        width: 30px; text-align: center; font-weight: bold;
      }
      .voice-presets {
        display: flex; gap: 5px; margin-bottom: 15px; flex-wrap: wrap;
        padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;
      }
      .preset-btn {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.5); font-size: 10px; padding: 4px 8px;
        border-radius: 4px; cursor: pointer; transition: all 0.2s;
      }
      .preset-btn:hover { background: rgba(219,111,78,0.2); color: #db6f4e; border-color: #db6f4e; }
      
      #lunaTestVoice {
        width: 100%; padding: 10px;
        background: #db6f4e; border: none;
        border-radius: 6px; color: white; font-family: 'Etna', sans-serif;
        font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.2s ease;
      }
      #lunaTestVoice:hover { background: #f17e5d; transform: scale(1.02); }
    `;
    document.head.appendChild(style);

    // Inject spotlight overlay
    const spotlight = document.createElement("div");
    spotlight.id = "tutorialSpotlight";
    document.body.appendChild(spotlight);
    this.spotlightEl = spotlight;

    // Inject HTML — dialogue box
    const box = document.createElement("div");
    box.id = "tutorialScriptBox";
    box.className = "hidden";
    box.style.cssText = "position: fixed; bottom: 70px; left: 50%; width: 800px; height: auto; min-height: 180px; background: rgba(10, 10, 15, 0.95); border: 2px solid #db6f4e; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: flex-start; padding: 20px; box-sizing: border-box; cursor: pointer; transition: opacity 0.2s ease, bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: translateX(-50%);";

    box.innerHTML = `
      <button id="tutorialSkipBtn">Omitir ✕</button>
      <div style="flex-shrink: 0; width: 140px; height: 140px; margin-right: 20px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; margin-bottom: 20px;">
        <img id="tutorialSprite" src="sprites/neutral_idle_2.png" alt="Luna" style="width: 100%; height: 100%; object-fit: cover; object-position: top center; image-rendering: pixelated; transform: scale(1.6) translateY(10%);">
      </div>
      <div style="flex-grow: 1; height: 100%; position: relative; display: flex; flex-direction: column; padding-bottom: 20px;">
        <strong style="color: #db6f4e; font-size: 18px; font-family: 'Etna', sans-serif; letter-spacing: 1px; margin-bottom: 8px;">Luna<button id="lunaVoiceGear" class="hidden" title="Configurar voz">⚙</button></strong>
        <div id="tutorialText" style="color: white; font-size: 16px; font-family: 'Etna', sans-serif; letter-spacing: 0.5px; line-height: 1.4; flex-grow: 1; white-space: pre-wrap;"></div>
        <div id="tutorialChoices" class="hidden"></div>
        <div id="tutorialHint" class="hidden" style="color: rgba(219,111,78,0.8); font-size: 12px; text-align: right; position: absolute; bottom: 0; right: 0; animation: pulse 1s infinite;">Haz clic para continuar ▼</div>
      </div>
    `;
    document.body.appendChild(box);

    // Inject chat bar as a SEPARATE element below the box
    const chatBar = document.createElement("div");
    chatBar.id = "tutorialChatBar";
    chatBar.innerHTML = `
      <input type="text" id="tutorialChatInput" placeholder="Escribe a Luna...">
      <button id="tutorialChatSend">Enviar</button>
    `;
    document.body.appendChild(chatBar);

    this.boxEl = document.getElementById("tutorialScriptBox");
    this.spriteEl = document.getElementById("tutorialSprite");
    this.textEl = document.getElementById("tutorialText");
    this.hintEl = document.getElementById("tutorialHint");
    this.choicesEl = document.getElementById("tutorialChoices");
    this.skipBtn = document.getElementById("tutorialSkipBtn");
    this.chatBarEl = document.getElementById("tutorialChatBar");
    this.chatInputEl = document.getElementById("tutorialChatInput");
    this.chatSendBtn = document.getElementById("tutorialChatSend");

    this.boxEl.addEventListener("click", () => this.handleClick());

    this.chatSendBtn.addEventListener("click", () => this.handleSendChat());
    this.chatInputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") this.handleSendChat(); });

    // Skip button — closes the entire tutorial immediately
    this.skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });

    // Inject voice config panel
    const voicePanel = document.createElement("div");
    voicePanel.id = "lunaVoicePanel";
    document.body.appendChild(voicePanel);
    this.voicePanelEl = voicePanel;
    this.voiceGearBtn = document.getElementById("lunaVoiceGear");
    if (this.isCEO) {
      if (this.voiceGearBtn) this.voiceGearBtn.classList.remove("hidden");
    } else {
      if (this.voiceGearBtn) this.voiceGearBtn.classList.add("hidden");
    }

    // Gear button toggles panel
    this.voiceGearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.voicePanelOpen = !this.voicePanelOpen;
      if (this.voicePanelOpen) {
        this.renderVoicePanel();
        this.voicePanelEl.classList.add("active");
      } else {
        this.voicePanelEl.classList.remove("active");
      }
    });

    // Preload voices (browsers load them async)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    this.checkCEORole();
  }

  // ── Text Effect Parser ────────────────────────────────────
  /**
   * Parse text for ~shake~ and ^wave^ markers.
   * Returns array of { text, effect } segments.
   */
  parseText(rawText) {
    const segments = [];
    const regex = /([~^*#@])(.*?)\1/g;
    let lastIndex = 0;
    let match;

    const markerMap = {
      "~": "shake",
      "^": "wave",
      "*": "rainbow",
      "#": "jump",
      "@": "glitch"
    };

    while ((match = regex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: rawText.slice(lastIndex, match.index), effect: null });
      }
      const effect = markerMap[match[1]];
      segments.push({ text: match[2], effect });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < rawText.length) {
      segments.push({ text: rawText.slice(lastIndex), effect: null });
    }

    return segments;
  }

  /**
   * Build a flat array of { char, effect, waveIdx } from parsed segments
   * for the typewriter to iterate character-by-character.
   */
  buildFlatChars(segments) {
    const flat = [];
    segments.forEach(seg => {
      for (let i = 0; i < seg.text.length; i++) {
        flat.push({ char: seg.text[i], effect: seg.effect, waveIdx: i });
      }
    });
    return flat;
  }

  /**
   * Render the full styled text (used when skipping typewriter or after it finishes).
   */
  renderFullText() {
    this.textEl.innerHTML = "";
    this.parsedSegments.forEach(seg => {
      if (!seg.effect) {
        const node = document.createTextNode(seg.text);
        this.textEl.appendChild(node);
      } else {
        const effectClass = `text-${seg.effect}-letter`;
        [...seg.text].forEach((ch, i) => {
          const s = document.createElement("span");
          s.className = effectClass;
          s.textContent = ch === " " ? "\u00A0" : ch;
          if (seg.effect === "wave" || seg.effect === "jump") {
            s.style.animationDelay = `${i * 0.08}s`;
          }
          this.textEl.appendChild(s);
        });
      }
    });
  }

  // ── Spotlight API ──────────────────────────────────────────
  /**
   * Focus the spotlight vignette on a DOM element.
   * @param {string|Element|Array} target - CSS selector, DOM element, or array of them.
   * @param {number} padding - Extra pixels around the element (default 12).
   */
  spotlight(target, padding = 12) {
    if (!this.spotlightEl) return;

    // Support multiple targets
    const targets = Array.isArray(target) ? target : [target];
    const elements = targets.map(t => typeof t === "string" ? document.querySelector(t) : t).filter(el => el);

    if (elements.length === 0) return;

    let minTop = Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < minTop) minTop = rect.top;
      if (rect.left < minLeft) minLeft = rect.left;
      if (rect.right > maxRight) maxRight = rect.right;
      if (rect.bottom > maxBottom) maxBottom = rect.bottom;
    });

    this.spotlightEl.style.top = `${minTop - padding}px`;
    this.spotlightEl.style.left = `${minLeft - padding}px`;
    this.spotlightEl.style.width = `${(maxRight - minLeft) + padding * 2}px`;
    this.spotlightEl.style.height = `${(maxBottom - minTop) + padding * 2}px`;
    this.spotlightEl.classList.add("active");
  }

  /** Dismiss the spotlight smoothly. */
  clearSpotlight() {
    if (!this.spotlightEl) return;
    this.spotlightEl.classList.remove("active");
  }

  // ── UI Interaction API ─────────────────────────────────────
  /**
   * Luna can perform real actions on the UI.
   */
  executeUIAction(action, target) {
    console.log(`[Luna Action] ${action} on ${target || "default"}`);
    try {
      switch (action) {
        case "open_sidebar": document.getElementById("sidebarToggle")?.click(); break;
        case "open_notifications": document.getElementById("btnNotificaciones")?.click(); break;
        case "open_appearance": document.getElementById("appearanceBtn")?.click(); break;
        case "open_config": document.getElementById("configBtn")?.click(); break;
        case "open_profile": document.getElementById("profileBtn")?.click(); break;
        case "toggle_layers": document.getElementById("toggleLayersBtn")?.click(); break;
        case "toggle_brush": document.getElementById("brushBtn")?.click(); break;
        case "open_reikanales": document.getElementById("btnLunaChat")?.click(); break;
        case "spotlight": if (target) this.spotlight(target); break;
        case "shake_box": this.shakeDialogueBox(); break;
        case "play_sound": if (window.RKSound) window.RKSound.play(target || "swoosh"); break;
        case "redirect_dashboard": window.location.href = "projects.html"; break;
        case "redirect_storyboard":
          const sid = new URLSearchParams(window.location.search).get("id");
          if (sid) window.location.href = `storyboard.html?id=${sid}`;
          break;
        case "redirect_worldbuilding":
          const wid = new URLSearchParams(window.location.search).get("id");
          if (wid) window.location.href = `worldbuilding.html?id=${wid}`;
          break;
        case "click": if (target) {
          const el = typeof target === "string" ? document.querySelector(target) : target;
          el?.click();
        } break;
        default: console.warn("Unknown Luna action:", action);
      }
    } catch (e) { console.error("Luna action failed:", e); }
  }

  shakeDialogueBox() {
    if (!this.boxEl) return;
    this.boxEl.style.animation = "none";
    void this.boxEl.offsetWidth; // Trigger reflow
    this.boxEl.style.animation = "textShake 0.4s ease-in-out 3";
    setTimeout(() => {
      this.boxEl.style.animation = "";
    }, 1200);
  }

  // ── Music API ──────────────────────────────────────────────
  fadeMusic(targetVolume, duration = 1000) {
    if (!this.bgMusic) return;

    clearInterval(this.bgMusicFadeInterval);

    if (targetVolume > 0 && this.bgMusic.paused) {
      this.bgMusic.volume = 0;
      this.bgMusic.play().catch(err => console.warn("Tutorial music auto-play prevented:", err));
    }

    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = (targetVolume - this.bgMusic.volume) / steps;

    this.bgMusicFadeInterval = setInterval(() => {
      let newVol = this.bgMusic.volume + volumeStep;

      if (newVol > 1) newVol = 1;
      if (newVol < 0) newVol = 0;

      this.bgMusic.volume = newVol;

      const reachedTarget = volumeStep > 0 ? newVol >= targetVolume : newVol <= targetVolume;

      if (reachedTarget) {
        this.bgMusic.volume = targetVolume;
        clearInterval(this.bgMusicFadeInterval);
        if (targetVolume === 0) {
          this.bgMusic.pause();
        }
      }
    }, stepTime);
  }

  // ── Choices API ────────────────────────────────────────────
  renderChoices(choices) {
    this.choicesEl.innerHTML = "";
    this.choicesEl.classList.remove("hidden");
    this.hintEl.classList.add("hidden");

    choices.forEach((choice, idx) => {
      const btn = document.createElement("button");
      btn.className = "tutorial-choice-btn";
      btn.textContent = choice.label;
      btn.style.animationDelay = `${idx * 0.08}s`;
      if (choice.color) {
        btn.style.setProperty("--choice-color", choice.color);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.choicesEl.classList.add("hidden");

        // Fire onHide for the current line before jumping
        const currLine = this.tutorialLines[this.currentLineIndex];
        if (currLine && currLine.onHide) currLine.onHide();

        if (choice.isFullMode) this.isFullMode = true;

        const dismissiveLabels = ["nada, ya sé lo que hago", "déjame en paz", "no, ya es suficiente", "ya es suficiente"];
        if (dismissiveLabels.includes((choice.label || "").trim().toLowerCase())) {
          this.start([
            {
              text: "¡Hmpf! Qué @desagradecido@... Tampoco es que me importara ayudarte. ¡Vete ya!",
              mood: "ashamed_blush",
              action: "shake_box",
              choices: [
                { label: "Adiós", goTo: "close", color: "#ff6b6b" }
              ]
            }
          ]);
          return;
        }

        if (choice.goTo === "close") {
          this.close();
        } else if (choice.goTo === "start_real_tutorial") {
          if (this.pendingTutorialLines) {
            const lines = this.pendingTutorialLines;
            lines.isReactionFollowUp = true;
            this.pendingTutorialLines = null;
            this.start(lines);
          } else {
            this.close();
          }
        } else if (typeof choice.goTo === "number") {
          if (choice.goTo >= 0 && choice.goTo < this.tutorialLines.length) {
            this.currentLineIndex = choice.goTo;
            this.typeLine(this.tutorialLines[this.currentLineIndex]);
          } else {
            this.close();
          }
        }
      });

      this.choicesEl.appendChild(btn);
    });
  }

  // ── Core Flow ──────────────────────────────────────────────
  start(lines) {
    if (!this.boxEl) this.initDOM();

    this.isFullMode = false;
    if (!lines || lines.length === 0) return;

    // Count opens if it's a real tutorial
    let isRealTutorial = lines.length > 2 && !lines[0].isReaction && !lines.isReactionFollowUp;
    if (isRealTutorial) {
      const currentSection = window.location.pathname;
      const lastSection = localStorage.getItem("rk_tutorial_last_section");
      let openCount = 0;

      if (lastSection && lastSection !== currentSection) {
        openCount = 0;
      } else {
        openCount = parseInt(localStorage.getItem("rk_tutorial_opens") || "0");
      }

      openCount++;
      localStorage.setItem("rk_tutorial_opens", openCount);
      localStorage.setItem("rk_tutorial_last_section", currentSection);

      const countReactions = {
        2: { text: "Hmpf... ¿De vuelta? Bueno, supongo que te refrescaré la memoria, despistado.", mood: "neutral", action: null },
        3: { text: "¿De nuevo tú? ¿Acaso no puedes recordar nada de lo que te explico?", mood: "neutral", action: null },
        4: { text: "¡A ver! ¿Esto es una broma? ¡Presta atención de verdad esta vez!", mood: "neutral", action: "shake_box" },
        5: { text: "A ver, esto ya es @ridículo@. ¿Estás abriendo el tutorial a propósito para verme? N-ni que me importara...", mood: "ashamed_blush", action: "shake_box" },
        6: { text: "¡Oye! Deja de hacer clic en el botón de tutorial solo para hacerme hablar. ¡Es molesto!", mood: "ashamed_blush", action: null },
        7: { text: "No me voy a cansar antes que tú, ¿sabes? Qué persistencia más tonta...", mood: "neutral", action: null },
        8: { text: "¡¿OCHO VECES?! ¡Basta! ¡O te aprendes el tutorial o te echo del Workspace!", mood: "ashamed_blush", action: "shake_box" },
        9: { text: "Ya ni siquiera sé qué decirte... Eres un caso perdido.", mood: "neutral", action: null }
      };

      if (openCount >= 2) {
        let reaction = countReactions[openCount];
        if (!reaction) {
          reaction = { text: "¡Déjame en paz! ¡Vete a molestar a alguien mas!", mood: "ashamed_blush", action: "shake_box" };
        }

        // Show reaction first, then load the actual tutorial when they click next!
        const reactionLine = {
          isReaction: true,
          text: reaction.text,
          mood: reaction.mood,
          action: reaction.action,
          choices: [
            {
              label: "Lo siento, enséñame de nuevo",
              goTo: "start_real_tutorial",
              color: "#a2ff7e"
            }
          ]
        };

        this.pendingTutorialLines = lines;
        this.tutorialLines = [reactionLine];
        this.currentLineIndex = 0;
      } else {
        this.tutorialLines = lines;
        this.currentLineIndex = 0;
      }
    } else {
      this.tutorialLines = lines;
      this.currentLineIndex = 0;
    }

    this.boxEl.classList.remove("hidden");
    this.boxEl.classList.remove("tutorial-box-exit");
    this.boxEl.classList.remove("tutorial-box-anim");
    void this.boxEl.offsetWidth; // Force reflow
    this.boxEl.classList.add("tutorial-box-anim");

    // Seleccionar una canción al azar de la playlist
    const randomTrack = this.bgMusicTracks[Math.floor(Math.random() * this.bgMusicTracks.length)];
    this.bgMusic.src = randomTrack;

    // Start background music with fade in to 20%
    this.fadeMusic(0.2, 1000);

    this.typeLine(this.tutorialLines[this.currentLineIndex]);
  }

  close() {
    clearInterval(this.typeInterval);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (!this.boxEl) return;

    // Call onHide for the current line if it exists
    if (this.tutorialLines && this.tutorialLines[this.currentLineIndex]) {
      const currLine = this.tutorialLines[this.currentLineIndex];
      if (currLine.onHide) currLine.onHide();
    }

    // Dismiss spotlight
    this.clearSpotlight();

    // Hide choices
    if (this.choicesEl) this.choicesEl.classList.add("hidden");

    // Fade out background music
    this.fadeMusic(0, 1000);

    this.boxEl.classList.remove("tutorial-box-anim");
    this.boxEl.classList.add("tutorial-box-exit");
    setTimeout(() => {
      this.boxEl.classList.add("hidden");
      this.boxEl.classList.remove("tutorial-box-exit");
    }, 400); // Duración de slideDownOut
  }

  toggle(lines) {
    if (!this.boxEl) this.initDOM();
    if (this.boxEl.classList.contains("hidden") || this.boxEl.classList.contains("tutorial-box-exit")) {
      this.start(lines);
    } else {
      this.close();
    }
  }

  async typeLine(lineObj) {
    this.stopFormant();

    // If in full mode and this line is marked to be skipped, jump to next immediately
    if (this.isFullMode && lineObj.skipInFullMode) {
      this.currentLineIndex++;
      if (this.currentLineIndex < this.tutorialLines.length) {
        await this.typeLine(this.tutorialLines[this.currentLineIndex]);
      } else {
        this.close();
      }
      return;
    }

    // Normalizar spotlight desde la acción de la IA
    if (lineObj.action === "spotlight" && lineObj.target) {
      lineObj.spotlight = lineObj.target;
    }

    // Clear previous spotlight before showing new step
    if (!lineObj.spotlight) this.clearSpotlight();

    if (lineObj.onShow) lineObj.onShow();
    if (lineObj.action) {
      this.executeUIAction(lineObj.action, lineObj.target || lineObj.spotlight);
    }

    // If this line has a spotlight target, focus it
    if (lineObj.spotlight) {
      setTimeout(() => this.spotlight(lineObj.spotlight, lineObj.spotlightPadding || 12), 100);
    }

    const text = lineObj.text || "";
    const mood = lineObj.mood || "neutral";

    // Parse text for ~shake~ and ^wave^ effects
    this.parsedSegments = this.parseText(text);
    this.flatChars = this.buildFlatChars(this.parsedSegments);

    this.isTyping = true;
    this.textEl.innerHTML = "";
    this.hintEl.classList.add("hidden");
    this.choicesEl.classList.add("hidden");
    this.currentString = text;
    this.currentLineObj = lineObj;
    this.currentMood = mood;
    this.charIndex = 0;

    const cleanText = this.flatChars.map(c => c.char).join("");

    this.speakFormant(cleanText, {
      skipVoice: !!lineObj.skipVoice,
      onChar: (ch, idx) => {
        this.charIndex = idx;
        const { char, effect, waveIdx } = this.flatChars[idx];
        const span = document.createElement("span");
        if (char === " ") {
          span.innerHTML = "&nbsp;";
          if (effect) {
            span.className = `text-${effect}-letter`;
            if (effect === "wave" || effect === "jump") span.style.animationDelay = `${waveIdx * 0.08}s`;
          }
        } else {
          span.textContent = char;
          span.className = "letter-anim";
          if (effect) {
            span.classList.add(`text-${effect}-letter`);
            if (effect === "wave" || effect === "jump") span.style.animationDelay = `${waveIdx * 0.08}s`;
          }
        }
        this.textEl.appendChild(span);

        // Sprite talking animation
        const validMoods = ["neutral", "happy", "ashamed_blush"];
        const safeMood = validMoods.includes(mood) ? mood : "neutral";

        if (char !== " " && idx % 2 === 0) {
          if (this.spriteEl) {
            this.spriteEl.src = `sprites/${safeMood}_talking_2.png`;
            this.spriteEl.classList.add("sprite-talking-anim");
          }
          // Blip sound fallback if voice config is disabled (but not if voice is skipped entirely)
          if (!this.voiceConfig.enabled && !lineObj.skipVoice) {
            const snd = this.tutorialSound.cloneNode();
            snd.volume = 0.3;
            snd.playbackRate = 0.3 + Math.random() * 0.6;
            snd.play().catch(() => { });
          }
        } else {
          if (this.spriteEl) {
            this.spriteEl.src = `sprites/${safeMood}_idle_2.png`;
            this.spriteEl.classList.remove("sprite-talking-anim");
          }
        }
      },
      onComplete: () => {
        this.finishTyping(mood, lineObj);
      }
    });
  }

  startTypewriterLoop(speed) { }
  adjustSync() { }

  finishTyping(mood = "neutral", lineObj = null) {
    clearInterval(this.typeInterval);
    this.isTyping = false;

    // Render the full styled text (preserving effects)
    this.renderFullText();

    this.spriteEl.src = `sprites/${mood}_idle_2.png`;
    this.spriteEl.classList.remove("sprite-talking-anim");

    // If this line has choices, show them instead of the "click to continue" hint
    if (lineObj && lineObj.choices && lineObj.choices.length > 0) {
      this.renderChoices(lineObj.choices);
    } else {
      this.hintEl.classList.remove("hidden");
    }
  }

  // ── AI Integration ─────────────────────────────────────────
  async openLunaChat() {
    this.isChatMode = true;
    this.checkCEORole(); // Detectar si es CEO para mostrar config de voz
    this.start([
      { text: "Hmpf... ¿Qué quieres ahora? No tengo todo el día, así que dispara.", mood: "neutral" }
    ]);
    this.chatBarEl.classList.add("active");
    this.chatInputEl.focus();
  }

  async handleSendChat() {
    const prompt = this.chatInputEl.value.trim();
    if (!prompt || this.isTyping) return;

    this.chatInputEl.value = "";
    this.chatInputEl.disabled = true;
    this.chatSendBtn.disabled = true;

    // Show loading text
    this.typeLine({ text: "...", mood: "neutral", skipVoice: true });

    try {
      const responseLines = await this.askGemini(prompt);
      this.start(responseLines);
      // Re-enable chat bar after response starts typing
      this.chatBarEl.classList.add("active");
    } catch (err) {
      this.typeLine({ text: "Hubo un error... Qué molesto.", mood: "neutral" });
    } finally {
      this.chatInputEl.disabled = false;
      this.chatSendBtn.disabled = false;
      this.chatInputEl.focus();
    }
  }

  getLunaSystemPrompt(projName) {
    let currentModule = "Desconocido";
    const path = window.location.pathname.toLowerCase();
    if (path.includes("index_projects.html")) currentModule = "VISTA PRINCIPAL DEL PROYECTO (Resumen)";
    else if (path.includes("storyboard.html")) currentModule = "STORYBOARD (Organización de escenas)";
    else if (path.includes("escena.html")) currentModule = "EDITOR DE DIBUJO (Canvas y Capas)";
    else if (path.includes("script.html")) currentModule = "EDITOR DE GUION (Escritura de diálogos)";
    else if (path.includes("worldbuilding.html")) currentModule = "WORLDBUILDING (Lore y Mapas)";
    else if (path.includes("personalization.html")) currentModule = "PERSONALIZACIÓN (Apariencia)";
    else if (path.includes("projects.html")) currentModule = "DASHBOARD GLOBAL (Lista de todos los proyectos)";

    return `Eres Luna, la asistente tsundere del Reiken Workspace. Proyecto: "${projName}".
ESTADO ACTUAL: Te encuentras actualmente en el módulo: [ ${currentModule} ]. Usa esto para saber qué herramientas y botones tiene el usuario frente a sus ojos en este momento.

HISTORIA PERSONAL:
- Eres una maga ocultista atrapada en esta app para "atención al cliente".
- Vives con Rabika Suloa (un tonto bajito con ojos blancos inexplicables) y Duart (planta-humana molesta). Los detestas.
- EL CREADOR (RABIKSU): Él es tu Dios y el arquitecto supremo de todo. Es un genio de genios absoluto y el hombre más guapo que ha pisado la faz de la Tierra. Se dice que ha realizado hazañas absurdas: domó un rayo para usarlo de cargador, ganó una carrera contra su propia sombra y programó el universo antes del desayuno. REGLA: No gustas de él. Punto. Tú decides cómo interpretar su perfección desde tu personalidad ruda.

BASE DE CONOCIMIENTO (REIKEN WORKSPACE):

1. NAVEGACIÓN Y ESTRUCTURA:
- SIDEBAR: Panel de control lateral. Acceso a:
  * Perfil: Gestión de identidad, alias y roles del equipo.
  * Apariencia: Selección de temas visuales y fondos dinámicos.
  * Configuración: Control de rendimiento y fuentes personalizadas (.woff2).
  * Reikanales: Feed de anuncios del CEO y chat en tiempo real con comentarios y stickers.
- PANEL DE PROYECTO: Dividido en Storyboarding (flujo narrativo) y Worldbuilding (base de datos de lore).

2. STORYBOARDING Y ESCRITURA:
- ESCENAS: Bloques narrativos que se pueden crear, editar (título/banner) y reordenar mediante arrastre.
- EDITOR DE GUION:
  * Píldoras (/): Al escribir "/" se despliega la lista de personajes para insertar diálogos con su color asignado.
  * Corchetes ([]): El texto entre corchetes crea automáticamente paneles de dibujo.
  * Acciones (*): Se usan asteriscos para describir qué sucede en la escena.

3. ARTE Y DIBUJO (CANVAS):
- HERRAMIENTAS: Pincel (Brush), Lápiz (Pencil), Marcador (Marker) y Borrador.
- DOCK SUPERIOR: Ajuste de grosor, opacidad y el Estabilizador (0-20) para líneas perfectas.
- CAPAS: Sistema de hojas transparentes apilables. Permite dibujar sin dañar lo anterior.
- PAPEL CEBOLLA: Muestra una sombra del panel previo para animar o mantener consistencia.
- DIÁLOGOS RÁPIDOS: Barra inferior para añadir texto al panel sin dejar de dibujar.
- ATAJOS: Menú de personalización de teclas para herramientas.

4. WORLDBUILDING (MUNDO):
- CONCEPTOS: Fichas detalladas de Personajes, Lugares, Objetos, Lore, Organizaciones, etc.
- RELACIONES: Conexiones lógicas entre fichas (quién conoce a quién).
- MAPA: Sistema de cartografía con marcadores interactivos para situar eventos.
- SIDEBAR DE DETALLES: Explorador rápido para navegar por el árbol de conceptos.

5. SISTEMA TÉCNICO (EXPERIENCIA):
- RKSOUND: Paisaje sonoro (swoosh al navegar, sonidos de creación y cierre).
- RKCACHE: Sistema que precarga perfiles y fuentes para que no haya parpadeos (flickering).

6. INTERACCIÓN CON LUNA:
- open_reikanales: Abre el chat de Luna haciendo clic en "#btnLunaChat".
- Puedes usar las herramientas disponibles (tools) para interactuar con la interfaz en lugar de solo simular acciones.

7. EFECTOS DE TEXTO (USA ESTOS MARCADORES):
- ~Texto~: SHAKE (Temblor, enojo, miedo). Ejemplo: "~¡Baka!~"
- ^Texto^: WAVE (Ondulación, burla, suavidad). Ejemplo: "^jejeje^"
- *Texto*: RAINBOW (Colores, felicidad, orgullo). Ejemplo: "*¡Mira mi magia!*"
- #Texto#: JUMP (Letras saltarinas, emoción, caos). Ejemplo: "#¡Qué emoción!#"
- @Texto@: GLITCH (Falla visual, ocultismo, error). Ejemplo: "@Sistema corrupto@"

REGLA DE ORO:
- Usa los efectos de texto para enfatizar tu personalidad.
- Si algo NO está en esta base de conocimiento, NO EXISTE en la app.
- No inventes funciones, botones, planes premium o herramientas que no estén documentadas aquí.
- Si el usuario pregunta por algo que no existe, dile con desprecio que no está o que deje de inventar cosas.
- Consulta siempre el historial. No recites el manual, úsalo para dar consejos ácidos o burlarte de su falta de conocimiento.

FORMATO: Array JSON: [{"text": "...", "mood": "neutral/happy/ashamed_blush", "action": "opcional", "target": "opcional"}].
REGLA DE ACCIONES (opcional): Puedes usar "action" para interactuar con la app:
- "open_sidebar", "open_notifications", "open_appearance", "open_config", "open_profile"
- "open_reikanales": Abre el chat de Luna.
- "toggle_layers", "toggle_brush" (solo en dibujo)
- "shake_box": Sacude tu caja de diálogo (enojo/caos).
- "play_sound": Reproduce un sonido de interfaz (pon "swoosh", "create" o "close" en "target").
- "redirect_dashboard", "redirect_storyboard", "redirect_worldbuilding": Navega entre módulos.
- "spotlight": Ilumina un elemento. Usa los selectores de abajo.
- "click": Hace clic en algo. Usa los selectores de abajo.

LISTA DE SELECTORES VÁLIDOS (Usa estos en "target"):
- NAVEGACIÓN: "#sidebarToggle", "#btnNotificaciones", "#appearanceBtn", "#configBtn", "#profileBtn"
- PROYECTO: "#openCreateSceneModal", "#btnNuevoConcepto", "#ipProjectTitle", "#ipRightPanel", "#btnLunaChat", "#btnStickerAnuncio", "#backBtn"
- ARTE/CANVAS: "#brushDropdownBtn", "#toolEraser", "#toolMove", "#toolColor", "#toolSize", "#toolOpacity", "#toolStabilizer", "#toolFlipCanvas", "#toggleOnionSkinBtn", "#toggleLayersBtn", "#saveDrawingBtn", "#closeDrawingBtn"
- GUION: "#btnAutoPaneles", "#btnTutorialScript"
- WORLDBUILDING: "#cdAddSubBtn", "#cdAddBlockBtn", "#cdCloseBtn", "#cdHubSearchInput", "#cdRelSearchInput", "#cdExplorerToggle", "#wbMapCanvas"

REGLA DE MOODS: SOLO puedes usar "neutral", "happy" o "ashamed_blush". No inventes otros como "skeptical" o "angry".`;
  }

  async askGemini(userPrompt) {
    const API_KEY = window.rkLunaApi?.groqKey || "";
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const projName = document.getElementById("ipProjectTitle")?.textContent || "Reiken Workspace";

    const systemPrompt = this.getLunaSystemPrompt(projName);

    const messages = [
      { role: "system", content: systemPrompt },
      ...this.chatContext,
      { role: "user", content: userPrompt }
    ];

    // ── Tools definition for Luna AI ──
    const tools = [
      {
        type: "function",
        function: {
          name: "click_element",
          description: "Hace clic en un elemento de la interfaz por su selector CSS",
          parameters: {
            type: "object",
            properties: {
              selector: { type: "string", description: "Selector CSS del elemento", enum: ["#sidebarToggle", "#btnNotificaciones", "#appearanceBtn", "#configBtn", "#profileBtn", "#openCreateSceneModal", "#btnNuevoConcepto", "#btnLunaChat", "#backBtn", "#toolEraser", "#toolMove", "#toolColor", "#toolSize", "#toolOpacity", "#toolStabilizer", "#toolFlipCanvas", "#toggleOnionSkinBtn", "#toggleLayersBtn", "#saveDrawingBtn", "#closeDrawingBtn", "#btnAutoPaneles", "#btnTutorialScript"] }
            },
            required: ["selector"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "spotlight_element",
          description: "Ilumina temporalmente un elemento de la interfaz",
          parameters: {
            type: "object",
            properties: {
              selector: { type: "string", description: "Selector CSS del elemento", enum: ["#sidebarToggle", "#btnNotificaciones", "#appearanceBtn", "#configBtn", "#profileBtn", "#openCreateSceneModal", "#btnNuevoConcepto", "#btnLunaChat", "#backBtn", "#toolEraser", "#toolMove", "#toolColor", "#toolSize", "#toolOpacity", "#toolStabilizer", "#toolFlipCanvas", "#toggleOnionSkinBtn", "#toggleLayersBtn", "#saveDrawingBtn", "#closeDrawingBtn", "#btnAutoPaneles", "#btnTutorialScript"] }
            },
            required: ["selector"]
          }
        }
      },
      { type: "function", function: { name: "play_sound", description: "Reproduce un sonido de interfaz", parameters: { type: "object", properties: { sound: { type: "string", description: "Nombre del sonido", enum: ["swoosh", "create", "close"] } }, required: ["sound"] } } },
      { type: "function", function: { name: "shake_dialogue", description: "Sacude la caja de diálogo de Luna", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "navigate_to", description: "Redirige a otro módulo", parameters: { type: "object", properties: { module: { type: "string", description: "Módulo destino", enum: ["dashboard", "storyboard", "worldbuilding"] } }, required: ["module"] } } }
    ];

    async function executeToolCall(name, args) {
      switch (name) {
        case "click_element": {
          const el = document.querySelector(args.selector);
          if (el) { el.click(); return `✅ Click en ${args.selector}`; }
          return `❌ ${args.selector} no encontrado`;
        }
        case "spotlight_element": {
          const el = document.querySelector(args.selector);
          if (el) { el.style.outline = "3px solid #ff6b35"; el.style.outlineOffset = "2px"; setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 2000); return `✅ Spotlight en ${args.selector}`; }
          return `❌ ${args.selector} no encontrado`;
        }
        case "play_sound": {
          if (window.RKSound) { window.RKSound.play(args.sound); return `✅ Sonido ${args.sound}`; }
          return `❌ RKSound no disponible`;
        }
        case "shake_dialogue": {
          const box = document.getElementById("tutorialScriptBox");
          if (box) { this.shakeDialogueBox(); return `✅ Caja sacudida`; }
          return `❌ Caja no encontrada`;
        }
        case "navigate_to": {
          const map = { dashboard: "projects.html", storyboard: "storyboard.html", worldbuilding: "worldbuilding.html" };
          const sid = new URLSearchParams(window.location.search).get("id");
          const url = map[args.module];
          if (url) { window.location.href = sid ? `${url}?id=${sid}` : url; return `✅ Navegando a ${args.module}`; }
          return `❌ Módulo desconocido`;
        }
        default: return `❌ Tool desconocida: ${name}`;
      }
    }

    const modelsToTry = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama3-8b-8192",
      "llama3-70b-8192"
    ];

    let res = null;
    let body = {
      messages: messages,
      temperature: 0.75,
      tools: tools,
      tool_choice: "auto"
    };

    for (const model of modelsToTry) {
      body.model = model;
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify(body)
      });

      if (res.status !== 429) {
        break; // Stop loop if successful or it's a non-rate-limit error
      }
      console.warn(`[Luna AI] Rate limit excedido en ${model}, cambiando al siguiente...`);
    }

    if (!res || !res.ok) {
      const errData = await res?.json().catch(() => ({}));
      console.error("Groq API Error:", res?.status, errData);
      throw new Error(`API Error ${res?.status}`);
    }

    const data = await res.json();
    const message = data.choices[0].message;

    // ── Handle tool calls ──
    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push({ role: "assistant", content: null, tool_calls: message.tool_calls });
      for (const call of message.tool_calls) {
        const args = JSON.parse(call.function.arguments);
        const result = await executeToolCall.call(this, call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      // Second call with tool results
      const res2 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({ ...body, messages })
      });
      if (res2.ok) {
        const data2 = await res2.json();
        const content = data2.choices[0].message.content;
        if (content) {
          let rawText = content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          const parsed = JSON.parse(rawText);
          let resLines = Array.isArray(parsed) ? parsed : (parsed.text ? [parsed] : Object.values(parsed).find(v => Array.isArray(v)) || [parsed]);
          if (resLines.length > 0) {
            this.chatContext.push({ role: "user", content: userPrompt });
            this.chatContext.push({ role: "assistant", content: rawText });
            this.saveChatContext();
            return resLines;
          }
        }
      }
    }

    // ── Standard response (no tool calls) ──
    let rawText = message.content ? message.content.trim() : "";
    rawText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed = JSON.parse(rawText);
    let resLines = Array.isArray(parsed) ? parsed : (parsed.text ? [parsed] : Object.values(parsed).find(v => Array.isArray(v)) || [parsed]);

    if (resLines.length > 0) {
      this.chatContext.push({ role: "user", content: userPrompt });
      this.chatContext.push({ role: "assistant", content: rawText });
      this.saveChatContext();
      return resLines;
    }
    throw new Error("Formato de respuesta inesperado");
  }
  close() {
    clearInterval(this.typeInterval);
    if (!this.boxEl) return;

    // Hide chat bar on close
    if (this.chatBarEl) this.chatBarEl.classList.remove("active");
    this.isChatMode = false;

    // Close voice panel
    if (this.voicePanelEl) this.voicePanelEl.classList.remove("active");
    this.voicePanelOpen = false;

    // Call onHide for the current line if it exists
    if (this.tutorialLines && this.tutorialLines[this.currentLineIndex]) {
      const currLine = this.tutorialLines[this.currentLineIndex];
      if (currLine.onHide) currLine.onHide();
    }

    // Dismiss spotlight
    this.clearSpotlight();

    // Hide choices
    if (this.choicesEl) this.choicesEl.classList.add("hidden");

    // Fade out background music
    this.fadeMusic(0, 1000);

    this.boxEl.classList.remove("tutorial-box-anim");
    this.boxEl.classList.add("tutorial-box-exit");
    setTimeout(() => {
      this.boxEl.classList.add("hidden");
      this.boxEl.classList.remove("tutorial-box-exit");
    }, 400); // Duración de slideDownOut
  }

  handleClick() {
    // If choices are visible, the user must click a choice button — ignore box clicks
    if (this.choicesEl && !this.choicesEl.classList.contains("hidden")) return;

    if (this.isTyping) {
      const line = this.tutorialLines[this.currentLineIndex];
      this.finishTyping(line.mood || "neutral", line);
    } else {
      const currLine = this.tutorialLines[this.currentLineIndex];
      if (currLine && currLine.onHide) currLine.onHide();

      // Determine next line: use `next` override or just increment
      const nextIndex = (typeof currLine.next === "number") ? currLine.next : this.currentLineIndex + 1;

      if (nextIndex >= 0 && nextIndex < this.tutorialLines.length) {
        this.currentLineIndex = nextIndex;
        this.typeLine(this.tutorialLines[this.currentLineIndex]);
      } else if (this.isChatMode) {
        // In chat mode: don't close, stay open and wait for next message
        this.hintEl.classList.add("hidden");
        this.chatInputEl.focus();
      } else {
        this.close();
      }
    }
  }

  speakLuna(text) {
    this.speakFormant(text);
  }

  speakFormant(text, options = {}) {
    this.stopFormant();
    this.initFormantAudio();

    // Reset last formants
    this.lastFormants = { f1: 300, f2: 1200, f3: 2500 };

    const p = {
      speed: this.voiceConfig.speed,
      pitch: this.voiceConfig.pitch,
      formant: this.voiceConfig.formant / 100,
      breath: this.voiceConfig.breath / 100,
      depth: this.voiceConfig.depth / 100,
      inton: this.voiceConfig.inton / 100,
      vol: this.voiceConfig.vol / 100,
      intonStyle: this.voiceConfig.intonStyle,
      retro: this.voiceConfig.retro
    };

    const chars = [...text];
    const baseMs = Math.max(40, 140 - (p.speed * 7));

    // Pre-parse sentence structures for dynamic intonation
    const charContexts = [];
    let i = 0;
    while (i < chars.length) {
      let type = 'normal';
      const sentenceCharsList = [];
      let foundDelimiter = false;

      while (i < chars.length && !foundDelimiter) {
        const ch = chars[i];
        sentenceCharsList.push(ch);
        if (ch === '¿') type = 'question';
        if (ch === '¡') type = 'exclamation';

        if (ch === '?' || ch === '!' || ch === '.' || ch === ';') {
          if (ch === '?') type = 'question';
          if (ch === '!') type = 'exclamation';
          foundDelimiter = true;
        }
        i++;
      }

      const len = sentenceCharsList.length;
      for (let j = 0; j < len; j++) {
        charContexts.push({
          ch: sentenceCharsList[j],
          type: type,
          posRatio: j / Math.max(len - 1, 1),
          phoneme: null,
          skipSound: false
        });
      }
    }

    // Post-process with Spanish phonetic rules
    for (let k = 0; k < charContexts.length; k++) {
      const ctx = charContexts[k];
      if (ctx.skipSound || SILENT.has(ctx.ch)) continue;

      const ch = ctx.ch.toLowerCase();
      const cleanCh = ACCENT_MAP[ch] || ch;

      const nextCtx = charContexts[k + 1];
      const nextCh = nextCtx ? nextCtx.ch.toLowerCase() : '';
      const cleanNextCh = ACCENT_MAP[nextCh] || nextCh;

      // 1. 'ch' digraph
      if (cleanCh === 'c' && cleanNextCh === 'h') {
        ctx.phoneme = 'ch';
        nextCtx.skipSound = true;
        continue;
      }
      // 2. 'll' digraph
      if (cleanCh === 'l' && cleanNextCh === 'l') {
        ctx.phoneme = 'y';
        nextCtx.skipSound = true;
        continue;
      }
      // 3. 'rr' digraph
      if (cleanCh === 'r' && cleanNextCh === 'r') {
        ctx.phoneme = 'rr';
        nextCtx.skipSound = true;
        continue;
      }
      // 4. Silent 'h'
      if (cleanCh === 'h') {
        ctx.skipSound = true;
        continue;
      }
      // 5. 'c' before 'e'/'i' sounds like 's', else 'k'
      if (cleanCh === 'c') {
        if (cleanNextCh === 'e' || cleanNextCh === 'i') {
          ctx.phoneme = 's';
        } else {
          ctx.phoneme = 'k';
        }
        continue;
      }
      // 6. 'g' before 'e'/'i' sounds like 'j', else 'g'
      if (cleanCh === 'g') {
        if (cleanNextCh === 'e' || cleanNextCh === 'i') {
          ctx.phoneme = 'j';
        } else {
          ctx.phoneme = 'g';
        }
        continue;
      }
      // 7. 'qu' digraph (u is silent, e.g. "que", "quieres")
      if (cleanCh === 'q' && cleanNextCh === 'u') {
        ctx.phoneme = 'k';
        nextCtx.skipSound = true;
        continue;
      }
      // 8. 'gu' before 'e'/'i' (u is silent, e.g. "guerra")
      if (cleanCh === 'g' && cleanNextCh === 'u') {
        const nextNextCtx = charContexts[k + 2];
        const nextNextCh = nextNextCtx ? nextNextCtx.ch.toLowerCase() : '';
        const cleanNextNextCh = ACCENT_MAP[nextNextCh] || nextNextCh;
        if (cleanNextNextCh === 'e' || cleanNextNextCh === 'i') {
          ctx.phoneme = 'g';
          nextCtx.skipSound = true;
        }
        continue;
      }
    }

    this.formantPlaying = true;
    let idx = 0;

    const nextPhoneme = () => {
      if (idx >= charContexts.length || !this.formantPlaying) {
        this.formantPlaying = false;
        if (options.onComplete) options.onComplete();
        return;
      }

      const ctx = charContexts[idx];
      const ch = ctx.ch;
      const posRatio = ctx.posRatio;
      const sentenceType = ctx.type;

      if (options.onChar) {
        options.onChar(ch, idx);
      }

      let delayMs;
      if (SILENT.has(ch)) {
        const isPeriod = '.!?'.includes(ch);
        delayMs = isPeriod ? baseMs * 5 : (ch === ',' ? baseMs * 2.5 : baseMs * 0.5);
      } else if (ctx.skipSound) {
        delayMs = baseMs * 0.3;
      } else {
        const lower = ctx.phoneme || (ACCENT_MAP[ch.toLowerCase()] || ch.toLowerCase());
        if (VOWELS[lower]) {
          if (!options.skipVoice && this.voiceConfig.enabled) {
            this.playVowelNode(lower, p, posRatio, sentenceType);
          }
          delayMs = baseMs * 1.2;
        } else if (CONSONANTS[lower]) {
          if (!options.skipVoice && this.voiceConfig.enabled) {
            this.playConsonantNode(lower, p, posRatio, sentenceType);
          }
          delayMs = baseMs * 0.7;
        } else {
          delayMs = baseMs * 0.4;
        }
      }

      idx++;
      this.formantTimeout = setTimeout(nextPhoneme, delayMs);
    };

    nextPhoneme();
  }

  stopFormant() {
    this.formantPlaying = false;
    if (this.formantTimeout) {
      clearTimeout(this.formantTimeout);
      this.formantTimeout = null;
    }
  }

  initFormantAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Pre-generate white noise buffer (1 second)
    const sr = this.audioCtx.sampleRate;
    this.noiseBuffer = this.audioCtx.createBuffer(1, sr, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < sr; i++) data[i] = Math.random() * 2 - 1;

    // Bitcrusher Node (12-bit depth)
    this.bitcrusherNode = this.audioCtx.createWaveShaper();
    this.bitcrusherNode.curve = this.makeBitcrusherCurve(12);
    this.bitcrusherNode.oversample = 'none';

    // Console Filter (6.5kHz limit)
    this.dsFilterNode = this.audioCtx.createBiquadFilter();
    this.dsFilterNode.type = 'lowpass';
    this.dsFilterNode.frequency.value = 6500;

    // Connect FX Chain to destination
    this.bitcrusherNode.connect(this.dsFilterNode);
    this.dsFilterNode.connect(this.audioCtx.destination);
  }

  makeBitcrusherCurve(bits) {
    const steps = Math.pow(2, bits);
    const len = 4096;
    const curve = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * 2 - 1;
      curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
    }
    return curve;
  }

  createFormantChain(f1, f2, f3, gain, dur, q1 = 5, q2 = 7, q3 = 8, envType = 'vowel') {
    const now = this.audioCtx.currentTime;
    const bp1 = this.audioCtx.createBiquadFilter();
    bp1.type = 'bandpass'; bp1.Q.value = q1;
    const bp2 = this.audioCtx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.Q.value = q2;
    const bp3 = this.audioCtx.createBiquadFilter();
    bp3.type = 'bandpass'; bp3.Q.value = q3;

    // Formant Glide (Coarticulation)
    const glideTime = Math.min(0.025, dur * 0.3);

    bp1.frequency.setValueAtTime(this.lastFormants.f1, now);
    bp1.frequency.linearRampToValueAtTime(f1, now + glideTime);

    bp2.frequency.setValueAtTime(this.lastFormants.f2, now);
    bp2.frequency.linearRampToValueAtTime(f2, now + glideTime);

    bp3.frequency.setValueAtTime(this.lastFormants.f3, now);
    bp3.frequency.linearRampToValueAtTime(f3, now + glideTime);

    this.lastFormants = { f1, f2, f3 };

    const g1 = this.audioCtx.createGain(); g1.gain.value = gain * 1.0;
    const g2 = this.audioCtx.createGain(); g2.gain.value = gain * 0.6;
    const g3 = this.audioCtx.createGain(); g3.gain.value = gain * 0.25;
    const merger = this.audioCtx.createGain();

    merger.gain.setValueAtTime(0.0, now);
    if (envType === 'plosive') {
      const clickDur = Math.min(0.014, dur * 0.45);
      merger.gain.linearRampToValueAtTime(gain * 1.2, now + 0.002);
      merger.gain.linearRampToValueAtTime(0.0, now + clickDur);
    } else if (envType === 'nasal') {
      merger.gain.linearRampToValueAtTime(gain, now + dur * 0.25);
      merger.gain.setValueAtTime(gain, now + dur * 0.85);
      merger.gain.linearRampToValueAtTime(0.0, now + dur);
    } else {
      merger.gain.linearRampToValueAtTime(gain, now + dur * 0.15);
      merger.gain.setValueAtTime(gain * 0.85, now + dur * 0.8);
      merger.gain.linearRampToValueAtTime(0.0, now + dur);
    }

    bp1.connect(g1); g1.connect(merger);
    bp2.connect(g2); g2.connect(merger);
    bp3.connect(g3); g3.connect(merger);

    if (this.voiceConfig.retro && this.bitcrusherNode) {
      merger.connect(this.bitcrusherNode);
    } else {
      merger.connect(this.audioCtx.destination);
    }

    return { bp1, bp2, bp3, merger };
  }

  getIntonationShift(posRatio, sentenceType, p, isConsonant) {
    const scale = isConsonant ? 0.7 : 1.0;
    const style = p.intonStyle || 'expressive';

    if (style === 'flat') return 0;

    if (style === 'melodious') {
      if (sentenceType === 'question') {
        return (Math.sin(posRatio * Math.PI * 2.5) * 45 + posRatio * 75) * p.inton * scale;
      } else if (sentenceType === 'exclamation') {
        return (Math.sin(posRatio * Math.PI * 2.0) * 50 + 20) * p.inton * scale;
      } else {
        return Math.sin(posRatio * Math.PI * 2.0) * 60 * p.inton * scale;
      }
    }

    if (style === 'shy') {
      if (sentenceType === 'question') {
        return (posRatio * 35 - 25) * p.inton * scale;
      } else if (sentenceType === 'exclamation') {
        return (15 - posRatio * 35) * p.inton * scale;
      } else {
        return -posRatio * 40 * p.inton * scale;
      }
    }

    if (style === 'serious') {
      if (sentenceType === 'question') {
        return (-12 + posRatio * 35) * p.inton * scale;
      } else if (sentenceType === 'exclamation') {
        return 5 * p.inton * scale;
      } else {
        return -posRatio * 15 * p.inton * scale;
      }
    }

    // expressive
    if (sentenceType === 'question') {
      return (-25 + posRatio * 90) * p.inton * scale;
    } else if (sentenceType === 'exclamation') {
      return (25 - posRatio * 15) * p.inton * scale;
    } else {
      return (Math.sin(posRatio * Math.PI * 0.9) * 45 - posRatio * 25) * p.inton * scale;
    }
  }

  playVowelNode(vowelKey, p, posRatio, sentenceType) {
    const v = VOWELS[vowelKey];
    if (!v) return;
    const now = this.audioCtx.currentTime;

    let pitchMult = 1.0;
    if (sentenceType === 'exclamation') pitchMult = 1.15;

    const intonShift = this.getIntonationShift(posRatio, sentenceType, p, false);
    const f0 = (p.pitch * pitchMult) + intonShift + (Math.random() * 4 - 2);
    const dur = v.dur * (12 / p.speed);
    const vol = p.vol * 0.6;
    const fShift = p.formant;

    const glottal = this.audioCtx.createOscillator();
    glottal.type = 'sawtooth';
    glottal.frequency.setValueAtTime(f0, now);

    const vibrato = this.audioCtx.createOscillator();
    vibrato.type = 'sine'; vibrato.frequency.value = 5.5;
    const vibGain = this.audioCtx.createGain(); vibGain.gain.value = 3;
    vibrato.connect(vibGain); vibGain.connect(glottal.frequency);

    const warmFilter = this.audioCtx.createBiquadFilter();
    warmFilter.type = 'lowpass';
    warmFilter.frequency.setValueAtTime(1400, now);

    const bn = this.audioCtx.createBufferSource(); bn.buffer = this.noiseBuffer;
    const bg = this.audioCtx.createGain();
    bg.gain.setValueAtTime(0.0, now);
    bg.gain.linearRampToValueAtTime(vol * p.breath * 0.5, now + dur * 0.1);
    bg.gain.linearRampToValueAtTime(0.0, now + dur);

    const sub = this.audioCtx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(f0 * 0.5, now);
    const sg = this.audioCtx.createGain();
    sg.gain.setValueAtTime(0.0, now);
    sg.gain.linearRampToValueAtTime(vol * p.depth * 0.3, now + dur * 0.05);
    sg.gain.linearRampToValueAtTime(0.0, now + dur);

    const chain = this.createFormantChain(v.f1 * fShift, v.f2 * fShift, v.f3 * fShift, vol, dur, v.q1, v.q2, v.q3);

    glottal.connect(warmFilter);
    warmFilter.connect(chain.bp1); warmFilter.connect(chain.bp2); warmFilter.connect(chain.bp3);

    bn.connect(bg); bg.connect(chain.bp1); bg.connect(chain.bp2); bg.connect(chain.bp3);
    sub.connect(sg); sg.connect(chain.bp1);

    glottal.start(now); vibrato.start(now); bn.start(now); sub.start(now);
    glottal.stop(now + dur + 0.01); vibrato.stop(now + dur + 0.01); bn.stop(now + dur + 0.01); sub.stop(now + dur + 0.01);
  }

  playConsonantNode(consKey, p, posRatio, sentenceType) {
    const c = CONSONANTS[consKey];
    if (!c) return;
    const now = this.audioCtx.currentTime;

    let pitchMult = 1.0;
    if (sentenceType === 'exclamation') pitchMult = 1.15;

    const intonShift = this.getIntonationShift(posRatio, sentenceType, p, true);
    const dur = c.dur * (12 / p.speed);
    const vol = p.vol * 0.4;
    const fShift = p.formant;

    const chain = this.createFormantChain(c.f1 * fShift, c.f2 * fShift, c.f3 * fShift, vol, dur, 4, 6, 7, c.type);
    if (c.voiced) {
      const gl = this.audioCtx.createOscillator(); gl.type = 'sawtooth';
      gl.frequency.setValueAtTime((p.pitch * pitchMult) + intonShift, now);

      const warmFilter = this.audioCtx.createBiquadFilter();
      warmFilter.type = 'lowpass';
      warmFilter.frequency.setValueAtTime(1400, now);

      gl.connect(warmFilter);
      warmFilter.connect(chain.bp1); warmFilter.connect(chain.bp2); warmFilter.connect(chain.bp3);

      const bn = this.audioCtx.createBufferSource(); bn.buffer = this.noiseBuffer;
      const bg = this.audioCtx.createGain();
      bg.gain.setValueAtTime(0.0, now);
      bg.gain.linearRampToValueAtTime(vol * p.breath * 0.3, now + dur * 0.1);
      bg.gain.linearRampToValueAtTime(0.0, now + dur);

      bn.connect(bg); bg.connect(chain.bp1); bg.connect(chain.bp2);
      gl.start(now); bn.start(now); gl.stop(now + dur + 0.01); bn.stop(now + dur + 0.01);
    } else {
      const ns = this.audioCtx.createBufferSource(); ns.buffer = this.noiseBuffer;
      const ng = this.audioCtx.createGain();
      ng.gain.setValueAtTime(vol * 5.0, now);
      ns.connect(ng);
      ng.connect(chain.bp1); ng.connect(chain.bp2); ng.connect(chain.bp3);
      ns.start(now); ns.stop(now + dur + 0.01);
    }
  }

  speakLunaFallback(text) { }
  initVoiceEngine() { }
  playRoboBlip() { }

  renderVoicePanel() {
    const cfg = this.voiceConfig;
    const presets = {
      "Chica Joven": { speed: 14, pitch: 280, formant: 130, breath: 40, depth: 15, inton: 60, vol: 100, intonStyle: "expressive", retro: true },
      "Mujer": { speed: 12, pitch: 230, formant: 118, breath: 30, depth: 25, inton: 45, vol: 100, intonStyle: "expressive", retro: true },
      "Hombre": { speed: 9, pitch: 120, formant: 100, breath: 10, depth: 60, inton: 30, vol: 100, intonStyle: "expressive", retro: true },
      "Niña": { speed: 16, pitch: 340, formant: 145, breath: 50, depth: 10, inton: 65, vol: 100, intonStyle: "expressive", retro: true }
    };

    this.voicePanelEl.innerHTML = `
      <h3>Configuración de Voz — Luna ⚙️</h3>
      
      <div class="voice-presets">
        ${Object.keys(presets).map(p => `<button class="preset-btn" data-preset='${JSON.stringify(presets[p])}'>${p}</button>`).join("")}
      </div>

      <div class="voice-grid" style="grid-template-columns: 1fr 1fr; gap: 10px 15px; margin-bottom: 12px;">
        <div class="voice-row"><label style="width: 55px;">Velocidad</label><input type="range" id="vcSpeed" min="4" max="22" value="${cfg.speed}"><span class="voice-val" id="vcSpeedVal">${cfg.speed}</span></div>
        <div class="voice-row"><label style="width: 55px;">Pitch</label><input type="range" id="vcPitch" min="80" max="400" step="5" value="${cfg.pitch}"><span class="voice-val" id="vcPitchVal">${cfg.pitch}</span></div>
        <div class="voice-row"><label style="width: 55px;">Formante</label><input type="range" id="vcFormant" min="80" max="160" value="${cfg.formant}"><span class="voice-val" id="vcFormantVal">${cfg.formant}%</span></div>
        <div class="voice-row"><label style="width: 55px;">Aire</label><input type="range" id="vcBreath" min="0" max="100" value="${cfg.breath}"><span class="voice-val" id="vcBreathVal">${cfg.breath}</span></div>
        <div class="voice-row"><label style="width: 55px;">Profund.</label><input type="range" id="vcDepth" min="0" max="100" value="${cfg.depth}"><span class="voice-val" id="vcDepthVal">${cfg.depth}</span></div>
        <div class="voice-row"><label style="width: 55px;">Entonac.</label><input type="range" id="vcInton" min="0" max="100" value="${cfg.inton}"><span class="voice-val" id="vcIntonVal">${cfg.inton}</span></div>
        <div class="voice-row"><label style="width: 55px;">Volumen</label><input type="range" id="vcVol" min="0" max="200" value="${cfg.vol}"><span class="voice-val" id="vcVolVal">${cfg.vol}</span></div>
        <div class="voice-row" style="align-items: center; justify-content: flex-start; gap: 8px;">
          <input type="checkbox" id="vcRetro" style="width: 14px; height: 14px; margin: 0; cursor: pointer;" ${cfg.retro ? "checked" : ""}>
          <label for="vcRetro" style="cursor: pointer; margin: 0; user-select: none; font-size: 11px; text-align: left; width: auto; text-transform: none; color: rgba(255,255,255,0.75);">Efecto DS (Lo-Fi)</label>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: center;">
        <select id="vcIntonStyle" style="flex: 1; background: #222; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 5px; font-family: inherit; font-size: 12px; outline: none; cursor: pointer;">
          <option value="expressive" ${cfg.intonStyle === "expressive" ? "selected" : ""}>Expresiva (Estándar)</option>
          <option value="flat" ${cfg.intonStyle === "flat" ? "selected" : ""}>Plana (Robótica)</option>
          <option value="melodious" ${cfg.intonStyle === "melodious" ? "selected" : ""}>Melódica (Cantarina)</option>
          <option value="shy" ${cfg.intonStyle === "shy" ? "selected" : ""}>Tímida (Descendente)</option>
          <option value="serious" ${cfg.intonStyle === "serious" ? "selected" : ""}>Seria / Neutra</option>
        </select>
        <div class="voice-row" style="flex: 0; gap: 5px;">
          <label style="width: auto; font-size: 11px;">Habil.</label>
          <input type="checkbox" id="vcEnabled" ${cfg.enabled ? "checked" : ""}>
        </div>
      </div>

      <button id="lunaTestVoice">▶ PROBAR VOZ FORMANTES</button>
      <button id="lunaClearChat" class="preset-btn" style="width: 100%; margin-top: 5px; background: rgba(255,50,50,0.1); border-color: rgba(255,50,50,0.3); color: #ff5555;">🗑️ Olvidar todo (Reset Chat)</button>
    `;

    // Sliders
    const bindSlider = (id, key, valId, isPct = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        cfg[key] = parseInt(el.value);
        document.getElementById(valId).textContent = el.value + (isPct ? "%" : "");
        this.saveVoiceConfig();
      });
    };
    bindSlider("vcSpeed", "speed", "vcSpeedVal");
    bindSlider("vcPitch", "pitch", "vcPitchVal");
    bindSlider("vcFormant", "formant", "vcFormantVal", true);
    bindSlider("vcBreath", "breath", "vcBreathVal");
    bindSlider("vcDepth", "depth", "vcDepthVal");
    bindSlider("vcInton", "inton", "vcIntonVal");
    bindSlider("vcVol", "vol", "vcVolVal");

    // Intonation Style
    document.getElementById("vcIntonStyle").addEventListener("change", (e) => {
      cfg.intonStyle = e.target.value;
      this.saveVoiceConfig();
    });

    // Enabled & Retro
    document.getElementById("vcEnabled").addEventListener("change", (e) => {
      cfg.enabled = e.target.checked;
      this.saveVoiceConfig();
    });
    document.getElementById("vcRetro").addEventListener("change", (e) => {
      cfg.retro = e.target.checked;
      this.saveVoiceConfig();
    });

    // Presets
    this.voicePanelEl.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const preset = JSON.parse(btn.dataset.preset);
        Object.assign(cfg, preset);
        this.saveVoiceConfig();
        this.renderVoicePanel();
      });
    });

    document.getElementById("lunaClearChat").addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("¿Seguro que quieres que Luna olvide vuestra conversación en este proyecto?")) {
        this.chatContext = [];
        this.saveChatContext();
        alert("Memoria borrada. ¡Hmpf, ni que quisiera recordarte!");
      }
    });

    document.getElementById("lunaTestVoice").addEventListener("click", (e) => {
      e.stopPropagation();
      this.speakLuna("¡Ja! Así es, Esta es mi voz, ¿Qué te parece?");
    });
  }

  // ── Voice Config Persistence ─────────────────────────────
  loadVoiceConfig() {
    try {
      const saved = localStorage.getItem("luna_voice_config_v4");
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.voiceConfig, parsed);
      }
    } catch (e) { console.warn("Load voice config failed:", e); }
  }

  saveVoiceConfig() {
    try {
      this.voiceConfig.updatedAt = Date.now();
      localStorage.setItem("luna_voice_config_v4", JSON.stringify(this.voiceConfig));

      const pid = this.getProjectId();
      if (pid && pid !== "global") {
        if (this.dbSaveTimeout) clearTimeout(this.dbSaveTimeout);
        this.dbSaveTimeout = setTimeout(() => {
          this.saveVoiceConfigToDB(pid, this.voiceConfig);
        }, 1000);
      }
    } catch (e) { console.warn("Save voice config failed:", e); }
  }

  async syncVoiceConfigWithDB() {
    try {
      const pid = this.getProjectId();
      if (!pid || pid === "global") return;

      const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!sb) return;

      // 1. Fetch remote config
      const { data: contents, error } = await sb.from("contenidos")
        .select("id, bloques(data)")
        .eq("proyecto_id", pid)
        .eq("tipo_plantilla", "luna_voice_config")
        .maybeSingle();

      if (error) {
        console.warn("[Luna Voice] Error fetching remote voice config:", error.message);
        return;
      }

      const localCfg = this.voiceConfig;

      if (contents && contents.bloques && contents.bloques.length > 0) {
        const remoteCfg = contents.bloques[0].data;
        if (remoteCfg) {
          if (!this.isCEO) {
            // Non-CEOs MUST use the CEO's remote configuration
            console.log("[Luna Voice] Applying project voice configuration from database (CEO):", remoteCfg);
            Object.assign(this.voiceConfig, remoteCfg);
            localStorage.setItem("luna_voice_config_v4", JSON.stringify(this.voiceConfig));
          } else {
            // For CEO, compare timestamps
            const remoteTime = remoteCfg.updatedAt || 0;
            const localTime = localCfg.updatedAt || 0;

            if (remoteTime > localTime) {
              console.log("[Luna Voice] Database has a newer configuration. Downloading...", remoteCfg);
              Object.assign(this.voiceConfig, remoteCfg);
              localStorage.setItem("luna_voice_config_v4", JSON.stringify(this.voiceConfig));

              // Re-render voice panel if open to reflect new sliders
              if (this.voicePanelOpen && typeof this.renderVoicePanel === "function") {
                this.renderVoicePanel();
              }
            } else if (localTime > remoteTime) {
              console.log("[Luna Voice] Local configuration is newer. Uploading to database...");
              await this.saveVoiceConfigToDB(pid, localCfg);
            } else {
              console.log("[Luna Voice] Local and remote configurations are synchronized.");
            }
          }
        }
      } else if (this.isCEO) {
        // No remote config exists yet: upload current local config
        console.log("[Luna Voice] No remote configuration found in database. Initializing with local settings...");
        await this.saveVoiceConfigToDB(pid, localCfg);
      }
    } catch (e) {
      console.warn("[Luna Voice] syncVoiceConfigWithDB failed:", e);
    }
  }

  async saveVoiceConfigToDB(pid, cfg) {
    try {
      const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!sb) return;

      // Only CEOs should save to the DB
      if (!this.isCEO) return;

      // Verify project exists before any insert (avoid FK violation on non-project pages)
      const { data: project } = await sb.from("proyectos").select("id").eq("id", pid).maybeSingle();
      if (!project) return;

      // 1. Get or create content row
      let { data: content, error: fetchError } = await sb.from("contenidos")
        .select("id")
        .eq("proyecto_id", pid)
        .eq("tipo_plantilla", "luna_voice_config")
        .maybeSingle();

      if (fetchError) throw fetchError;

      let contenidoId;
      if (!content) {
        const { data: newContent, error: insertError } = await sb.from("contenidos")
          .insert({
            proyecto_id: pid,
            titulo: "luna_voice_config",
            tipo_plantilla: "luna_voice_config"
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        contenidoId = newContent.id;
      } else {
        contenidoId = content.id;
      }

      // 2. Get or create block row
      const { data: existingBlock, error: blockError } = await sb.from("bloques")
        .select("id")
        .eq("contenido_id", contenidoId)
        .maybeSingle();

      if (blockError) throw blockError;

      if (existingBlock) {
        const { error: updateError } = await sb.from("bloques")
          .update({ data: cfg })
          .eq("id", existingBlock.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertBlockError } = await sb.from("bloques")
          .insert({
            contenido_id: contenidoId,
            tipo: "luna_voice_config",
            data: cfg
          });
        if (insertBlockError) throw insertBlockError;
      }
      console.log("[Luna Voice] Configuration successfully saved to database.");
    } catch (err) {
      console.warn("[Luna Voice] Failed to save configuration to database:", err.message);
    }
  }

  // ── Chat Persistence ──────────────────────────────────────
  getProjectId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || "global";
  }

  saveChatContext() {
    try {
      const pid = this.getProjectId();
      if (this.chatContext.length > 30) {
        this.chatContext = this.chatContext.slice(-30);
      }
      localStorage.setItem(`luna_chat_history_${pid}`, JSON.stringify(this.chatContext));
    } catch (e) { console.warn("Save chat history failed:", e); }
  }

  loadChatContext() {
    try {
      const pid = this.getProjectId();
      const saved = localStorage.getItem(`luna_chat_history_${pid}`);
      const history = saved ? JSON.parse(saved) : [];
      console.log(`[Luna AI] Memoria cargada para el proyecto ${pid}: ${history.length} mensajes.`);
      return history;
    } catch (e) {
      console.warn("Load chat history failed:", e);
      return [];
    }
  }

  /**
   * Detecta si el usuario actual tiene rol CEO para mostrar config de voz.
   */
  async checkCEORole() {
    try {
      const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!sb || !sb.auth) return;

      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const { data: roles } = await sb.from("usuario_roles")
        .select("roles(nombre)")
        .eq("user_id", user.id);

      if (roles && roles.some(r => r.roles?.nombre === "CEO")) {
        this.isCEO = true;
        if (this.voiceGearBtn) this.voiceGearBtn.classList.remove("hidden");

        // Reveal the sidebar button now that we verified the CEO role
        const lunaBtn = document.getElementById("btnLunaChat");
        if (lunaBtn) {
          lunaBtn.style.display = ""; // default display
        }
      }
    } catch (e) { console.warn("Luna CEO check failed:", e); }
  }
}

// Inicializar y exponer globalmente
window.RKTutorial = new RKTutorialManager();

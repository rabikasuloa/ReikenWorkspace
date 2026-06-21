// ══════════════════════════════════════════════════════
//  REIKANALES — Sistema de chat flotante v2
//  Fixes: reply, scroll opt., font local, avatar pos.,
//         user-card dedupe, bg chat, font-size, auto-login
// ══════════════════════════════════════════════════════

(function () {

  // ── Estado global ─────────────────────────────────────
  const RK = {
    sb: null,
    user: null,
    userAlias: null,
    userAvatar: null,
    userColor: null,
    userFont: null,
    activeChannel: null,
    channels: [],
    realtimeSub: null,
    msgCache: {},
    windowOpen: false,
    stickers: [],
    favStickers: [],
    stickerPanelOpen: false,
    autoScroll: true,
    replyingTo: null,
    fontSize: 14,
    chatBg: null,
    uiScale: 1,
    globalRealtimeSub: null,
    lastNotiTime: 0,
    notiTimeout: null,
    typingUsers: {},
    typingTimeout: null,
    membersPanelOpen: false,
    onlineUsers: new Set(),
    myMsgBg: "rgba(219,111,78,0.42)",
    otherMsgBg: "rgba(255,255,255,0.1)",
    globalStickers: [],
    stickerTab: 'mis', // 'mis', 'fav', 'global'
    pendingImage: null, // { file, previewUrl }
    oldestMsgDate: {}, // { channelId: dateString }
    canLoadMore: {}, // { channelId: boolean }
    loadingMore: false,
    sidebarCollapsed: false,
  };

  // ── Emoji dataset para búsqueda ──────────────────────
  const EMOJI_DATA = [
    // Smileys & Emotion
    {e:"😀",k:["grinning","happy","smile","face","cheek"]},
    {e:"😃",k:["smiley","happy","joy","face","mouth"]},
    {e:"😄",k:["smile","happy","joy","face","eye"]},
    {e:"😁",k:["grin","happy","smile","face","eye","teeth"]},
    {e:"😆",k:["laugh","happy","face","mouth","eye","grin"]},
    {e:"😅",k:["sweat","smile","happy","face","cold"]},
    {e:"🤣",k:["rofl","laugh","floor","rolling","face","happy"]},
    {e:"😂",k:["joy","laugh","cry","tears","face","happy"]},
    {e:"🙃",k:["upside","down","face","silly"]},
    {e:"😉",k:["wink","face","flirt"]},
    {e:"😊",k:["blush","smile","happy","face","eye","cheek"]},
    {e:"😇",k:["innocent","angel","halo","smile","face"]},
    {e:"🥰",k:["love","heart","face","smile","happy","3"]},
    {e:"😍",k:["heart","eyes","love","smile","face","crush"]},
    {e:"😘",k:["kiss","heart","love","face","blow"]},
    {e:"😗",k:["kiss","face","lip"]},
    {e:"😚",k:["kiss","close","eye","face","blush"]},
    {e:"😋",k:["tongue","yum","face","delicious","savor"]},
    {e:"😛",k:["tongue","face","silly","playful"]},
    {e:"😜",k:["wink","tongue","face","silly","playful"]},
    {e:"🤩",k:["star","struck","face","excited","amazed"]},
    {e:"😌",k:["relieved","face","calm","peace"]},
    {e:"😔",k:["pensive","sad","face","melancholy"]},
    {e:"😪",k:["sleepy","face","tired","nap"]},
    {e:"🤤",k:["drool","face","hungry","desire"]},
    {e:"😴",k:["sleep","face","zzz","tired"]},
    {e:"😲",k:["shock","surprise","face","amazed","oh"]},
    {e:"🥺",k:["pleading","face","beg","cute","eye","tear"]},
    {e:"😢",k:["cry","sad","tear","face","upset"]},
    {e:"😭",k:["sob","cry","tears","sad","face","loud"]},
    {e:"😤",k:["angry","frustrated","face","steam","mad"]},
    {e:"😠",k:["angry","face","mad","upset"]},
    {e:"😡",k:["rage","angry","face","mad","red"]},
    {e:"🤬",k:["mask","face","curse","swear","angry"]},
    {e:"😈",k:["devil","smile","face","evil","horn","grin"]},
    {e:"👿",k:["devil","angry","face","evil","horn"]},
    {e:"💀",k:["skull","death","dead","face","bone"]},
    {e:"☠️",k:["skull","cross","death","pirate","poison"]},
    {e:"💩",k:["poop","poo","shit","crap","turd","pile","dung"]},
    {e:"🤡",k:["clown","face","circus","creepy"]},
    {e:"👹",k:["ogre","oni","monster","face","japanese"]},
    {e:"👺",k:["goblin","face","monster","japanese","creepy"]},
    {e:"👻",k:["ghost","spooky","halloween","boo"]},
    {e:"👽",k:["alien","space","ufo","scifi"]},
    {e:"🤖",k:["robot","face","machine","scifi"]},
    {e:"😺",k:["cat","smile","grin","face","happy"]},
    {e:"😸",k:["cat","grin","smile","eye","happy"]},
    {e:"😹",k:["cat","joy","laugh","tear","cry"]},
    {e:"😻",k:["cat","heart","eye","love","smile"]},
    {e:"😼",k:["cat","wry","smile","face","sarcastic"]},
    // Hands & Gestures
    {e:"👋",k:["wave","hand","hello","goodbye","gesture"]},
    {e:"🤚",k:["hand","raised","palm","stop"]},
    {e:"✋",k:["raised","hand","stop","high","five"]},
    {e:"✌️",k:["victory","peace","hand","finger","v"]},
    {e:"🤞",k:["cross","finger","luck","hopeful"]},
    {e:"🤟",k:["love","you","hand","gesture","rock"]},
    {e:"🤘",k:["horns","rock","hand","metal","devil"]},
    {e:"🤙",k:["call","hand","shaka","surf","phone"]},
    {e:"👈",k:["point","left","hand","finger","direction"]},
    {e:"👉",k:["point","right","hand","finger","direction"]},
    {e:"👆",k:["point","up","hand","finger","direction"]},
    {e:"👇",k:["point","down","hand","finger","direction"]},
    {e:"👍",k:["thumbs","up","like","yes","approve","good"]},
    {e:"👎",k:["thumbs","down","dislike","no","bad"]},
    {e:"✊",k:["fist","raised","power","protest"]},
    {e:"👊",k:["fist","punch","hit","hand"]},
    {e:"🤛",k:["fist","left","hand","gesture"]},
    {e:"🤜",k:["fist","right","hand","gesture"]},
    {e:"👏",k:["clap","applause","praise","congratulate","hand"]},
    {e:"🙌",k:["raised","hands","celebrate","hooray","praise"]},
    {e:"🤝",k:["handshake","agree","deal","meet","partner"]},
    {e:"🙏",k: ["pray","please","thank","hope","wish","beg"]},
    {e:"💪",k:["muscle","strong","arm","flex","power"]},
    {e:"🤳",k:["selfie","phone","camera","hand"]},
    {e:"💅",k:["nail","polish","manicure","care","beauty"]},
    {e:"👀",k:["eyes","look","see","watch","stare"]},
    {e:"👅",k:["tongue","mouth","taste","lick"]},
    {e:"👄",k:["lips","mouth","kiss","lip"]},
    {e:"🦶",k:["foot","kick","stomp","body"]},
    {e:"🦵",k:["leg","kick","body","limb"]},
    // Hearts
    {e:"❤️",k:["heart","love","red","like"]},
    {e:"🧡",k:["orange","heart","love","color"]},
    {e:"💛",k:["yellow","heart","love","color"]},
    {e:"💚",k:["green","heart","love","color"]},
    {e:"💙",k:["blue","heart","love","color"]},
    {e:"💜",k:["purple","heart","love","color"]},
    {e:"🖤",k:["black","heart","love","dark"]},
    {e:"🤍",k:["white","heart","love","pure"]},
    {e:"💔",k:["broken","heart","break","sad","love"]},
    {e:"💕",k:["two","hearts","love","romance","couple"]},
    {e:"💞",k:["revolving","hearts","love","circle"]},
    {e:"💓",k:["beating","heart","love","pulse"]},
    {e:"💗",k:["growing","heart","love","sparkle","pink"]},
    {e:"💖",k:["sparkling","heart","love","shine","glitter"]},
    {e:"💘",k:["cupid","arrow","heart","love","valentine"]},
    {e:"💝",k:["ribbon","heart","love","gift","valentine"]},
    {e:"💟",k:["heart","decoration","symbol"]},
    {e:"♥️",k:["heart","suit","card","game","symbol"]},
    // Animals
    {e:"🐶",k:["dog","puppy","pet","face","animal"]},
    {e:"🐱",k:["cat","kitten","pet","face","animal"]},
    {e:"🐭",k:["mouse","rat","face","animal","rodent"]},
    {e:"🐹",k:["hamster","pet","face","rodent","animal"]},
    {e:"🐰",k:["rabbit","bunny","face","pet","animal","ear"]},
    {e:"🦊",k:["fox","face","animal","cunning","wild"]},
    {e:"🐻",k:["bear","face","animal","wild"]},
    {e:"🐼",k:["panda","face","bear","animal","cute"]},
    {e:"🐨",k:["koala","bear","face","animal","australia"]},
    {e:"🦁",k:["lion","face","animal","wild","king","mane"]},
    {e:"🐯",k:["tiger","face","animal","wild","stripe"]},
    {e:"🐮",k:["cow","face","animal","farm","milk"]},
    {e:"🐷",k:["pig","face","animal","farm","oink"]},
    {e:"🐸",k:["frog","face","animal","amphibian","ribbit"]},
    {e:"🐵",k:["monkey","face","animal","primate","funny"]},
    {e:"🐔",k:["chicken","bird","animal","farm","egg"]},
    {e:"🐧",k:["penguin","bird","animal","antarctica","cute"]},
    {e:"🐦",k:["bird","animal","fly","wing"]},
    {e:"🦅",k:["eagle","bird","animal","fly","soar"]},
    {e:"🦉",k:["owl","bird","animal","wise","night"]},
    {e:"🦇",k:["bat","animal","fly","vampire","nocturnal","halloween"]},
    {e:"🐺",k:["wolf","face","animal","wild","howl"]},
    {e:"🐗",k:["boar","pig","animal","wild"]},
    {e:"🐴",k:["horse","face","animal","farm","gallop"]},
    {e:"🦄",k:["unicorn","face","animal","fantasy","magic"]},
    {e:"🐝",k:["bee","honey","insect","buzz","pollen"]},
    {e:"🐛",k:["bug","insect","caterpillar","creepy"]},
    {e:"🦋",k:["butterfly","insect","beauty","fly","wing"]},
    {e:"🐌",k:["snail","slow","animal","garden","shell"]},
    {e:"🐙",k:["octopus","sea","ocean","tentacle","marine"]},
    // Food & Drink
    {e:"🍎",k:["apple","fruit","red","healthy"]},
    {e:"🍐",k:["pear","fruit","green"]},
    {e:"🍊",k:["orange","fruit","citrus","tangerine"]},
    {e:"🍋",k:["lemon","fruit","citrus","sour","yellow"]},
    {e:"🍌",k:["banana","fruit","yellow","tropical"]},
    {e:"🍉",k:["watermelon","fruit","summer","sweet"]},
    {e:"🍇",k:["grape","fruit","bunch","wine"]},
    {e:"🍓",k:["strawberry","fruit","berry","sweet","red"]},
    {e:"🍑",k:["peach","fruit","juicy","orange"]},
    {e:"🍒",k:["cherry","fruit","red","pair","sweet"]},
    {e:"🍄",k:["mushroom","fungi","nature","forest"]},
    {e:"🌽",k:["corn","maize","food","farm","yellow"]},
    {e:"🌶️",k:["pepper","hot","spicy","chili","food"]},
    {e:"🥕",k:["carrot","vegetable","food","healthy","orange"]},
    {e:"🍞",k:["bread","food","loaf","toast","bakery"]},
    {e:"🧀",k:["cheese","food","dairy","wedge","yellow"]},
    {e:"🍔",k:["burger","hamburger","food","fast","meat"]},
    {e:"🍟",k:["fries","french","chips","food","fast","potato"]},
    {e:"🌭",k:["hotdog","food","fast","sausage"]},
    {e:"🍕",k:["pizza","food","italian","slice","cheese"]},
    {e:"🥪",k:["sandwich","food","bread","lunch"]},
    {e:"🌮",k:["taco","food","mexican","tortilla"]},
    {e:"🌯",k:["burrito","food","mexican","wrap"]},
    {e:"🍦",k:["icecream","dessert","sweet","cold","cone"]},
    {e:"🎂",k:["cake","birthday","dessert","celebrate","sweet"]},
    {e:"☕",k:["coffee","drink","hot","cafe","morning"]},
    {e:"🍵",k:["tea","drink","cup","green","hot"]},
    {e:"🧃",k:["juice","drink","box","pack","beverage"]},
    {e:"🥤",k:["cup","drink","soda","beverage","straw"]},
    {e:"🍺",k:["beer","drink","alcohol","mug","bar"]},
    {e:"🍻",k:["cheers","beer","drink","toast","clink","celebrate"]},
    {e:"🍷",k:["wine","drink","glass","alcohol","bar"]},
    {e:"🥂",k:["clink","glass","toast","celebrate","drink"]},
    {e:"🍸",k:["cocktail","drink","glass","bar","alcohol"]},
    {e:"🍼",k:["milk","baby","bottle","drink","infant"]},
    // Nature & Weather
    {e:"🌹",k:["rose","flower","love","romance","red"]},
    {e:"🌸",k:["cherry","blossom","flower","spring","pink","sakura"]},
    {e:"🌺",k:["hibiscus","flower","tropical","pink"]},
    {e:"🌻",k:["sunflower","flower","bright","summer","yellow"]},
    {e:"🌼",k:["blossom","flower","yellow","spring"]},
    {e:"🌷",k:["tulip","flower","spring","pink","bulb"]},
    {e:"🌱",k:["sprout","seedling","plant","new","growth"]},
    {e:"🌲",k:["tree","pine","evergreen","forest","nature"]},
    {e:"🌳",k:["tree","deciduous","nature","forest","leaf"]},
    {e:"🌴",k:["palm","tree","tropical","beach","summer"]},
    {e:"🍀",k:["clover","four","leaf","luck","irish"]},
    {e:"🍁",k:["maple","leaf","fall","autumn","canada"]},
    {e:"🍂",k:["leaves","fall","autumn","nature","wind"]},
    {e:"🍃",k:["leaf","wind","nature","flutter","green"]},
    {e:"🌈",k:["rainbow","sky","color","lgbt","pride","hope"]},
    {e:"☀️",k:["sun","sunny","bright","weather","light","summer"]},
    {e:"🌙",k:["moon","crescent","night","dark"]},
    {e:"🌝",k:["full","moon","night","bright","face"]},
    {e:"🌟",k:["star","glow","sparkle","bright","shine"]},
    {e:"⭐",k:["star","yellow","bright","rating","shine"]},
    {e:"☁️",k:["cloud","sky","weather","overcast"]},
    {e:"⛅",k:["sun","cloud","weather","partly"]},
    {e:"🌧️",k:["rain","cloud","weather","drop"]},
    {e:"⛈️",k:["thunder","storm","rain","cloud","lightning"]},
    {e:"❄️",k:["snow","flake","cold","winter","ice"]},
    // Activities
    {e:"⚽",k:["soccer","ball","sport","football","goal"]},
    {e:"🏀",k:["basketball","ball","sport","hoop","nba"]},
    {e:"🏈",k:["football","ball","sport","nfl","american"]},
    {e:"⚾",k:["baseball","ball","sport","bat","mlb"]},
    {e:"🎾",k:["tennis","ball","sport","racquet"]},
    {e:"🏐",k:["volleyball","ball","sport","net"]},
    {e:"🏉",k:["rugby","ball","sport","football"]},
    {e:"🎱",k:["pool","billiard","ball","8","game"]},
    {e:"🏓",k:["ping","pong","table","tennis","sport"]},
    {e:"🏸",k:["badminton","sport","racket","shuttle"]},
    {e:"🥊",k:["boxing","glove","sport","punch","fight"]},
    {e:"🥋",k:["martial","arts","uniform","sport","karate"]},
    {e:"🎯",k:["dart","target","bullseye","game","aim"]},
    {e:"⛳",k:["golf","hole","sport","flag","course"]},
    {e:"🎣",k:["fishing","pole","fish","sport","angle"]},
    {e:"🎿",k:["ski","snow","sport","winter"]},
    {e:"🏂",k:["snowboard","snow","sport","winter"]},
    {e:"🚴",k:["cycle","bike","sport","ride"]},
    {e:"🏋️",k:["gym","lift","weight","sport","muscle","strong"]},
    {e:"🛹",k:["skateboard","skate","board","trick"]},
    // Travel
    {e:"🚗",k:["car","auto","vehicle","drive","sedan"]},
    {e:"🚕",k:["taxi","cab","car","vehicle","ride"]},
    {e:"🚌",k:["bus","vehicle","transport","school"]},
    {e:"🚲",k:["bike","bicycle","cycle","ride","vehicle"]},
    {e:"🏍️",k:["motorcycle","bike","ride","vehicle"]},
    {e:"✈️",k:["plane","airplane","flight","travel","fly"]},
    {e:"🚀",k:["rocket","space","launch","ship","fast"]},
    {e:"🛸",k:["ufo","flying","saucer","space","alien"]},
    {e:"🚁",k:["helicopter","air","vehicle","fly","rotor"]},
    {e:"🚢",k:["ship","boat","vessel","sea","water"]},
    {e:"⛵",k:["sailboat","boat","sail","sea","water"]},
    {e:"🚤",k:["speedboat","boat","fast","sea","water"]},
    {e:"🚃",k:["train","car","rail","vehicle","railway"]},
    {e:"🚇",k:["subway","metro","train","underground","station"]},
    {e:"🚉",k:["station","train","subway","platform","transport"]},
    // Objects
    {e:"💡",k:["bulb","light","idea","bright","invention"]},
    {e:"🔦",k:["flashlight","torch","light","camp"]},
    {e:"🔑",k:["key","lock","unlock","access","password"]},
    {e:"🗝️",k:["key","old","antique","lock"]},
    {e:"🔧",k:["wrench","tool","fix","repair","spanner"]},
    {e:"🔨",k:["hammer","tool","fix","nail","build"]},
    {e:"🔩",k:["nut","bolt","screw","tool","hardware"]},
    {e:"⚙️",k:["gear","settings","cog","mechanical","wheel"]},
    {e:"💣",k:["bomb","explosive","danger","boom"]},
    {e:"🧨",k:["firecracker","explosive","boom","year","new"]},
    {e:"🎈",k:["balloon","party","celebrate","float"]},
    {e:"🎉",k:["party","celebrate","tada","congratulate","confetti"]},
    {e:"🎊",k:["confetti","party","celebrate","ball"]},
    {e:"🎁",k:["gift","present","birthday","wrap","celebrate"]},
    {e:"🎀",k:["ribbon","bow","gift","decoration"]},
    {e:"💎",k:["diamond","gem","jewel","sparkle","luxury"]},
    {e:"📀",k:["disc","dvd","cd","optical","media"]},
    // Music & Art
    {e:"🎵",k:["note","music","song","melody","sound"]},
    {e:"🎶",k:["notes","music","song","melody","sound"]},
    {e:"🎧",k:["headphone","music","listen","audio","ear"]},
    {e:"🎤",k:["mic","microphone","sing","karaoke","voice"]},
    {e:"🎸",k:["guitar","music","instrument","rock","string"]},
    {e:"🎹",k:["keyboard","piano","music","instrument","note"]},
    {e:"🥁",k:["drum","music","instrument","beat","percussion"]},
    {e:"🎬",k:["clapper","board","movie","film","action","director"]},
    {e:"🎨",k:["palette","art","paint","color","creative","artist"]},
    {e:"📷",k:["camera","photo","picture","capture","snap"]},
    // Tech
    {e:"📱",k:["phone","mobile","smartphone","iphone","device"]},
    {e:"💻",k:["laptop","computer","mac","pc","device","code"]},
    {e:"🖥️",k:["desktop","computer","monitor","pc","screen"]},
    {e:"🖨️",k:["printer","print","device","office","paper"]},
    {e:"🖱️",k:["mouse","computer","click","device","pc"]},
    {e:"⌨️",k:["keyboard","type","computer","device","key"]},
    {e:"💾",k:["disk","floppy","save","computer","old"]},
    {e:"💿",k:["cd","disc","music","media","optical"]},
    // Celebration & Seasonal
    {e:"🎃",k:["halloween","pumpkin","jack","lantern","spooky"]},
    {e:"🎄",k:["christmas","tree","xmas","holiday","decorate"]},
    {e:"🎆",k:["fireworks","celebrate","year","new","explode"]},
    {e:"🎇",k:["sparkler","firework","celebrate","glow","year"]},
    {e:"✨",k:["sparkles","sparkle","shine","glitter","magic","pretty"]},
    {e:"🪄",k:["magic","wand","sparkle","fantasy","wizard"]},
    {e:"🔮",k:["crystal","ball","fortune","future","magic","psychic"]},
    {e:"🧿",k:["nazar","amulet","eye","protect","evil"]},
    // Symbols
    {e:"✅",k:["check","mark","yes","done","correct","approve"]},
    {e:"❌",k:["cross","mark","no","wrong","cancel","x"]},
    {e:"❓",k:["question","mark","confused","unknown","help"]},
    {e:"❗",k:["exclamation","mark","emphasis","alert","important"]},
    {e:"💯",k:["100","perfect","score","full","points"]},
    {e:"♻️",k:["recycle","recycling","green","environment"]},
    {e:"🛑",k:["stop","sign","halt","red","octagon"]},
    {e:"⚠️",k:["warning","caution","alert","danger","sign"]},
    {e:"🚫",k:["prohibited","forbidden","no","ban","stop"]},
    {e:"🔴",k:["red","circle","dot","color","stop"]},
    {e:"🟠",k:["orange","circle","dot","color"]},
    {e:"🟡",k:["yellow","circle","dot","color"]},
    {e:"🟢",k:["green","circle","dot","color","go"]},
    {e:"🔵",k:["blue","circle","dot","color"]},
    {e:"🟣",k:["purple","circle","dot","color"]},
    // Flags
    {e:"🏁",k:["finish","flag","checkered","race","winner"]},
    {e:"🚩",k:["flag","red","marker","goal"]},
    {e:"🎌",k:["cross","flag","japan","celebration"]},
    {e:"🏴‍☠️",k:["pirate","flag","skull","cross","jolly","roger"]},
    {e:"🇵🇷",k:["puerto","rico","flag","pr","boricua"]},
    // Extra useful
    {e:"🔥",k:["fire","hot","lit","burn","flame","awesome"]},
    {e:"💦",k:["sweat","drop","water","drip"]},
    {e:"💨",k:["dash","wind","run","fast","smoke"]},
    {e:"🕳️",k:["hole","black","void","tunnel"]},
    {e:"💫",k:["dizzy","star","spin","circle","shooting"]},
    {e:"🗣️",k:["speak","talk","voice","silhouette","head"]},
    {e:"🧠",k:["brain","mind","smart","intelligence","head"]},
    {e:"🫀",k:["heart","anatomy","pulse","real","organ"]},
    {e:"👁️",k:["eye","vision","see","look","iris"]},
    {e:"👣",k:["footprint","feet","walk","step","track"]},
  ];

  // ── Recent emojis helpers ────────────────────────────
  function getRecentEmojis() {
    if (!RK.user) return [];
    try {
      return JSON.parse(localStorage.getItem(`rk_recent_emojis_${RK.user.id}`) || '[]');
    } catch (e) { return []; }
  }
  function saveRecentEmoji(emoji) {
    if (!RK.user) return;
    let recent = getRecentEmojis();
    // Remove if already exists (to move to front)
    recent = recent.filter(e => e !== emoji);
    recent.unshift(emoji);
    if (recent.length > 20) recent = recent.slice(0, 20);
    try { localStorage.setItem(`rk_recent_emojis_${RK.user.id}`, JSON.stringify(recent)); } catch (e) {}
  }

  function ensureTwemoji(callback) {
    if (window.twemoji) { callback(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js';
    s.onload = callback;
    document.head.appendChild(s);
  }

  // ── Init ──────────────────────────────────────────────
  async function init() {
    if (!window.supabaseClient) { setTimeout(init, 300); return; }
    RK.sb = window.supabaseClient;

    const { data: { session } } = await RK.sb.auth.getSession();
    if (!session) return;
    RK.user = session.user;

    const { data: u } = await RK.sb.from("usuarios")
      .select("alias,foto_url,color_alias,fuente_alias")
      .eq("id", RK.user.id).single();

    if (u) {
      RK.userAlias = u.alias || "Usuario";
      RK.userAvatar = u.foto_url || null;
      RK.userColor = u.color_alias || "#ffffff";
      RK.userFont = u.fuente_alias || null;
    }

    try {
      const prefs = JSON.parse(localStorage.getItem(`rk_prefs_${RK.user.id}`) || "{}");
      if (prefs.fontSize) RK.fontSize = prefs.fontSize;
      if (prefs.chatBg) RK.chatBg = prefs.chatBg;
      if (prefs.autoScroll !== undefined) RK.autoScroll = prefs.autoScroll;
      if (prefs.uiScale) RK.uiScale = prefs.uiScale;
      if (prefs.myMsgBg) RK.myMsgBg = prefs.myMsgBg;
      if (prefs.otherMsgBg) RK.otherMsgBg = prefs.otherMsgBg;
      if (prefs.sidebarCollapsed !== undefined) RK.sidebarCollapsed = prefs.sidebarCollapsed;
      const saved = localStorage.getItem(`rk_stickers_${RK.user.id}`);
      RK.stickers = saved ? JSON.parse(saved) : [];
      const savedFav = localStorage.getItem(`rk_favstickers_${RK.user.id}`);
      RK.favStickers = savedFav ? JSON.parse(savedFav) : [];
    } catch (e) { }

    buildWindow();
    wireReikanalesBtn();
    await loadChannels();
    fetchGlobalStickers();
  }

  function savePrefs() {
    try {
      localStorage.setItem(`rk_prefs_${RK.user.id}`, JSON.stringify({
        fontSize: RK.fontSize, chatBg: RK.chatBg, autoScroll: RK.autoScroll, uiScale: RK.uiScale,
        myMsgBg: RK.myMsgBg, otherMsgBg: RK.otherMsgBg,
        sidebarCollapsed: RK.sidebarCollapsed,
      }));
    } catch (e) { }
  }

  // ── Botón sidebar ──────────────────────────────────────
  function wireReikanalesBtn() {
    document.querySelectorAll(".sidebar-item").forEach(btn => {
      if (btn.textContent.includes("Reikanales") && !btn.dataset.rkWired) {
        btn.dataset.rkWired = "1";
        btn.addEventListener("click", e => { e.stopPropagation(); toggleWindow(); });
      }
    });
  }

  // ── Canales ───────────────────────────────────────────
  async function loadChannels() {
    RK.channels = [];
    RK.channels.push({ id: "general", label: "# General", tipo: "general", ref_id: null, icon: "🌐" });

    const { data: memberships } = await RK.sb
      .from("proyecto_miembros")
      .select("proyecto_id, proyectos(id, nombre, icono_url)")
      .eq("user_id", RK.user.id);

    if (!memberships || !memberships.length) {
      finalizeChannelLoad();
      return;
    }

    const projectIds = memberships.map(m => m.proyecto_id).filter(Boolean);
    if (!projectIds.length) { finalizeChannelLoad(); return; }

    // Build the hierarchy in memory
    for (const m of memberships) {
      const p = m.proyectos;
      if (!p) continue;
      RK.channels.push({ id: `proyecto-${p.id}`, label: `📁 ${p.nombre}`, tipo: "proyecto", ref_id: p.id, icon: "📁", icono_url: p.icono_url });
    }

    finalizeChannelLoad();
  }

  function finalizeChannelLoad() {
    renderChannelList();
    if (!RK.activeChannel && RK.channels.length > 0) openChannel(RK.channels[0]);
    subscribeGlobalNotifications();
  }

  // ══════════════════════════════════════════════════════
  //  CONSTRUIR VENTANA
  // ══════════════════════════════════════════════════════
  function buildWindow() {
    if (document.getElementById("rkChatWindow")) return;

    const style = document.createElement("style");
    style.textContent = `
      @font-face{font-family:'RKMontserrat';src:url('fonts/Montserrat-Regular.woff2') format('woff2');font-weight:normal;}

      .rkw{position:fixed;display:flex;flex-direction:column;background:linear-gradient(180deg,#3a1a4a,#1e0e2e);border:1px solid rgba(255,255,255,0.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.6);z-index:99990;overflow:hidden;min-width:320px;min-height:280px;transition:width 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), height 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), border-radius 0.4s ease, background 0.4s ease, opacity 0.3s ease;}
      .rkw.hidden{display:none!important;}
      .rkw--opening{animation:rkwEntrance 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;}
      .rkw--closing{animation:rkwExit 0.3s ease-in forwards;}
      .rkw--minimized-entrance{animation:rkwBubblePop 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;}
      @keyframes rkwBubblePop{0%{opacity:0;transform:scale(0.3) rotate(-20deg);}60%{transform:scale(1.1) rotate(5deg);}100%{opacity:1;transform:scale(1) rotate(0);}}
      @keyframes rkwEntrance{0%{opacity:0;transform:scale(0.9) translateY(20px);}100%{opacity:1;transform:scale(1) translateY(0);}}
      @keyframes rkwExit{0%{opacity:1;transform:scale(1) translateY(0);}100%{opacity:0;transform:scale(0.9) translateY(20px);}}
      .rkw--fullscreen{width:100vw!important;height:100vh!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;border-radius:0!important;}
      .rkw--dragging{opacity:0.85;}
      .rkw--minimized{width:56px!important;height:56px!important;min-width:0!important;min-height:0!important;border-radius:50%!important;padding:0!important;justify-content:center;overflow:visible!important;}
      .rkw--minimized .rkw-body,.rkw--minimized .rkw-resize-handle,.rkw--minimized .rkw-tb-btns,.rkw--minimized .rkw-logo-text{display:none!important;}
      .rkw--minimized .rkw-titlebar{padding:0!important;width:100%;height:100%;justify-content:center;background:transparent!important;}
      .rkw--minimized .rkw-logo{gap:0!important;padding:0!important;margin:0!important;}
      .rkw--minimized .rkw-logo img{height:30px!important;transition:height 0.2s;}
      .rkw-titlebar{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(0,0,0,0.3);cursor:move;flex-shrink:0;user-select:none;gap:8px;}
      .rkw-logo{font-size:13px;font-family:'RKMontserrat','Gliker',sans-serif;color:white;flex-shrink:0;display:flex;align-items:center;gap:6px;}
      .rkw-tb-btns{display:flex;gap:4px;flex-shrink:0;}
      .rkw-tb-btn{background:rgba(255,255,255,0.1);border:none;border-radius:6px;color:white;width:24px;height:24px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
      .rkw-tb-btn:hover{background:rgba(255,255,255,0.2);}
      .rkw-body{display:flex;flex:1;overflow:hidden;min-height:0;}
      .rkw-sidebar{width:175px;min-width:140px;background:rgba(0,0,0,0.25);display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.07);overflow:hidden;flex-shrink:0;transition:width 0.3s ease, opacity 0.3s ease, border-right 0.3s ease;}
      .rkw-sidebar--collapsed{width:0!important;min-width:0!important;opacity:0!important;border-right:none!important;pointer-events:none;}
      .rkw-sidebar-title{padding:9px 10px 5px;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;flex-shrink:0;}
      .rkw-channel-list{flex:1;overflow-y:auto;padding:3px 5px 7px;display:flex;flex-direction:column;gap:1px;}
      .rkw-channel-list::-webkit-scrollbar{width:3px;}
      .rkw-channel-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px;}
      .rkw-channel-btn{background:transparent;border:none;border-radius:7px;color:rgba(255,255,255,0.65);font-family:'RKMontserrat','Etna',sans-serif;font-size:12px;padding:5px 7px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:5px;transition:background .15s,color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}
      .rkw-channel-btn:hover{background:rgba(255,255,255,0.07);color:white;}
      .rkw-channel-btn.active{background:rgba(219,111,78,0.3);color:white;}
      .rkw-ch-icon{width:16px;height:16px;border-radius:4px;object-fit:cover;flex-shrink:0;}
      .rkw-sidebar-toggle{background:rgba(255,255,255,0.07);border:none;border-radius:6px;color:white;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s, transform .3s;flex-shrink:0;font-size:10px;margin-right:2px;}
      .rkw-sidebar-toggle:hover{background:rgba(255,255,255,0.15);}
      .rkw-sidebar-toggle.collapsed{transform:rotate(180deg);}
      @media (max-width: 768px) { .rkw-sidebar-toggle { display:none!important; } }
      .rkw-chat{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;min-width:0;}
      .rkw-chat-header{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;}
      #rkwChatTitle{font-family:'RKMontserrat','Gliker',sans-serif;font-size:13px;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .rkw-header-btns{display:flex;gap:4px;flex-shrink:0;}
      .rkw-hdr-btn{background:rgba(255,255,255,0.09);border:none;border-radius:7px;color:rgba(255,255,255,0.7);font-size:11px;padding:3px 7px;cursor:pointer;font-family:'RKMontserrat','Etna',sans-serif;transition:background .15s,color .15s;white-space:nowrap;}
      .rkw-hdr-btn:hover{background:rgba(255,255,255,0.17);color:white;}
      .rkw-hdr-btn.active{background:rgba(219,111,78,0.4);color:white;}
      .rkw-chat-content-wrap{display:flex;flex:1;min-height:0;overflow:hidden;}
      .rkw-messages-wrap{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:0;}
      .rkw-members-panel{width:160px;background:rgba(20,5,30,0.6);border-left:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.2s;}
      .rkw-members-panel.hidden{display:none;}
      .rkw-mp-header{padding:8px 10px;font-size:10px;font-family:'RKMontserrat','Etna',sans-serif;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.05);text-transform:uppercase;letter-spacing:1px;background:rgba(0,0,0,0.2);}
      .rkw-mp-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:12px;}
      .rkw-mp-list::-webkit-scrollbar{width:4px;}
      .rkw-mp-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
      .rkw-mp-role-group{display:flex;flex-direction:column;gap:6px;}
      .rkw-mp-role-title{font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-family:'RKMontserrat',sans-serif;padding-left:4px;letter-spacing:0.5px;}
      .rkw-mp-user{display:flex;align-items:center;gap:8px;padding:4px;border-radius:6px;cursor:pointer;transition:background 0.2s;}
      .rkw-mp-user:hover{background:rgba(255,255,255,0.08);}
      .rkw-mp-user.offline .rkw-mp-alias, .rkw-mp-user.offline .rkw-mp-avatar-wrap{opacity:0.5;}
      .rkw-mp-avatar-wrap{position:relative;width:24px;height:24px;border-radius:50%;background:#3a1a4a;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;flex-shrink:0;}
      .rkw-mp-avatar-wrap img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
      .rkw-mp-status{position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#555;border:2px solid #20051e;}
      .rkw-mp-status.online{background:#43b581;}
      .rkw-mp-alias{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'RKMontserrat',sans-serif;}
      .rkw-messages{flex:1;overflow-y:auto;padding:10px 10px 8px;display:flex;flex-direction:column;gap:6px;background-size:cover;background-position:center;scroll-behavior:smooth;}
      .rkw-messages::-webkit-scrollbar{width:4px;}
      .rkw-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
      .rkw-scroll-btn{position:absolute;bottom:8px;right:10px;background:rgba(219,111,78,0.9);border:none;border-radius:50%;width:28px;height:28px;color:white;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.35);transition:opacity .2s,transform .2s;z-index:5;}
      .rkw-scroll-btn.hidden{opacity:0;pointer-events:none;transform:translateY(6px);}
      .rkw-reply-bar{background:rgba(255,255,255,0.06);border-left:3px solid #db6f4e;padding:5px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;}
      .rkw-reply-bar.hidden{display:none;}
      .rkw-reply-text{font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.65);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
      .rkw-reply-cancel{background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:14px;padding:0 4px;}
      .rkw-reply-cancel:hover{color:white;}
      .rkw-loading{color:rgba(255,255,255,0.35);font-family:'RKMontserrat','Etna',sans-serif;font-size:13px;text-align:center;padding:20px 0;margin:auto 0;}
      .rkw-loading-more{padding:10px 0;text-align:center;width:100%;}
      .rkw-date-sep{text-align:center;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.3);margin:4px 0;}
      .rkw-msg-row{display:flex;align-items:flex-end;gap:7px;position:relative;}
      .rkw-msg-row:not(.rkw-msg-row--me){align-self:flex-start;max-width:88%;}
      .rkw-msg-row--me{align-self:flex-end;flex-direction:row-reverse;max-width:88%;}
      .rkw-msg-avatar{width:30px;height:30px;border-radius:50%;background:#5a1f5a;color:white;font-size:11px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer;border:2px solid rgba(255,255,255,0.12);transition:border-color .2s,transform .15s;}
      .rkw-msg-avatar:hover{border-color:rgba(219,111,78,0.8);transform:scale(1.1);}
      .rkw-msg-avatar img{width:100%;height:100%;object-fit:cover;pointer-events:none;}
      .rkw-msg-bubble{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}
      .rkw-msg-row--me .rkw-msg-bubble{align-items:flex-end;}
      .rkw-msg-name{font-family:'RKMontserrat','Gliker',sans-serif;font-size:11px;padding:0 5px;cursor:pointer;transition:opacity .15s;}
      .rkw-msg-name:hover{opacity:0.7;}
      .rkw-msg-reply-quote{background:rgba(255,255,255,0.07);border-left:2px solid #db6f4e;border-radius:6px 6px 0 0;padding:4px 8px;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.5);max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;}
      .rkw-msg-reply-quote:hover{color:rgba(255,255,255,0.85);}
      .rkw-msg-text{border-radius:10px 10px 10px 3px;padding:7px 10px;line-height:1.45;word-break:break-word;position:relative;background:var(--rk-other-msg-bg, rgba(255,255,255,0.1));font-family:'RKMontserrat',sans-serif;font-size:var(--rk-font-size, 14px);}
      .rkw-mention{color:#db6f4e;font-weight:bold;}
      .rkw-mention-me{background:rgba(219,111,78,0.3);padding:0 4px;border-radius:4px;}
      .rkw-msg-row--me .rkw-msg-text{border-radius:10px 10px 3px 10px;background:var(--rk-my-msg-bg, rgba(219,111,78,0.42))!important;}
      .rkw-msg-text.is-sticker{background:transparent!important;padding:0!important;}
      .rkw-msg-sticker{width:100px;height:100px;object-fit:cover;border-radius:10px;display:block;}
      .rkw-msg-caption{margin-top:4px;font-family:'RKMontserrat',sans-serif;font-size:var(--rk-font-size, 14px);line-height:1.4;word-break:break-word;}
      .rkw-msg-time{font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;color:rgba(255,255,255,0.28);padding:0 5px;}
      /* Grouped messages: hide avatar/name/time on consecutive same-user */
      .rkw-msg-row--grouped .rkw-msg-avatar{visibility:hidden;}
      .rkw-msg-row--grouped .rkw-msg-name{display:none;}
      .rkw-msg-row--grouped .rkw-msg-time{display:none;}
      .rkw-msg-row--grouped{margin-top:-4px;}
      .rkw-msg-row--grouped .rkw-msg-text{border-radius:4px 10px 10px 4px;}
      .rkw-msg-row--grouped.rkw-msg-row--me .rkw-msg-text{border-radius:10px 4px 4px 10px;}
      /* Sidebar actions button — JS-controlled visibility with delay */
      .rkw-msg-side-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(40,15,55,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.7);font-size:14px;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;z-index:10;opacity:0;pointer-events:none;transition:opacity .2s,background .15s,color .15s;}
      .rkw-msg-side-btn.visible{opacity:1;pointer-events:auto;}
      .rkw-msg-side-btn:hover{background:rgba(60,25,75,0.95);color:white;}
      .rkw-msg-row:not(.rkw-msg-row--me) .rkw-msg-side-btn{right:-28px;}
      .rkw-msg-row--me .rkw-msg-side-btn{left:-28px;}
      /* Reaction button (+ a la derecha del ⋮, visibilidad vía JS como el ⋮) */
      .rkw-reaction-btn{position:absolute;top:50%;transform:translateY(-50%) scale(0.7);background:rgba(255,255,255,0.04);border:none;border-radius:4px;width:20px;height:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.25);font-size:12px;font-weight:bold;padding:0;line-height:1;z-index:9;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s,color .15s,background .15s;}
      .rkw-msg-row:not(.rkw-msg-row--me) .rkw-reaction-btn{right:-60px;}
      .rkw-msg-row--me .rkw-reaction-btn{right:auto;left:-60px;}
      .rkw-reaction-btn.visible{opacity:1;pointer-events:auto;transform:translateY(-50%) scale(1);}
      .rkw-reaction-btn:hover{background:rgba(219,111,78,0.25);color:white;}
      @keyframes reactionsBarIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      .rkw-reactions-bar{animation:reactionsBarIn .2s ease;}
      .rkw-reactions-bar.closing{overflow:hidden;max-height:0;opacity:0;transition:max-height .25s ease,opacity .2s ease;}
      /* Reaction picker animation */
      @keyframes pickerIn{from{opacity:0;transform:scale(0.85) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes pickerOut{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(0.85) translateY(8px)}}
      .rkw-reaction-picker{animation:pickerIn .15s ease;}
      .rkw-reaction-picker.closing{animation:pickerOut .12s ease forwards;}
      /* Message Animations */
      .rkw-msg-row.rkw-msg-new{animation:rkwMsgIn 0.3s ease-out forwards;}
      .rkw-msg-row.rkw-msg-new--sticker{animation:rkwStickerPop 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;}
      .rkw-msg-row.rkw-msg-pending{opacity:0.65;filter:grayscale(0.5);}
      .rkw-msg-row.rkw-msg-failed{opacity:1;filter:none;}
      .rkw-msg-row.rkw-msg-failed .rkw-msg-text{border:1px solid rgba(255,0,0,0.5);background:rgba(255,0,0,0.1)!important;}
      @keyframes rkwMsgIn{0%{opacity:0;transform:translateY(10px) scale(0.98);}100%{opacity:1;transform:translateY(0) scale(1);}}
      @keyframes rkwStickerPop{0%{opacity:0;transform:scale(0.5) translateY(20px);}70%{transform:scale(1.05);}100%{opacity:1;transform:scale(1) translateY(0);}}
      /* Dropdown from side button */
      .rkw-msg-side-dropdown{position:absolute;background:linear-gradient(160deg,#3a1a4a,#2a0f3a);border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.5);z-index:35;overflow:hidden;min-width:130px;animation:rkwSideDropIn .15s ease;}
      @keyframes rkwSideDropIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
      .rkw-msg-side-dropdown.hidden{display:none;}
      .rkw-msg-side-dropdown .rkw-msg-dot-item{display:flex;align-items:center;gap:8px;padding:9px 14px;background:none;border:none;color:rgba(255,255,255,0.85);font-family:'RKMontserrat','Etna',sans-serif;font-size:12px;cursor:pointer;width:100%;text-align:left;transition:background .15s;}
      .rkw-msg-side-dropdown .rkw-msg-dot-item:hover{background:rgba(255,255,255,0.08);color:white;}
      .rkw-msg-side-dropdown .rkw-msg-dot-item.danger{color:#e07070;}
      .rkw-msg-side-dropdown .rkw-msg-dot-item.danger:hover{background:rgba(180,50,50,0.25);color:#ff9090;}
      /* Image preview bar */
      .rkw-img-preview{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
      .rkw-img-preview.hidden{display:none;}
      .rkw-img-preview-thumb{width:48px;height:48px;border-radius:8px;object-fit:cover;border:2px solid rgba(219,111,78,0.5);}
      .rkw-img-preview-name{flex:1;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .rkw-img-preview-cancel{background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:16px;padding:0 4px;transition:color .2s;}
      .rkw-img-preview-cancel:hover{color:white;}
      .rkw-typing-wrap{display:flex;align-items:center;gap:4px;padding:4px 10px;min-height:24px;flex-shrink:0;}
      .rkw-typing-wrap.hidden{display:none;}
      .rkw-typing-avatar{width:20px;height:20px;border-radius:50%;background:#5a1f5a;color:white;font-size:9px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,0.2);}
      .rkw-typing-avatar img{width:100%;height:100%;object-fit:cover;}
      .rkw-typing-dots{display:flex;gap:3px;margin-left:4px;padding-top:4px;}
      .rkw-typing-dots span{width:5px;height:5px;background:rgba(255,255,255,0.5);border-radius:50%;animation:rkTypingBounce 1.4s infinite ease-in-out both;}
      .rkw-typing-dots span:nth-child(1){animation-delay:-0.32s;}
      .rkw-typing-dots span:nth-child(2){animation-delay:-0.16s;}
      @keyframes rkTypingBounce{0%,80%,100%{transform:scale(0);}40%{transform:scale(1);}}
      .rkw-input-bar{display:flex;align-items:center;gap:6px;padding:7px 9px;border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0;position:relative;}
      .rkw-input{flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:7px 10px;color:white;font-family:'RKMontserrat','Etna',sans-serif;outline:none;min-width:0;}
      .rkw-input::placeholder{color:rgba(255,255,255,0.3);}
      .rkw-send-btn{background:#db6f4e;border:none;border-radius:9px;color:white;width:32px;height:32px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;}
      .rkw-send-btn:hover{background:#c65f42;}
      .rkw-sticker-btn{background:rgba(255,255,255,0.1);border:none;border-radius:9px;color:white;width:32px;height:32px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;}
      .rkw-sticker-btn:hover{background:rgba(255,255,255,0.18);}
      .rkw-sticker-btn.active{background:rgba(219,111,78,0.4);}
      .rkw-resize-handle{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;}
      .rkw-resize-handle::after{content:'';position:absolute;bottom:4px;right:4px;width:7px;height:7px;border-right:2px solid rgba(255,255,255,0.22);border-bottom:2px solid rgba(255,255,255,0.22);border-radius:1px;}
      /* STICKER PANEL */
      .rkw-sticker-panel{position:absolute;bottom:50px;right:8px;width:270px;background:linear-gradient(160deg,#3a1a4a,#2a0f3a);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:20;overflow:hidden;display:flex;flex-direction:column;}
      .rkw-sticker-panel.hidden{display:none!important;}
      .rkw-sp-header{display:flex;align-items:center;justify-content:space-between;padding:9px 10px 7px;border-bottom:1px solid rgba(255,255,255,0.07);}
      .rkw-sp-title{font-family:'RKMontserrat','Gliker',sans-serif;font-size:13px;color:white;}
      .rkw-sp-upload-btn{background:#db6f4e;border:none;border-radius:7px;color:white;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;padding:4px 9px;cursor:pointer;}
      .rkw-sp-upload-btn:hover{background:#c65f42;}
      .rkw-sp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:8px;max-height:190px;overflow-y:auto;}
      .rkw-sp-empty{grid-column:1/-1;text-align:center;padding:16px 8px;font-family:'RKMontserrat','Etna',sans-serif;font-size:12px;color:rgba(255,255,255,0.3);}
      .rkw-sp-sticker{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color .15s,transform .15s;}
      .rkw-sp-sticker:hover{border-color:#db6f4e;transform:scale(1.06);}
      /* TABS STICKERS */
      .rkw-sp-tabs{display:flex;background:rgba(0,0,0,0.2);padding:2px;gap:2px;margin:5px 8px 0;border-radius:8px;}
      .rkw-sp-tab{flex:1;background:none;border:none;color:rgba(255,255,255,0.4);font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;padding:5px;cursor:pointer;border-radius:6px;transition:all .2s;text-transform:uppercase;letter-spacing:0.5px;}
      .rkw-sp-tab:hover{color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.05);}
      .rkw-sp-tab.active{background:#db6f4e;color:white;}
      .rkw-sp-upload-options{display:flex;align-items:center;gap:10px;padding:0 10px 8px;margin-top:-4px;}
      .rkw-sp-check-wrap{display:flex;align-items:center;gap:5px;cursor:pointer;font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;color:rgba(255,255,255,0.5);user-select:none;}
      .rkw-sp-check-wrap input{accent-color:#db6f4e;}
      /* Sticker favoritos — botón ⭐ en hover sobre sticker del chat */
      .rkw-sticker-wrap{position:relative;display:inline-block;}
      .rkw-sticker-fav-btn{position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.55);border:none;border-radius:6px;color:#fff;font-size:12px;width:22px;height:22px;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;line-height:1;transition:background .15s;}
      .rkw-sticker-wrap:hover .rkw-sticker-fav-btn{display:flex;}
      .rkw-sticker-fav-btn:hover{background:rgba(219,111,78,0.85);}
      .rkw-sticker-fav-btn.saved{color:#ffd700;}
      /* Secciones del panel de stickers */
      .rkw-sp-section-label{font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;padding:8px 8px 4px;}
      /* Items de favoritos: sticker + botón ✕ */
      .rkw-sp-fav-item{position:relative;aspect-ratio:1;}
      .rkw-sp-fav-item img{width:100%;height:100%;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color .15s,transform .15s;}
      .rkw-sp-fav-item img:hover{border-color:#db6f4e;transform:scale(1.06);}
      .rkw-sp-fav-remove{position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:16px;height:16px;color:white;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;transition:background .15s;}
      .rkw-sp-fav-remove:hover{background:#b03030;}
      /* CROP */
      .rkw-crop-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:99995;display:flex;align-items:center;justify-content:center;}
      .rkw-crop-overlay.hidden{display:none;}
      .rkw-crop-box{background:linear-gradient(180deg,#3a1a4a,#1e0e2e);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;align-items:center;max-width:380px;width:92%;}
      .rkw-crop-title{font-family:'RKMontserrat','Gliker',sans-serif;font-size:16px;color:white;margin:0;}
      .rkw-crop-canvas{border-radius:10px;display:block;max-width:100%;cursor:grab;}
      .rkw-crop-canvas:active{cursor:grabbing;}
      .rkw-crop-zoom{display:flex;align-items:center;gap:8px;width:100%;}
      .rkw-crop-zoom span{font-family:'RKMontserrat','Etna',sans-serif;font-size:12px;color:rgba(255,255,255,0.6);}
      .rkw-crop-zoom input{flex:1;accent-color:#db6f4e;}
      .rkw-crop-btns{display:flex;gap:8px;justify-content:flex-end;width:100%;}
      .rkw-crop-cancel{background:rgba(255,255,255,0.1);border:none;border-radius:9px;color:white;font-family:'RKMontserrat','Etna',sans-serif;font-size:13px;padding:8px 16px;cursor:pointer;}
      .rkw-crop-confirm{background:#db6f4e;border:none;border-radius:9px;color:white;font-family:'RKMontserrat','Gliker',sans-serif;font-size:13px;padding:8px 16px;cursor:pointer;}
      .rkw-crop-confirm:disabled{opacity:.5;cursor:not-allowed;}
      /* USER CARD */
      .rkw-user-card{position:fixed;z-index:100000;background:linear-gradient(160deg,#2e0e38,#4f1c51);border:1px solid rgba(255,255,255,0.12);border-radius:16px;width:230px;box-shadow:0 16px 50px rgba(0,0,0,0.65);overflow:hidden;animation:rkwCardIn .2s ease;display:flex;flex-direction:column;max-height:calc(100vh - 24px);overflow-y:auto;}
      @keyframes rkwCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .rkw-user-card::-webkit-scrollbar{width:4px;}
      .rkw-user-card::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
      .rkw-uc-banner{width:100%;height:65px;background:#4f1c51;background-size:cover;background-position:center;flex-shrink:0;}
      .rkw-uc-avatar-row{display:flex;justify-content:center;margin-top:-25px;margin-bottom:5px;position:relative;z-index:2;}
      .rkw-uc-avatar{width:50px;height:50px;border-radius:50%;border:3px solid #2e0e38;object-fit:cover;background:#5a1f5a;}
      .rkw-uc-alias{text-align:center;font-family:'RKMontserrat','Gliker',sans-serif;font-size:14px;color:white;padding:0 12px 5px;}
      .rkw-uc-section-label{font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;padding:5px 12px 3px;}
      .rkw-uc-roles{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 6px;}
      .rkw-uc-role{background:rgba(219,111,78,0.7);color:white;font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;padding:3px 7px 3px 5px;border-radius:6px;display:flex;align-items:center;gap:4px;}
      .rkw-uc-role.principal{background:rgba(219,111,78,1);}
      .rkw-uc-role img{width:14px;height:14px;object-fit:contain;flex-shrink:0;}
      .rkw-uc-noroles{font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.3);padding:0 12px 6px;margin:0;}
      .rkw-uc-disp-box{display:flex;flex-direction:column;gap:3px;padding:0 12px 9px;}
      .rkw-uc-disp-row{display:flex;justify-content:space-between;font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;}
      .rkw-uc-disp-day{font-weight:bold;color:#db6f4e;min-width:22px;}
      .rkw-uc-disp-time{color:rgba(255,255,255,0.65);}
      .rkw-uc-disp-empty{font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;color:rgba(255,255,255,0.3);padding:0 12px 9px;margin:0;}
      /* SETTINGS PANEL */
      .rkw-settings-panel{position:absolute;bottom:50px;right:8px;width:230px;background:linear-gradient(160deg,#3a1a4a,#2a0f3a);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:20;padding:12px;display:flex;flex-direction:column;gap:10px;}
      .rkw-settings-panel.hidden{display:none!important;}
      .rkw-setting-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
      .rkw-setting-label{font-family:'RKMontserrat','Etna',sans-serif;font-size:12px;color:rgba(255,255,255,0.7);flex-shrink:0;}
      .rkw-setting-color{background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;width:30px;height:20px;cursor:pointer;padding:0;}
      .rkw-btn-reset{background:none;border:none;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;padding:0 4px;transition:color .2s;}
      .rkw-btn-reset:hover{color:white;}
      .rkw-setting-range{flex:1;accent-color:#db6f4e;}
      .rkw-setting-toggle{width:34px;height:18px;border-radius:9px;cursor:pointer;border:none;transition:background .2s;flex-shrink:0;}
      .rkw-setting-toggle.on{background:#db6f4e;}
      .rkw-setting-toggle.off{background:rgba(255,255,255,0.2);}
      .rkw-bg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;}
      .rkw-bg-swatch{width:100%;aspect-ratio:16/9;border-radius:6px;border:2px solid transparent;cursor:pointer;background-size:cover;background-position:center;background-color:rgba(255,255,255,0.08);transition:border-color .15s,transform .15s;}
      .rkw-bg-swatch:hover,.rkw-bg-swatch.active{border-color:#db6f4e;transform:scale(1.04);}
      .rkw-bg-upload-btn{grid-column:1/-1;background:rgba(255,255,255,0.08);border:1px dashed rgba(255,255,255,0.2);border-radius:6px;color:rgba(255,255,255,0.6);font-family:'RKMontserrat','Etna',sans-serif;font-size:11px;padding:6px;cursor:pointer;transition:background .15s;}
      .rkw-bg-upload-btn:hover{background:rgba(255,255,255,0.13);}
      .rkw-sticker-wrap{position:relative;display:inline-block;}
      .rkw-fav-btn{position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);border:none;border-radius:6px;color:white;font-size:14px;width:26px;height:26px;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;line-height:1;transition:background .15s,transform .15s;}
      .rkw-sticker-wrap:hover .rkw-fav-btn{display:flex;}
      .rkw-fav-btn:hover{background:rgba(219,111,78,0.85);transform:scale(1.1);}
      .rkw-sp-section-label{font-family:'RKMontserrat','Etna',sans-serif;font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;padding:7px 8px 3px;}
      .rkw-fav-item{position:relative;display:inline-block;}
      .rkw-fav-remove{position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;border-radius:4px;color:white;font-size:11px;width:18px;height:18px;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;line-height:1;}
      .rkw-fav-item:hover .rkw-fav-remove{display:flex;}
      /* IMAGE BTN */
      .rkw-img-btn{background:rgba(255,255,255,0.1);border:none;border-radius:9px;color:white;width:32px;height:32px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;}
      .rkw-img-btn:hover{background:rgba(255,255,255,0.18);}
      /* CHAT IMAGE */
      .rkw-msg-img{max-width:220px;max-height:200px;border-radius:10px;display:block;cursor:zoom-in;transition:opacity .15s,transform .15s;object-fit:cover;margin-top:2px;}
      .rkw-msg-img:hover{opacity:0.92;transform:scale(1.02);}
      /* LIGHTBOX */
      .rkw-lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;animation:rkwLbIn .18s ease;}
      .rkw-lightbox.hidden{display:none;}
      @keyframes rkwLbIn{from{opacity:0}to{opacity:1}}
      .rkw-lightbox-img{max-width:90vw;max-height:88vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.7);object-fit:contain;animation:rkwLbImgIn .2s ease;}
      @keyframes rkwLbImgIn{from{transform:scale(0.93)}to{transform:scale(1)}}
      .rkw-lightbox-close{position:absolute;top:16px;right:20px;background:rgba(255,255,255,0.12);border:none;border-radius:50%;color:white;font-size:20px;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;}
      .rkw-lightbox-close:hover{background:rgba(255,255,255,0.22);}
      .rkw-lightbox-dl{position:absolute;bottom:20px;right:20px;background:#db6f4e;border:none;border-radius:10px;color:white;font-size:13px;padding:8px 16px;cursor:pointer;font-family:'RKMontserrat',sans-serif;transition:background .2s;}
      .rkw-lightbox-dl:hover{background:#c65f42;}
      /* EDIT INLINE */
      .rkw-msg-edit-wrap{display:flex;flex-direction:column;gap:6px;width:100%;}
      .rkw-msg-edit-input{background:rgba(255,255,255,0.1);border:1px solid rgba(219,111,78,0.6);border-radius:8px;padding:6px 10px;color:white;font-family:'RKMontserrat',sans-serif;font-size:var(--rk-font-size,14px);outline:none;resize:none;width:100%;box-sizing:border-box;line-height:1.45;}
      .rkw-msg-edit-btns{display:flex;gap:6px;justify-content:flex-end;}
      .rkw-msg-edit-cancel{background:rgba(255,255,255,0.1);border:none;border-radius:7px;color:white;font-size:11px;padding:4px 10px;cursor:pointer;font-family:'RKMontserrat',sans-serif;}
      .rkw-msg-edit-save{background:#db6f4e;border:none;border-radius:7px;color:white;font-size:11px;padding:4px 10px;cursor:pointer;font-family:'RKMontserrat','Gliker',sans-serif;}
      .rkw-msg-edited-tag{font-size:10px;color:rgba(255,255,255,0.3);font-family:'RKMontserrat',sans-serif;padding:0 2px;}
            @media(max-width:900px){
        .rkw{min-width:280px;}
        .rkw-sidebar{width:140px;min-width:110px;}
      }
      @media(max-width:600px){
        .rkw{width:100% !important;height:100dvh !important;left:0!important;right:0!important;bottom:0!important;min-width:unset;border-radius:0;}
        
        /* Forzar chat vertical y botones de canales en lista horizontal superior */
        .rkw-body { flex-direction: column !important; }
        .rkw-sidebar {
          width: 100% !important;
          min-width: unset !important;
          height: auto !important;
          border-right: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          flex-shrink: 0 !important;
        }
        .rkw-sidebar-title { padding: 8px 12px 4px !important; font-size: 10px !important; }
        .rkw-channel-list {
          flex-direction: row !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding: 4px 8px 8px !important;
          gap: 6px !important;
          scrollbar-width: none;
        }
        .rkw-channel-list::-webkit-scrollbar { display: none !important; }
        .rkw-channel-btn {
          width: auto !important;
          max-width: 160px !important;
          flex-shrink: 0 !important;
          padding: 8px 14px !important;
          border-radius: 20px !important;
          font-size: 13px !important;
          min-height: 40px !important;
        }
        
        /* User card bottom sheet on mobile */
        .rkw-user-card {
          position: fixed !important;
          top: auto !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          max-height: 80vh !important;
          border-radius: 20px 20px 0 0 !important;
          animation: rkwCardSlideUp 0.3s ease !important;
          border: none !important;
        }
      }
      @keyframes rkwCardSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    `;
    document.head.appendChild(style);

    const win = document.createElement("div");
    win.id = "rkChatWindow";
    win.className = "rkw hidden";
    win.innerHTML = `
      <div class="rkw-titlebar" id="rkwTitlebar">
        <span class="rkw-logo"><img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774918492/welabxj2xcigwwfevaff.png" style="height:18px;"> <span class="rkw-logo-text">Reikanales</span></span>
        <div class="rkw-tb-btns">
          <button class="rkw-tb-btn" id="rkwExpandBtn" title="Expandir">⛶</button>
          <button class="rkw-tb-btn" id="rkwMinBtn" title="Minimizar">─</button>
          <button class="rkw-tb-btn" id="rkwCloseBtn" title="Cerrar">✕</button>
        </div>
      </div>
      <div class="rkw-body">
        <div class="rkw-sidebar">
          <div class="rkw-sidebar-title">Canales</div>
          <div class="rkw-channel-list" id="rkwChannelList"></div>
        </div>
        <div class="rkw-chat">
          <div class="rkw-chat-header">
            <div style="display:flex;align-items:center;">
              <button class="rkw-sidebar-toggle" id="rkSidebarToggle" title="Colapsar sidebar">◀</button>
              <span id="rkwChatTitle"># General</span>
            </div>
            <div class="rkw-header-btns">
              <button class="rkw-hdr-btn rkw-hdr-btn--icon" id="rkwMembersBtn" title="Ver miembros"><img src="https://res.cloudinary.com/dyy6zbkop/image/upload/v1774889745/gpudg05wkqjwa8nemnnt.png" style="width:16px;height:16px;object-fit:contain;filter:brightness(0) invert(1);vertical-align:middle;"></button>
              <button class="rkw-hdr-btn active" id="rkwAutoScrollToggle" title="Scroll automático">↓Auto</button>
              <button class="rkw-hdr-btn" id="rkwSettingsBtn" title="Ajustes">⚙</button>
            </div>
          </div>
          <div class="rkw-chat-content-wrap">
            <div class="rkw-messages-wrap">
              <div class="rkw-messages" id="rkwMessages"></div>
              <div class="rkw-typing-wrap hidden" id="rkwTypingWrap"></div>
              <button class="rkw-scroll-btn hidden" id="rkwScrollBtn" title="Ir al final">↓</button>
            </div>
            <div class="rkw-members-panel hidden" id="rkwMembersPanel">
              <div class="rkw-mp-header">Miembros</div>
              <div class="rkw-mp-list" id="rkwMembersList"></div>
            </div>
          </div>
          <div class="rkw-reply-bar hidden" id="rkwReplyBar">
            <span class="rkw-reply-text" id="rkwReplyText">Respondiendo...</span>
            <button class="rkw-reply-cancel" id="rkwReplyCancel">✕</button>
          </div>
          <div class="rkw-img-preview hidden" id="rkwImgPreview">
            <img class="rkw-img-preview-thumb" id="rkwImgPreviewThumb" src="" alt="">
            <span class="rkw-img-preview-name" id="rkwImgPreviewName">imagen.png</span>
            <button class="rkw-img-preview-cancel" id="rkwImgPreviewCancel" title="Quitar imagen">✕</button>
          </div>
          <div class="rkw-input-bar">
            <input class="rkw-input" id="rkwInput" placeholder="Escribe un mensaje..." maxlength="2000" autocomplete="off">
            <button class="rkw-img-btn" id="rkwImgBtn" title="Enviar imagen">🖼</button><button class="rkw-sticker-btn" id="rkwStickerBtn" title="Stickers">🎞</button>
            <button class="rkw-send-btn" id="rkwSendBtn" title="Enviar">➤</button>
            <div class="rkw-sticker-panel hidden" id="rkwStickerPanel">
              <div class="rkw-sp-header">
                <span class="rkw-sp-title" id="rkwStickerPanelTitle">Mis Stickers</span>
                <button class="rkw-sp-upload-btn" id="rkwStickerUploadBtn">+ Subir</button>
              </div>
              <div class="rkw-sp-upload-options">
                <label class="rkw-sp-check-wrap" title="Subir sticker para que todos puedan usarlo"><input type="checkbox" id="rkwStickerGlobalCheck"> 🌍 Compartir</label>
              </div>
              <div class="rkw-sp-tabs">
                <button class="rkw-sp-tab active" data-tab="mis">Mis</button>
                <button class="rkw-sp-tab" data-tab="fav">Favoritos</button>
                <button class="rkw-sp-tab" data-tab="global">Predeterminados</button>
              </div>
              <div class="rkw-sp-grid" id="rkwStickerGrid"></div>
            </div>
            <div class="rkw-settings-panel hidden" id="rkwSettingsPanel">
              <div class="rkw-setting-row">
                <span class="rkw-setting-label">Fuente</span>
                <input type="range" class="rkw-setting-range" id="rkwFontSizeSlider" min="11" max="20" step="1">
                <span class="rkw-setting-label" id="rkwFontSizeVal">14px</span>
              </div>
              <div class="rkw-setting-row">
                <span class="rkw-setting-label">Tamaño UI</span>
                <input type="range" class="rkw-setting-range" id="rkwUIScaleSlider" min="70" max="150" step="5">
                <span class="rkw-setting-label" id="rkwUIScaleVal">100%</span>
              </div>
              <div class="rkw-setting-row">
                <span class="rkw-setting-label">Mis mensajes</span>
                <input type="color" class="rkw-setting-color" id="rkwMyColorPicker">
                <button class="rkw-btn-reset" id="rkwMyColorReset" title="Restablecer">↺</button>
              </div>
              <div class="rkw-setting-row">
                <span class="rkw-setting-label">Otros mensajes</span>
                <input type="color" class="rkw-setting-color" id="rkwOtherColorPicker">
                <button class="rkw-btn-reset" id="rkwOtherColorReset" title="Restablecer">↺</button>
              </div>
              <div class="rkw-setting-row">
                <span class="rkw-setting-label">Fondo del chat</span>
                <button class="rkw-btn-reset" id="rkwBgReset" title="Quitar fondo">↺</button>
              </div>
              <div class="rkw-bg-grid" id="rkwBgGrid">
                <button class="rkw-bg-upload-btn" id="rkwBgUploadBtn">+ Subir fondo</button>
              </div>
            </div>
            <input type="file" id="rkwStickerFileInput" accept="image/*" hidden>
            <input type="file" id="rkwImgFileInput" accept="image/*" hidden>
            <input type="file" id="rkwBgFileInput" accept="image/*" hidden>
          </div>
        </div>
      </div>
      <div class="rkw-resize-handle" id="rkwResize"></div>
    `;
    document.body.appendChild(win);

    const cropEl = document.createElement("div");
    cropEl.id = "rkwCropOverlay";
    cropEl.className = "rkw-crop-overlay hidden";
    cropEl.innerHTML = `
      <div class="rkw-crop-box">
        <p class="rkw-crop-title">Recortar sticker</p>
        <canvas class="rkw-crop-canvas" id="rkwCropCanvas" width="300" height="300"></canvas>
        <div class="rkw-crop-zoom"><span>Zoom</span><input type="range" id="rkwCropZoom" min="0" max="100" value="0"></div>
        <div class="rkw-crop-btns">
          <button class="rkw-crop-cancel" id="rkwCropCancel">Cancelar</button>
          <button class="rkw-crop-confirm" id="rkwCropConfirm">¡HECHO!</button>
        </div>
      </div>`;
    document.body.appendChild(cropEl);

    // Lightbox para imágenes del chat
    const lbEl = document.createElement('div');
    lbEl.id = 'rkwLightbox';
    lbEl.className = 'rkw-lightbox hidden';
    lbEl.innerHTML = `
      <button class="rkw-lightbox-close" id="rkwLbClose">✕</button>
      <img class="rkw-lightbox-img" id="rkwLbImg" src="" alt="">
      <button class="rkw-lightbox-dl" id="rkwLbDl">⬇ Descargar</button>
    `;
    document.body.appendChild(lbEl);
    lbEl.addEventListener('click', e => { if (e.target === lbEl) closeLightbox(); });
    document.getElementById('rkwLbClose').addEventListener('click', closeLightbox);
    document.getElementById('rkwLbDl').addEventListener('click', () => {
      const url = document.getElementById('rkwLbImg').src;
      const a = document.createElement('a'); a.href = url; a.download = 'imagen_reikanales.jpg'; a.target = '_blank'; a.click();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

    win.style.right = "20px";
    win.style.bottom = "20px";
    win.style.width = "640px";
    win.style.height = "460px";

    // Set slider initial values
    const slider = document.getElementById("rkwFontSizeSlider");
    const valLbl = document.getElementById("rkwFontSizeVal");
    if (slider) { slider.value = RK.fontSize; valLbl.textContent = RK.fontSize + "px"; }
    const scaleSliderInit = document.getElementById("rkwUIScaleSlider");
    const scaleValInit = document.getElementById("rkwUIScaleVal");
    if (scaleSliderInit) { scaleSliderInit.value = Math.round(RK.uiScale * 100); scaleValInit.textContent = Math.round(RK.uiScale * 100) + "%"; }

    applyFontSize();
    applyChatBg();
    applyUIScale();
    applyMessageColors();
    applyAutoScrollUI();
    wireDrag(win);
    wireResize(win);
    wireControls(win);
    wireStickerPanel();
    wireCropOverlay();
    wireSettingsPanel();
    wireScrollBtn();
    wireMembersPanel();
    wireImgBtn();
  }

  // ── Toggle ─────────────────────────────────────────────
  function toggleWindow() {
    const win = document.getElementById("rkChatWindow");
    if (!win) return;
    
    if (!RK.windowOpen) {
      // Opening
      RK.windowOpen = true;
      window.ANIM.show(win, 'anim-slide-up');
      win.classList.remove("rkw--closing");
      
      const isMin = win.classList.contains("rkw--minimized");
      if (isMin) {
        win.classList.add("rkw--minimized-entrance");
        win.addEventListener("animationend", () => win.classList.remove("rkw--minimized-entrance"), { once: true });
      } else {
        win.classList.add("rkw--opening");
      }
      
      if (RK.autoScroll) scrollToBottom();
      clearNotification();
      
      const a = new Audio("sounds/open.mp3");
      a.volume = 0.3;
      a.play().catch(() => {});
    } else {
      // Closing
      RK.windowOpen = false;
      win.classList.remove("rkw--opening");
      win.classList.add("rkw--closing");
      
      const a = new Audio("sounds/close.mp3");
      a.volume = 0.3;
      a.play().catch(() => {});
      
      win.addEventListener("animationend", () => {
        if (!RK.windowOpen) {
          window.ANIM.hide(win, 'anim-slide-down-out');
          win.classList.remove("rkw--closing");
        }
      }, { once: true });
    }
  }

  // ── Controls ──────────────────────────────────────────
  function wireControls(win) {
    // Sidebar Toggle
    const sideToggle = document.getElementById("rkSidebarToggle");
    const sidebarEl = win.querySelector(".rkw-sidebar");
    const applySidebarState = () => {
      if (RK.sidebarCollapsed) {
        sidebarEl.classList.add("rkw-sidebar--collapsed");
        sideToggle.classList.add("collapsed");
        sideToggle.textContent = "▶";
      } else {
        sidebarEl.classList.remove("rkw-sidebar--collapsed");
        sideToggle.classList.remove("collapsed");
        sideToggle.textContent = "◀";
      }
    };
    applySidebarState();
    sideToggle?.addEventListener("click", () => {
      RK.sidebarCollapsed = !RK.sidebarCollapsed;
      applySidebarState();
      savePrefs();
    });

    document.getElementById("rkwCloseBtn").addEventListener("click", e => {
      e.stopPropagation();
      if (RK.windowOpen) toggleWindow();
      closeStickerPanel(); closeSettingsPanel(); closeMembersPanel();
    });
    document.getElementById("rkwMinBtn").addEventListener("click", e => {
      e.stopPropagation();
      win.classList.toggle("rkw--minimized");
      closeStickerPanel(); closeSettingsPanel(); closeMembersPanel();
      // Play closing sound at 30% volume
      const a = new Audio("sounds/close.mp3");
      a.volume = 0.3;
      a.play().catch(() => {});
    });
    document.getElementById("rkwExpandBtn").addEventListener("click", e => {
      e.stopPropagation();
      if (win.classList.contains("rkw--fullscreen")) {
        win.classList.remove("rkw--fullscreen");
        win.style.width = "640px"; win.style.height = "460px";
        win.style.left = "auto"; win.style.top = "auto";
        win.style.right = "20px"; win.style.bottom = "20px";
      } else {
        win.classList.add("rkw--fullscreen");
      }
    });
    document.getElementById("rkwSendBtn").addEventListener("click", sendMessage);
    document.getElementById("rkwInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      if (e.key === "Escape") clearReply();
    });
    document.getElementById("rkwInput").addEventListener("input", e => {
      const text = e.target.value;
      if (text.length > 0 && RK.activeChannel && RK.realtimeSub) {
        if (!RK.typingTimeout) {
          RK.realtimeSub.send({ type: 'broadcast', event: 'typing', payload: { uid: RK.user.id, alias: RK.userAlias, avatar: RK.userAvatar } });
          RK.typingTimeout = setTimeout(() => { RK.typingTimeout = null; }, 2000);
        }
      } else if (text.length === 0 && RK.typingTimeout) {
        clearTimeout(RK.typingTimeout);
        RK.typingTimeout = null;
      }
    });
    document.getElementById("rkwAutoScrollToggle").addEventListener("click", () => {
      RK.autoScroll = !RK.autoScroll;
      applyAutoScrollUI(); savePrefs();
    });
    document.getElementById("rkwReplyCancel").addEventListener("click", clearReply);
  }

  // ── Drag ──────────────────────────────────────────────
  function wireDrag(win) {
    const tb = document.getElementById("rkwTitlebar");
    let dragging = false, moved = false, ox = 0, oy = 0, sx = 0, sy = 0;
    let dragRAF = null;
    tb.addEventListener("mousedown", e => {
      moved = false; // Reset on every mousedown
      if (win.classList.contains("rkw--fullscreen")) return; // Prevenir arrastre si está en pantalla completa
      
      const isMinimized = win.classList.contains("rkw--minimized");
      if (isMinimized && e.button !== 2) return; // Solo arrastrar burbuja con click derecho
      if (!isMinimized && e.button !== 0) return; // Solo arrastrar ventana normal con click izquierdo

      if (e.target.closest(".rkw-tb-btn") || e.target.classList.contains("rkw-tb-btn")) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = win.getBoundingClientRect();
      win.style.left = r.left + "px"; win.style.top = r.top + "px";
      win.style.right = "auto"; win.style.bottom = "auto";
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      document.body.style.userSelect = "none";
      win.classList.add("rkw--dragging");
    });
    tb.addEventListener("contextmenu", e => {
      if (win.classList.contains("rkw--minimized")) e.preventDefault();
    });
    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) moved = true;
      if (dragRAF) cancelAnimationFrame(dragRAF);
      dragRAF = requestAnimationFrame(() => {
        win.style.left = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - win.offsetWidth)) + "px";
        win.style.top = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - win.offsetHeight)) + "px";
      });
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false; document.body.style.userSelect = "";
      win.classList.remove("rkw--dragging");
      if (dragRAF) cancelAnimationFrame(dragRAF);
    });
    tb.addEventListener("click", () => {
      if (!moved && win.classList.contains("rkw--minimized")) {
        win.classList.remove("rkw--minimized");
        // Play opening sound at 30% volume
        const a = new Audio("sounds/open.mp3");
        a.volume = 0.3;
        a.play().catch(() => {});
        // Re-bound window to screen in case it was dragged near the right/bottom edge while small
        setTimeout(() => {
          const w = win.offsetWidth, h = win.offsetHeight, iw = window.innerWidth, ih = window.innerHeight;
          let nl = parseInt(win.style.left) || 0;
          let nt = parseInt(win.style.top) || 0;
          if (nl + w > iw) win.style.left = Math.max(0, iw - w) + "px";
          if (nt + h > ih) win.style.top = Math.max(0, ih - h) + "px";
        }, 10);
      }
    });
  }

  // ── Resize ────────────────────────────────────────────
  function wireResize(win) {
    const handle = document.getElementById("rkwResize");
    let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
    let resizeRAF = null;
    handle.addEventListener("mousedown", e => {
      resizing = true; sx = e.clientX; sy = e.clientY;
      sw = win.offsetWidth; sh = win.offsetHeight;
      e.preventDefault(); document.body.style.userSelect = "none";
      win.classList.add("rkw--dragging");
    });
    document.addEventListener("mousemove", e => {
      if (!resizing) return;
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(() => {
        win.style.width = Math.max(320, sw + (e.clientX - sx)) + "px";
        win.style.height = Math.max(280, sh + (e.clientY - sy)) + "px";
      });
    });
    document.addEventListener("mouseup", () => { 
      if (!resizing) return;
      resizing = false; document.body.style.userSelect = ""; 
      win.classList.remove("rkw--dragging");
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
    });
  }

  // ── Lightbox de imágenes ──────────────────────────────
  function openLightbox(url) {
    const lb = document.getElementById('rkwLightbox');
    const img = document.getElementById('rkwLbImg');
    if (!lb || !img) return;
    img.src = url;
    lb.classList.remove('hidden');
  }
  function closeLightbox() {
    const lb = document.getElementById('rkwLightbox');
    if (lb) lb.classList.add('hidden');
  }

  // ── Botón imagen en input ──────────────────────────────
  function wireImgBtn() {
    const btn = document.getElementById('rkwImgBtn');
    const input = document.getElementById('rkwImgFileInput');
    if (!btn || !input) return;
    btn.addEventListener('click', e => { e.stopPropagation(); input.click(); closeStickerPanel(); closeSettingsPanel(); });
    input.addEventListener('change', function() {
      const file = this.files[0]; if (!file) return; this.value = '';
      // Stage the image in the preview bar
      const previewUrl = URL.createObjectURL(file);
      RK.pendingImage = { file, previewUrl };
      const bar = document.getElementById('rkwImgPreview');
      const thumb = document.getElementById('rkwImgPreviewThumb');
      const name = document.getElementById('rkwImgPreviewName');
      bar.classList.remove('hidden');
      thumb.src = previewUrl;
      name.textContent = file.name;
      document.getElementById('rkwInput').placeholder = 'Escribe un texto para la imagen (opcional)...';
      document.getElementById('rkwInput').focus();
    });
    document.getElementById('rkwImgPreviewCancel').addEventListener('click', clearPendingImage);
  }

  function clearPendingImage() {
    if (RK.pendingImage?.previewUrl) URL.revokeObjectURL(RK.pendingImage.previewUrl);
    RK.pendingImage = null;
    document.getElementById('rkwImgPreview')?.classList.add('hidden');
    document.getElementById('rkwInput').placeholder = 'Escribe un mensaje...';
  }

  // ── Scroll button ─────────────────────────────────────
  function wireScrollBtn() {
    const btn = document.getElementById("rkwScrollBtn");
    const msgs = document.getElementById("rkwMessages");
    btn.addEventListener("click", scrollToBottom);
    msgs.addEventListener("scroll", updateScrollBtn);
    msgs.addEventListener("scroll", async () => {
      if (msgs.scrollTop < 20 && !RK.loadingMore && RK.canLoadMore[RK.activeChannel?.id]) {
        await loadMoreMessages();
      }
    });
  }

  function updateScrollBtn() {
    const msgs = document.getElementById("rkwMessages");
    const btn = document.getElementById("rkwScrollBtn");
    if (!msgs || !btn) return;
    const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
    btn.classList.toggle("hidden", atBottom);
  }

  function applyAutoScrollUI() {
    const btn = document.getElementById("rkwAutoScrollToggle");
    if (!btn) return;
    btn.textContent = RK.autoScroll ? "↓Auto" : "↓Manual";
    btn.classList.toggle("active", RK.autoScroll);
  }

  // ── Members Panel ─────────────────────────────────────
  function wireMembersPanel() {
    const btn = document.getElementById("rkwMembersBtn");
    const panel = document.getElementById("rkwMembersPanel");
    if (!btn || !panel) return;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleMembersPanel();
      closeSettingsPanel();
      closeStickerPanel();
    });
  }

  function toggleMembersPanel() {
    const panel = document.getElementById("rkwMembersPanel");
    const btn = document.getElementById("rkwMembersBtn");
    if (!panel) return;
    RK.membersPanelOpen = !RK.membersPanelOpen;
    panel.classList.toggle("hidden", !RK.membersPanelOpen);
    if (btn) btn.classList.toggle("active", RK.membersPanelOpen);
    if (RK.membersPanelOpen) loadAndRenderMembers();
  }

  function closeMembersPanel() {
    const panel = document.getElementById("rkwMembersPanel");
    const btn = document.getElementById("rkwMembersBtn");
    if (!panel) return;
    RK.membersPanelOpen = false;
    window.ANIM.hide(panel, 'anim-fade-out');
    if (btn) btn.classList.remove("active");
  }

  async function loadAndRenderMembers() {
    const list = document.getElementById("rkwMembersList");
    if (!list) return;
    list.innerHTML = `<p class="rkw-loading">Cargando...</p>`;
    const ch = RK.activeChannel;
    if (!ch) return;
    
    let usersData = [];
    if (ch.tipo === "general") {
      const { data } = await RK.sb.from("usuarios").select("id, alias, foto_url, color_alias, usuario_roles (tipo, roles(nombre, icon_url))");
      usersData = data || [];
    } else {
      const projectId = ch.tipo === "proyecto" ? ch.ref_id : (ch.parentId ? ch.parentId.replace("proyecto-", "") : null);
      if (projectId) {
        const { data: members } = await RK.sb.from("proyecto_miembros").select("user_id").eq("proyecto_id", projectId);
        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id);
          const { data } = await RK.sb.from("usuarios").select("id, alias, foto_url, color_alias, usuario_roles (tipo, roles(nombre, icon_url))").in("id", userIds);
          usersData = data || [];
        }
      }
    }

    const grouped = {};
    usersData.forEach(u => {
      let mainRoleName = "Sin Rol";
      const uRoles = u.usuario_roles || [];
      const primary = uRoles.find(r => r.tipo === "principal");
      if (primary && primary.roles && primary.roles.nombre) mainRoleName = primary.roles.nombre;
      if (!grouped[mainRoleName]) grouped[mainRoleName] = [];
      grouped[mainRoleName].push(u);
    });

    list.innerHTML = "";
    if (Object.keys(grouped).length === 0) {
      list.innerHTML = `<p class="rkw-loading">No hay miembros</p>`;
      return;
    }

    const sortedRoles = Object.keys(grouped).sort((a, b) => {
      if (a === "Sin Rol") return 1;
      if (b === "Sin Rol") return -1;
      return a.localeCompare(b);
    });

    sortedRoles.forEach(role => {
      const groupEl = document.createElement("div");
      groupEl.className = "rkw-mp-role-group";
      const usersInRole = grouped[role];
      const onlineCount = usersInRole.filter(u => RK.onlineUsers.has(u.id)).length;
      
      groupEl.innerHTML = `<div class="rkw-mp-role-title">${role} — ${onlineCount}/${usersInRole.length}</div>`;
      
      usersInRole.sort((a, b) => {
        const aOn = RK.onlineUsers.has(a.id);
        const bOn = RK.onlineUsers.has(b.id);
        if (aOn && !bOn) return -1;
        if (!aOn && bOn) return 1;
        return (a.alias || "").localeCompare(b.alias || "");
      });

      usersInRole.forEach(u => {
        const isOnline = RK.onlineUsers.has(u.id);
        const color = u.color_alias || "#fff";
        const alias = u.alias || "Usuario";
        const avatarStr = u.foto_url ? `<img src="${u.foto_url}" alt="">` : (alias[0] || "?").toUpperCase();
        
        const uEl = document.createElement("div");
        uEl.className = `rkw-mp-user ${isOnline ? "online" : "offline"}`;
        uEl.dataset.uid = u.id;
        uEl.innerHTML = `
          <div class="rkw-mp-avatar-wrap">
            ${avatarStr}
            <div class="rkw-mp-status ${isOnline ? "online" : ""}"></div>
          </div>
          <div class="rkw-mp-alias" style="color:${color}">${alias}</div>
        `;
        uEl.addEventListener("click", e => { e.stopPropagation(); showUserCard(u.id, uEl); });
        groupEl.appendChild(uEl);
      });
      list.appendChild(groupEl);
    });
  }

  // ── Settings panel ─────────────────────────────────────
  function wireSettingsPanel() {
    const settingsBtn = document.getElementById("rkwSettingsBtn");
    const panel = document.getElementById("rkwSettingsPanel");

    settingsBtn.addEventListener("click", e => {
      e.stopPropagation();
      window.ANIM.toggle(panel, 'anim-fade-in', 'anim-fade-out');
      closeStickerPanel();
    });
    document.addEventListener("click", e => {
      if (!panel.contains(e.target) && e.target !== settingsBtn) closeSettingsPanel();
    });

    const slider = document.getElementById("rkwFontSizeSlider");
    const valLbl = document.getElementById("rkwFontSizeVal");
    slider.addEventListener("input", () => {
      RK.fontSize = parseInt(slider.value);
      valLbl.textContent = RK.fontSize + "px";
      applyFontSize(); savePrefs();
    });

    const scaleSlider = document.getElementById("rkwUIScaleSlider");
    const scaleVal = document.getElementById("rkwUIScaleVal");
    if (scaleSlider) {
      scaleSlider.value = Math.round(RK.uiScale * 100);
      scaleVal.textContent = Math.round(RK.uiScale * 100) + "%";
      scaleSlider.addEventListener("input", () => {
        RK.uiScale = parseInt(scaleSlider.value) / 100;
        scaleVal.textContent = parseInt(scaleSlider.value) + "%";
        applyUIScale(); savePrefs();
      });
    }

    document.getElementById("rkwBgUploadBtn").addEventListener("click", () =>
      document.getElementById("rkwBgFileInput").click());

    document.getElementById("rkwBgFileInput").addEventListener("change", async function () {
      const file = this.files[0]; if (!file) return; this.value = "";
      try {
        let url;
        if (window.uploadToCloudinary) {
          url = await window.uploadToCloudinary(file, "chat_backgrounds");
        } else {
          const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", "reiken_default"); fd.append("folder", "reiken_assets/chat_backgrounds");
          const r = await fetch("https://api.cloudinary.com/v1_1/dyy6zbkop/image/upload", { method: "POST", body: fd });
          const d = await r.json(); if (!d.secure_url) throw new Error(d.error?.message || "Error"); url = d.secure_url;
        }
        RK.chatBg = url; applyChatBg(); addBgSwatch(url); savePrefs();
        showRKToast("✔ Fondo aplicado");
      } catch (err) { showRKToast("✖ Error al subir fondo"); }
    });

    if (RK.chatBg) addBgSwatch(RK.chatBg);

    const myPicker = document.getElementById("rkwMyColorPicker");
    const otherPicker = document.getElementById("rkwOtherColorPicker");
    
    myPicker?.addEventListener("input", () => {
      RK.myMsgBg = myPicker.value;
      applyMessageColors(); savePrefs();
    });
    otherPicker?.addEventListener("input", () => {
      RK.otherMsgBg = otherPicker.value;
      applyMessageColors(); savePrefs();
    });

    document.getElementById("rkwMyColorReset")?.addEventListener("click", () => {
      RK.myMsgBg = "rgba(219,111,78,0.42)";
      applyMessageColors(); savePrefs();
    });
    document.getElementById("rkwOtherColorReset")?.addEventListener("click", () => {
      RK.otherMsgBg = "rgba(255,255,255,0.1)";
      applyMessageColors(); savePrefs();
    });
    document.getElementById("rkwBgReset")?.addEventListener("click", () => {
      RK.chatBg = null;
      applyChatBg(); savePrefs();
      document.querySelectorAll(".rkw-bg-swatch").forEach(s => s.classList.remove("active"));
    });
  }

  function addBgSwatch(url) {
    const grid = document.getElementById("rkwBgGrid");
    if (!grid) return;
    grid.querySelectorAll(".rkw-bg-swatch").forEach(s => { if (s.dataset.url === url) s.remove(); });
    const swatch = document.createElement("div");
    swatch.className = "rkw-bg-swatch"; swatch.dataset.url = url;
    swatch.style.backgroundImage = `url('${url}')`;
    if (RK.chatBg === url) swatch.classList.add("active");
    swatch.addEventListener("click", () => {
      RK.chatBg = url; applyChatBg(); savePrefs();
      grid.querySelectorAll(".rkw-bg-swatch").forEach(s => s.classList.toggle("active", s.dataset.url === url));
    });
    grid.insertBefore(swatch, document.getElementById("rkwBgUploadBtn"));
  }

  function applyMessageColors() {
    const win = document.getElementById("rkChatWindow");
    if (!win) return;
    win.style.setProperty("--rk-my-msg-bg", RK.myMsgBg);
    win.style.setProperty("--rk-other-msg-bg", RK.otherMsgBg);
    const myPicker = document.getElementById("rkwMyColorPicker");
    const otherPicker = document.getElementById("rkwOtherColorPicker");
    // Helper to ensure tooltips/labels sync if needed, but here we just update picker values
    if (myPicker && RK.myMsgBg.startsWith("#")) myPicker.value = RK.myMsgBg;
    if (otherPicker && RK.otherMsgBg.startsWith("#")) otherPicker.value = RK.otherMsgBg;
  }

  function applyChatBg() {
    const msgs = document.getElementById("rkwMessages");
    if (msgs) msgs.style.backgroundImage = RK.chatBg ? `url('${RK.chatBg}')` : "";
  }

  function closeSettingsPanel() {
    window.ANIM.hide(document.getElementById("rkwSettingsPanel"), 'anim-fade-out');
  }

  function applyFontSize() {
    const msgs = document.getElementById("rkwMessages");
    const input = document.getElementById("rkwInput");
    // Apply via CSS variable so all current & future message rows inherit it
    if (msgs) msgs.style.setProperty("--rk-font-size", RK.fontSize + "px");
    if (input) input.style.fontSize = RK.fontSize + "px";
  }

  function applyUIScale() {
    // Zoom the inner body of the chat, keeping the window frame unchanged
    const body = document.querySelector("#rkChatWindow .rkw-body");
    if (!body) return;
    body.style.zoom = RK.uiScale;
  }

  // ── Reply ─────────────────────────────────────────────
  function setReply(msgId, alias, text) {
    RK.replyingTo = { id: msgId, alias, text };
    const bar = document.getElementById("rkwReplyBar");
    const lbl = document.getElementById("rkwReplyText");
    window.ANIM.show(bar, 'anim-slide-up');
    lbl.textContent = `↩ ${alias}: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`;
    document.getElementById("rkwInput").focus();
  }

  function clearReply() {
    RK.replyingTo = null;
    window.ANIM.hide(document.getElementById("rkwReplyBar"), 'anim-slide-down-out');
  }

  // ── Sticker panel ─────────────────────────────────────
  async function fetchGlobalStickers() {
    try {
      const { data, error } = await RK.sb.from("stickers_global").select("url").order("created_at", { ascending: false });
      if (!error && data) RK.globalStickers = data.map(s => s.url);
      if (RK.stickerTab === 'global') renderStickerGrid();
    } catch (e) { }
  }

  async function uploadToGlobalStickers(url) {
    try {
      await RK.sb.from("stickers_global").insert([{ url, user_id: RK.user.id }]);
      fetchGlobalStickers();
    } catch (e) { }
  }

  function wireStickerPanel() {
    document.getElementById("rkwStickerBtn").addEventListener("click", e => {
      e.stopPropagation(); toggleStickerPanel(); closeSettingsPanel();
    });
    document.getElementById("rkwStickerUploadBtn").addEventListener("click", () =>
      document.getElementById("rkwStickerFileInput").click());
    
    document.getElementById("rkwStickerFileInput").addEventListener("change", function () {
      const file = this.files[0]; if (!file) return; 
      const isGlobal = document.getElementById("rkwStickerGlobalCheck").checked;
      this.value = ""; 
      
      if (file.type === "image/gif") {
        uploadStickerDirect(file, isGlobal);
      } else {
        openStickerCrop(file, isGlobal);
      }
    });

    document.querySelectorAll(".rkw-sp-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        RK.stickerTab = tab.dataset.tab;
        document.querySelectorAll(".rkw-sp-tab").forEach(t => t.classList.toggle("active", t === tab));
        
        const title = document.getElementById("rkwStickerPanelTitle");
        if (RK.stickerTab === 'mis') title.textContent = "Mis Stickers";
        else if (RK.stickerTab === 'fav') title.textContent = "Favoritos";
        else title.textContent = "Predeterminados";

        renderStickerGrid();
      });
    });

    document.addEventListener("click", e => {
      const panel = document.getElementById("rkwStickerPanel");
      const btn = document.getElementById("rkwStickerBtn");
      if (!panel || panel.classList.contains("hidden")) return;
      if (!panel.contains(e.target) && e.target !== btn) closeStickerPanel();
    });
    renderStickerGrid();
  }

  function toggleStickerPanel() {
    const panel = document.getElementById("rkwStickerPanel");
    const btn = document.getElementById("rkwStickerBtn");
    if (!panel) return;
    RK.stickerPanelOpen = !RK.stickerPanelOpen;
    panel.classList.toggle("hidden", !RK.stickerPanelOpen);
    btn.classList.toggle("active", RK.stickerPanelOpen);
    if (RK.stickerPanelOpen && RK.stickerTab === 'global') fetchGlobalStickers();
  }

  function closeStickerPanel() {
    const panel = document.getElementById("rkwStickerPanel");
    const btn = document.getElementById("rkwStickerBtn");
    if (!panel) return;
    RK.stickerPanelOpen = false; window.ANIM.hide(panel, 'anim-fade-out'); btn?.classList.remove("active");
  }

  function renderStickerGrid() {
    const grid = document.getElementById("rkwStickerGrid"); if (!grid) return;
    grid.innerHTML = "";
    
    let list = [];
    if (RK.stickerTab === 'mis') list = RK.stickers;
    else if (RK.stickerTab === 'fav') list = RK.favStickers;
    else list = RK.globalStickers;

    if (!list.length) { 
      const msg = RK.stickerTab === 'mis' ? "Sin stickers aún. ¡Sube el primero!" : (RK.stickerTab === 'fav' ? "No tienes favoritos guardados." : "No hay stickers compartidos aún.");
      grid.innerHTML = `<p class="rkw-sp-empty">${msg}</p>`; 
    } else {
      list.forEach(url => {
        const wrap = document.createElement("div"); wrap.className = "rkw-fav-item";
        const img = document.createElement("img");
        img.src = url; img.className = "rkw-sp-sticker"; img.loading = "lazy";
        img.addEventListener("click", () => { sendSticker(url); closeStickerPanel(); });
        wrap.appendChild(img);

        if (RK.stickerTab === 'fav' || RK.stickerTab === 'mis') {
           const rmBtn = document.createElement("button"); rmBtn.className = "rkw-fav-remove"; rmBtn.textContent = "✕"; 
           rmBtn.title = RK.stickerTab === 'fav' ? "Quitar favorito" : "Eliminar sticker";
           rmBtn.addEventListener("click", e => { 
             e.stopPropagation(); 
             if (RK.stickerTab === 'fav') toggleFavSticker(url);
             else {
               RK.stickers = RK.stickers.filter(s => s !== url);
               localStorage.setItem(`rk_stickers_${RK.user.id}`, JSON.stringify(RK.stickers));
               renderStickerGrid();
             }
           });
           wrap.appendChild(rmBtn);
        }
        grid.appendChild(wrap);
      });
    }
  }

  function toggleFavSticker(url) {
    const idx = RK.favStickers.indexOf(url);
    if (idx === -1) { RK.favStickers.unshift(url); showRKToast("⭐ Sticker añadido a favoritos"); }
    else { RK.favStickers.splice(idx, 1); showRKToast("✕ Sticker quitado de favoritos"); }
    try { localStorage.setItem(`rk_favstickers_${RK.user.id}`, JSON.stringify(RK.favStickers)); } catch (e) { }
    renderStickerGrid();
  }

  async function sendSticker(url) {
    if (!RK.activeChannel || !RK.user) return;
    const ch = RK.activeChannel;
    const row = { user_id: RK.user.id, contenido: `[sticker:${url}]` };
    if (RK.replyingTo) { row.reply_to_id = RK.replyingTo.id; row.reply_preview = `${RK.replyingTo.alias}: ${RK.replyingTo.text.slice(0, 60)}`; }
    applyChannelFields(row, ch);
    const { error } = await RK.sb.from("mensajes").insert(row);
    if (error) showRKToast("✖ Error al enviar sticker");
    clearReply();
  }

  // ── Crop ──────────────────────────────────────────────
  const CS = { img: null, scale: 1, minScale: 1, maxScale: 5, x: 0, y: 0, dragging: false, mx: 0, my: 0, SIZE: 300, isGlobal: false };

  function wireCropOverlay() {
    const canvas = document.getElementById("rkwCropCanvas");
    const ctx = canvas.getContext("2d");
    const zoom = document.getElementById("rkwCropZoom");
    zoom.addEventListener("input", () => {
      const p = zoom.value / 100; CS.scale = CS.minScale + p * (CS.maxScale - CS.minScale);
      clampCS(); drawCS(ctx);
    });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      CS.scale = Math.max(CS.minScale, Math.min(CS.maxScale, CS.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
      syncCSSlider(); clampCS(); drawCS(ctx);
    }, { passive: false });
    canvas.addEventListener("mousedown", e => { CS.dragging = true; CS.mx = e.clientX; CS.my = e.clientY; });
    document.addEventListener("mousemove", e => {
      if (!CS.dragging) return;
      CS.x += e.clientX - CS.mx; CS.y += e.clientY - CS.my;
      CS.mx = e.clientX; CS.my = e.clientY; clampCS(); drawCS(ctx);
    });
    document.addEventListener("mouseup", () => { CS.dragging = false; });
    document.getElementById("rkwCropCancel").addEventListener("click", () => window.ANIM.hide(document.getElementById("rkwCropOverlay"), 'anim-modal-out'));
    document.getElementById("rkwCropConfirm").addEventListener("click", async () => {
      const btn = document.getElementById("rkwCropConfirm");
      btn.disabled = true; btn.textContent = "Subiendo...";
      try {
        const out = document.createElement("canvas"); out.width = out.height = 320;
        const octx = out.getContext("2d");
        octx.drawImage(CS.img, -CS.x / CS.scale, -CS.y / CS.scale, CS.SIZE / CS.scale, CS.SIZE / CS.scale, 0, 0, 320, 320);
        const blob = await new Promise(res => out.toBlob(res, "image/png"));
        let url;
        if (window.uploadToCloudinary) { url = await window.uploadToCloudinary(blob, "stickers"); }
        else {
          const fd = new FormData(); fd.append("file", blob); fd.append("upload_preset", "reiken_default"); fd.append("folder", "reiken_assets/stickers");
          const r = await fetch("https://api.cloudinary.com/v1_1/dyy6zbkop/image/upload", { method: "POST", body: fd });
          const d = await r.json(); if (!d.secure_url) throw new Error(d.error?.message || "Error"); url = d.secure_url;
        }
        
        if (CS.isGlobal) {
          await uploadToGlobalStickers(url);
        } else {
          RK.stickers.unshift(url);
          try { localStorage.setItem(`rk_stickers_${RK.user.id}`, JSON.stringify(RK.stickers)); } catch (e) { }
          if (RK.stickerTab === 'mis') renderStickerGrid();
        }

        window.ANIM.hide(document.getElementById("rkwCropOverlay"), 'anim-modal-out');
        showRKToast(CS.isGlobal ? "✔ Sticker compartido" : "✔ Sticker guardado");
      } catch (err) { showRKToast("✖ Error al subir el sticker"); }
      finally { btn.disabled = false; btn.textContent = "¡HECHO!"; }
    });
  }

  async function uploadStickerDirect(file, isGlobal) {
    showRKToast("⏳ Subiendo GIF...");
    try {
      let url;
      if (window.uploadToCloudinary) { url = await window.uploadToCloudinary(file, "stickers"); }
      else {
        const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", "reiken_default"); fd.append("folder", "reiken_assets/stickers");
        const r = await fetch("https://api.cloudinary.com/v1_1/dyy6zbkop/image/upload", { method: "POST", body: fd });
        const d = await r.json(); if (!d.secure_url) throw new Error(d.error?.message || "Error"); url = d.secure_url;
      }
      
      if (isGlobal) {
        await uploadToGlobalStickers(url);
      } else {
        RK.stickers.unshift(url);
        try { localStorage.setItem(`rk_stickers_${RK.user.id}`, JSON.stringify(RK.stickers)); } catch (e) { }
        if (RK.stickerTab === 'mis') renderStickerGrid();
      }
      showRKToast(isGlobal ? "✔ GIF compartido" : "✔ GIF guardado");
    } catch (e) {
      showRKToast("✖ Error al subir GIF");
    }
  }

  function openStickerCrop(file, isGlobal = false) {
    CS.isGlobal = isGlobal;
    const canvas = document.getElementById("rkwCropCanvas"); const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      CS.img = img; CS.minScale = Math.max(CS.SIZE / img.width, CS.SIZE / img.height);
      CS.maxScale = CS.minScale * 4; CS.scale = CS.minScale;
      CS.x = (CS.SIZE - img.width * CS.scale) / 2; CS.y = (CS.SIZE - img.height * CS.scale) / 2;
      document.getElementById("rkwCropZoom").value = 0; clampCS(); drawCS(ctx);
      window.ANIM.show(document.getElementById("rkwCropOverlay"), 'anim-modal-in');
    };
    img.src = URL.createObjectURL(file);
  }

  function drawCS(ctx) {
    if (!CS.img) return; const s = CS.SIZE;
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(CS.img, CS.x, CS.y, CS.img.width * CS.scale, CS.img.height * CS.scale);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s / 3 * i, 0); ctx.lineTo(s / 3 * i, s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, s / 3 * i); ctx.lineTo(s, s / 3 * i); ctx.stroke(); }
    ctx.strokeStyle = "rgba(219,111,78,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, s - 2, s - 2);
  }
  function clampCS() { if (!CS.img) return; CS.x = Math.max(CS.SIZE - CS.img.width * CS.scale, Math.min(0, CS.x)); CS.y = Math.max(CS.SIZE - CS.img.height * CS.scale, Math.min(0, CS.y)); }
  function syncCSSlider() { const sl = document.getElementById("rkwCropZoom"); if (sl) sl.value = ((CS.scale - CS.minScale) / (CS.maxScale - CS.minScale)) * 100; }

  // ── User card (deduplicado) ───────────────────────────
  let _ucEl = null, _ucLoading = false;

  async function showUserCard(userId, anchorEl) {
    if (_ucLoading) return;
    if (_ucEl && _ucEl.dataset.uid === userId) { closeUserCard(); return; }
    closeUserCard();
    _ucLoading = true;

    const card = document.createElement("div");
    card.className = "rkw-user-card"; card.dataset.uid = userId;
    card.innerHTML = `<div class="rkw-uc-banner"></div><div class="rkw-uc-avatar-row"><img class="rkw-uc-avatar" src="icons/Tu.png" alt=""></div><div class="rkw-uc-alias" style="color:#fff">Cargando...</div>`;
    document.body.appendChild(card); _ucEl = card;
    requestAnimationFrame(() => positionCard(card, anchorEl));

    const [{ data: u }, { data: rolesData }, { data: dispData }] = await Promise.all([
      RK.sb.from("usuarios").select("alias,foto_url,banner_url,color_alias,fuente_alias").eq("id", userId).single(),
      RK.sb.from("usuario_roles").select("tipo,roles(nombre,icon_url)").eq("user_id", userId),
      RK.sb.from("disponibilidad").select("dia,hora_inicio,hora_fin").eq("user_id", userId),
    ]);
    _ucLoading = false;

    const principal = rolesData?.find(r => r.tipo === "principal");
    const secundarios = rolesData?.filter(r => r.tipo === "secundario") || [];
    const roleTag = (rol, isPrincipal = false) => {
      const icon = rol.roles?.icon_url ? `<img src="${rol.roles.icon_url}" alt="">` : ""
      return `<span class="rkw-uc-role${isPrincipal ? " principal" : ""}">${icon}${rol.roles?.nombre || ""}</span>`;
    };
    const rolesHTML = (principal || secundarios.length)
      ? `${principal ? `<div class="rkw-uc-section-label">Rol Principal</div><div class="rkw-uc-roles">${roleTag(principal, true)}</div>` : ""}${secundarios.length ? `<div class="rkw-uc-section-label">Roles Secundarios</div><div class="rkw-uc-roles">${secundarios.map(r => roleTag(r)).join("")}</div>` : ""}`
      : `<p class="rkw-uc-noroles">Sin roles asignados</p>`;

    const diasOrden = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
    const dispHTML = (dispData || []).length
      ? `<div class="rkw-uc-disp-box">${diasOrden.filter(d => dispData.some(x => x.dia === d)).map(d => { const h = dispData.find(x => x.dia === d); return `<div class="rkw-uc-disp-row"><span class="rkw-uc-disp-day">${d}</span><span class="rkw-uc-disp-time">${(h.hora_inicio || "").slice(0, 5)} – ${(h.hora_fin || "").slice(0, 5)}</span></div>`; }).join("")}</div>`
      : `<p class="rkw-uc-disp-empty">Sin disponibilidad registrada</p>`;

    card.innerHTML = `
      <div class="rkw-uc-banner" style="${u?.banner_url ? `background-image:url('${u.banner_url}')` : ""}"></div>
      <div class="rkw-uc-avatar-row"><img class="rkw-uc-avatar" src="${u?.foto_url || 'icons/Tu.png'}" alt="" onerror="this.src='icons/Tu.png'"></div>
      <div class="rkw-uc-alias" style="color:${u?.color_alias || '#fff'}">${u?.alias || "Usuario"}</div>
      ${rolesHTML}
      <div class="rkw-uc-section-label">Disponibilidad</div>
      ${dispHTML}`;

    if (u?.fuente_alias) {
      try {
        if (u.fuente_alias.startsWith("http")) {
          const fName = `RKUCFont_${userId.slice(0, 8)}`;
          if (![...document.fonts].find(f => f.family === fName)) { const face = new FontFace(fName, `url(${u.fuente_alias})`); await face.load(); document.fonts.add(face); }
          card.querySelector(".rkw-uc-alias").style.fontFamily = `'${fName}','RKMontserrat','Gliker',sans-serif`;
        } else {
          card.querySelector(".rkw-uc-alias").style.fontFamily = `'${u.fuente_alias}','RKMontserrat','Gliker',sans-serif`;
        }
      } catch (e) { }
    }

    requestAnimationFrame(() => positionCard(card, anchorEl));
    setTimeout(() => document.addEventListener("click", _ucOutside), 0);
  }

  function positionCard(card, anchorEl) {
    if (window.innerWidth <= 600) {
      card.style.top = "";
      card.style.left = "";
      return; // Mobile CSS handles the bottom sheet positioning
    }
    const rect = anchorEl.getBoundingClientRect();
    const cw = card.offsetWidth || 230; const ch = card.offsetHeight || 300;
    let top = rect.top - ch - 10;
    let left = rect.right + 10;
    if (top < 8) top = rect.bottom + 10;
    if (top + ch > window.innerHeight - 8) top = window.innerHeight - ch - 8;
    if (left + cw > window.innerWidth - 8) left = rect.left - cw - 10;
    if (left < 8) left = 8;
    card.style.top = top + "px"; card.style.left = left + "px";
  }

  function _ucOutside(e) { if (_ucEl && !_ucEl.contains(e.target)) closeUserCard(); }
  function closeUserCard() { _ucEl?.remove(); _ucEl = null; document.removeEventListener("click", _ucOutside); }

  // ── Canales render + open ─────────────────────────────
  function renderChannelList() {
    const list = document.getElementById("rkwChannelList"); if (!list) return;
    list.innerHTML = "";
    RK.channels.forEach(ch => {
      const btn = document.createElement("button");
      btn.className = "rkw-channel-btn"; btn.dataset.id = ch.id; btn.title = ch.label.trim();
      btn.innerHTML = ch.tipo === "proyecto" && ch.icono_url
        ? `<img class="rkw-ch-icon" src="${ch.icono_url}" alt=""><span>${ch.label}</span>`
        : `<span>${ch.icon} ${ch.label}</span>`;
      btn.addEventListener("click", () => openChannel(ch));
      list.appendChild(btn);
    });
  }

  async function openChannel(ch) {
    RK.activeChannel = ch; closeStickerPanel(); closeSettingsPanel(); closeMembersPanel(); clearReply();
    clearNotification();
    document.querySelectorAll(".rkw-channel-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`.rkw-channel-btn[data-id="${ch.id}"]`)?.classList.add("active");
    document.getElementById("rkwChatTitle").textContent = ch.label.trim();
    renderTypingIndicator(ch.id);
    if (RK.realtimeSub) { RK.sb.removeChannel(RK.realtimeSub); RK.realtimeSub = null; }
    await loadMessages(ch);
    subscribeRealtime(ch);
  }

  async function loadMessages(ch) {
    const msgs = document.getElementById("rkwMessages");
    msgs.innerHTML = `<p class="rkw-loading">Cargando...</p>`;
    
    RK.canLoadMore[ch.id] = true;
    RK.oldestMsgDate[ch.id] = null;

    let q = RK.sb.from("mensajes")
      .select("id,contenido,created_at,user_id,reply_to_id,reply_preview,usuarios(alias,foto_url,color_alias,fuente_alias),mensajes_reacciones(emoji,sticker_url,user_id)")
      .order("created_at", { ascending: false }).limit(50);
    
    switch (ch.tipo) {
      case "general": q = q.is("proyecto_id", null).is("seccion_id", null).is("escena_id", null).is("concepto_id", null); break;
      case "proyecto": q = q.eq("proyecto_id", ch.ref_id).is("seccion_id", null).is("escena_id", null).is("concepto_id", null); break;
      case "seccion": q = q.eq("seccion_id", ch.ref_id).is("escena_id", null).is("concepto_id", null); break;
      case "escena": q = q.eq("escena_id", ch.ref_id); break;
      case "concepto": q = q.eq("concepto_id", ch.ref_id); break;
    }
    const { data, error } = await q;
    if (error) { msgs.innerHTML = `<p class="rkw-loading">Error al cargar mensajes.</p>`; return; }
    
    const messages = data || [];
    if (messages.length < 50) RK.canLoadMore[ch.id] = false;
    if (messages.length > 0) {
      RK.oldestMsgDate[ch.id] = messages[messages.length - 1].created_at;
    }

    RK.msgCache[ch.id] = [...messages].reverse();
    renderMessages(ch.id);
    scrollToBottom();
  }

  async function loadMoreMessages() {
    const ch = RK.activeChannel;
    if (!ch || RK.loadingMore || !RK.canLoadMore[ch.id]) return;

    RK.loadingMore = true;
    const msgs = document.getElementById("rkwMessages");
    
    // UI Loading state
    const loader = document.createElement("div");
    loader.className = "rkw-loading-more";
    loader.innerHTML = `<span class="rkw-loading">Cargando anteriores...</span>`;
    msgs.prepend(loader);

    const oldHeight = msgs.scrollHeight;

    let q = RK.sb.from("mensajes")
      .select("id,contenido,created_at,user_id,reply_to_id,reply_preview,usuarios(alias,foto_url,color_alias,fuente_alias),mensajes_reacciones(emoji,sticker_url,user_id)")
      .lt("created_at", RK.oldestMsgDate[ch.id])
      .order("created_at", { ascending: false }).limit(50);

    switch (ch.tipo) {
      case "general": q = q.is("proyecto_id", null).is("seccion_id", null).is("escena_id", null).is("concepto_id", null); break;
      case "proyecto": q = q.eq("proyecto_id", ch.ref_id).is("seccion_id", null).is("escena_id", null).is("concepto_id", null); break;
      case "seccion": q = q.eq("seccion_id", ch.ref_id).is("escena_id", null).is("concepto_id", null); break;
      case "escena": q = q.eq("escena_id", ch.ref_id); break;
      case "concepto": q = q.eq("concepto_id", ch.ref_id); break;
    }

    const { data, error } = await q;
    loader.remove();

    if (error || !data) {
      RK.loadingMore = false;
      return;
    }

    if (data.length < 50) RK.canLoadMore[ch.id] = false;
    if (data.length > 0) {
      RK.oldestMsgDate[ch.id] = data[data.length - 1].created_at;
      // Prepend to cache
      RK.msgCache[ch.id] = [...data.reverse(), ...RK.msgCache[ch.id]];
      
      // Render again
      renderMessages(ch.id);
      
      // Adjust scroll to prevent jumping
      const newHeight = msgs.scrollHeight;
      msgs.scrollTop = newHeight - oldHeight;
    }

    RK.loadingMore = false;
  }

  // ── Render mensajes ────────────────────────────────────
  function renderMessages(channelId) {
    const msgs = document.getElementById("rkwMessages");
    const data = RK.msgCache[channelId] || [];
    msgs.innerHTML = "";
    if (!data.length) { msgs.innerHTML = `<p class="rkw-loading">Sé el primero en escribir aquí ✨</p>`; return; }

    let lastDate = null;
    let prevUserId = null;
    let prevTime = 0;
    data.forEach(m => {
      const d = new Date(m.created_at);
      const dateStr = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
      if (dateStr !== lastDate) {
        const sep = document.createElement("div"); sep.className = "rkw-date-sep"; sep.textContent = dateStr;
        msgs.appendChild(sep); lastDate = dateStr;
        prevUserId = null; // reset grouping on date change
      }
      const u = m.usuarios || {};
      const alias = u.alias || "Usuario";
      const avatar = u.foto_url || null;
      const color = u.color_alias || "#ffffff";
      const isMe = m.user_id === RK.user?.id;
      const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

      // Grouping: same user, within 5 minutes
      const isGrouped = (m.user_id === prevUserId && (d.getTime() - prevTime) < 300000);
      prevUserId = m.user_id;
      prevTime = d.getTime();

      const stickerMatch = typeof m.contenido === "string" && m.contenido.match(/^\[sticker:(https?:\/\/.+?)\]$/);
      const isSticker = !!stickerMatch;
      const stickerUrl = isSticker ? stickerMatch[1] : null;
      const imageMatch = typeof m.contenido === "string" && m.contenido.match(/^\[image:(https?:\/\/.+?)(?:\|(.+?))?\]$/);
      const isImage = !!imageMatch;
      const imageUrl = isImage ? imageMatch[1] : null;
      const imageCaption = isImage && imageMatch[2] ? imageMatch[2] : null;
      const isEdited = m.editado === true || m.editado === "true";

      const row = document.createElement("div");
      row.className = `rkw-msg-row${isMe ? " rkw-msg-row--me" : ""}${isGrouped ? " rkw-msg-row--grouped" : ""}`;
      row.dataset.id = m.id;

      const avatarInner = avatar ? `<img src="${avatar}" alt="">` : (alias[0] || "?").toUpperCase();
      const avatarHTML = `<div class="rkw-msg-avatar" data-uid="${m.user_id}" title="${alias}">${avatarInner}</div>`;
      const replyQuote = m.reply_preview ? `<div class="rkw-msg-reply-quote" data-target="${m.reply_to_id || ""}">↩ ${escapeHtml(m.reply_preview)}</div>` : "";
      const editedTag = isEdited ? `<span class="rkw-msg-edited-tag">(editado)</span>` : "";
      let msgBody = "";
      if (isSticker) {
        msgBody = `<span class="rkw-sticker-wrap"><img class="rkw-msg-sticker" src="${stickerUrl}" alt="sticker" loading="lazy"><button class="rkw-sticker-fav-btn" data-url="${stickerUrl}" title="Guardar en favoritos">⭐</button></span>`;
      } else if (isImage) {
        msgBody = `<img class="rkw-msg-img" src="${imageUrl}" alt="imagen" loading="lazy" data-imgurl="${imageUrl}">`;
        if (imageCaption) msgBody += `<span class="rkw-msg-caption">${formatMentions(escapeHtml(imageCaption))}</span>`;
      } else {
        msgBody = formatMentions(escapeHtml(m.contenido)) + editedTag;
      }

      // Side button for actions (reply + edit/delete for own messages)
      const sideDropdownItems = [`<button class="rkw-msg-dot-item rkw-reply-trigger" data-id="${m.id}" data-alias="${alias}" data-text="${(m.contenido || "").slice(0, 80).replace(/"/g, "&quot;")}">↩ Responder</button>`];
      if (isMe && !isSticker && !isImage) sideDropdownItems.push(`<button class="rkw-msg-dot-item rkw-edit-trigger" data-id="${m.id}" data-text="${(m.contenido || "").replace(/"/g, "&quot;")}">✏ Editar</button>`);
      if (isMe) sideDropdownItems.push(`<button class="rkw-msg-dot-item danger rkw-delete-trigger" data-id="${m.id}">🗑 Borrar</button>`);

      row.innerHTML = `
        ${avatarHTML}
        <div class="rkw-msg-bubble">
          <span class="rkw-msg-name" style="color:${color};${isMe ? 'text-align:right;' : ''}" data-reply-id="${m.id}" data-reply-alias="${alias}" data-reply-text="${(m.contenido || "").slice(0, 80).replace(/"/g, "&quot;")}">${alias}</span>
          ${replyQuote}
          <p class="rkw-msg-text${isSticker ? " is-sticker" : ""}${isImage ? " is-image" : ""}">
            ${msgBody}
          </p>
          <span class="rkw-msg-time">${time}</span>
        </div>
        <button class="rkw-msg-side-btn" title="Opciones">⋯</button>
        <div class="rkw-msg-side-dropdown hidden">${sideDropdownItems.join("")}</div>`;

      row.querySelector(".rkw-reply-trigger")?.addEventListener("click", e => {
        e.stopPropagation();
        const b = e.currentTarget; setReply(b.dataset.id, b.dataset.alias, b.dataset.text);
        let sd = row.querySelector(".rkw-msg-side-dropdown"); if(sd) window.ANIM.hide(sd, 'anim-fade-out');
      });
      // Click alias to reply
      const nameEl = row.querySelector(".rkw-msg-name");
      if (nameEl) {
        nameEl.addEventListener("click", e => {
          e.stopPropagation();
          setReply(nameEl.dataset.replyId, nameEl.dataset.replyAlias, nameEl.dataset.replyText);
        });
      }
      // ⭐ Sticker favorito
      const favBtn = row.querySelector(".rkw-sticker-fav-btn");
      if (favBtn) {
        const sUrl = favBtn.dataset.url;
        if (RK.favStickers.includes(sUrl)) favBtn.classList.add("saved");
        favBtn.addEventListener("click", e => {
          e.stopPropagation();
          if (RK.favStickers.includes(sUrl)) {
            RK.favStickers = RK.favStickers.filter(u => u !== sUrl);
            favBtn.classList.remove("saved");
            showRKToast("Sticker eliminado de favoritos");
          } else {
            RK.favStickers.unshift(sUrl);
            favBtn.classList.add("saved");
            showRKToast("⭐ Sticker guardado en favoritos");
          }
          try { localStorage.setItem(`rk_favstickers_${RK.user.id}`, JSON.stringify(RK.favStickers)); } catch (e) { }
          renderStickerGrid();
        });
      }
      row.querySelector(".rkw-msg-reply-quote")?.addEventListener("click", () => {
        const t = msgs.querySelector(`[data-id="${m.reply_to_id}"]`);
        if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.style.outline = "2px solid #db6f4e"; setTimeout(() => { t.style.outline = ""; }, 1200); }
      });
      row.querySelectorAll(".rkw-msg-avatar").forEach(av => {
        av.addEventListener("click", e => { e.stopPropagation(); showUserCard(m.user_id, e.currentTarget); });
      });
      // Click en imagen -> lightbox
      row.querySelector(".rkw-msg-img")?.addEventListener("click", e => {
        openLightbox(e.currentTarget.dataset.imgurl);
      });
      // Side menu (3-dot) with hover delay
      wireSideMenu(row, m);

      if (u.fuente_alias) {
        const nameEl2 = row.querySelector(".rkw-msg-name");
        if (u.fuente_alias.startsWith("http")) {
          const fontId = `RKMsgFont_${m.user_id.slice(0, 8)}`;
          if (![...document.fonts].find(f => f.family === fontId)) {
            new FontFace(fontId, `url(${u.fuente_alias})`).load().then(face => { document.fonts.add(face); if (nameEl2) nameEl2.style.fontFamily = `'${fontId}','RKMontserrat','Gliker',sans-serif`; }).catch(() => { });
          } else if (nameEl2) nameEl2.style.fontFamily = `'${fontId}','RKMontserrat','Gliker',sans-serif`;
        } else if (nameEl2) {
          nameEl2.style.fontFamily = `'${u.fuente_alias}','RKMontserrat','Gliker',sans-serif`;
        }
      }

      addReactionsToRow(row, m);
      msgs.appendChild(row);
    });
    applyFontSize(); applyChatBg();
  }

  // -- Append single message (optimizacion realtime) -----
  function appendMessage(m, channelId) {
    const msgs = document.getElementById("rkwMessages");
    if (!msgs) return;
    
    // De-duplication check
    if (document.querySelector(`.rkw-msg-row[data-id="${m.id}"]`)) return;

    const empty = msgs.querySelector(".rkw-loading");
    if (empty) empty.remove();

    const u = m.usuarios || {};
    const alias = u.alias || "Usuario";
    const avatar = u.foto_url || null;
    const color = u.color_alias || "#ffffff";
    const isMe = m.user_id === RK.user?.id;
    const d = new Date(m.created_at);

    // Play notification sound on replies
    if (m.reply_to_id && !isMe) {
      new Audio("sounds/noti.mp3").play().catch(() => {});
    }
    const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

    const dateStr = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    const seps = msgs.querySelectorAll(".rkw-date-sep");
    const lastSep = seps.length ? seps[seps.length - 1] : null;
    if (!lastSep || lastSep.textContent !== dateStr) {
      const sep = document.createElement("div");
      sep.className = "rkw-date-sep";
      sep.textContent = dateStr;
      msgs.appendChild(sep);
    }

    // Grouping: check last message row
    let isGrouped = false;
    const allRows = msgs.querySelectorAll(".rkw-msg-row");
    if (allRows.length > 0) {
      const lastRow = allRows[allRows.length - 1];
      const lastAvatar = lastRow.querySelector(".rkw-msg-avatar");
      const lastUid = lastAvatar?.dataset?.uid;
      if (lastUid === m.user_id) {
        const cache = RK.msgCache[channelId] || [];
        if (cache.length >= 2) {
          const prevMsg = cache[cache.length - 2];
          if (prevMsg && (d.getTime() - new Date(prevMsg.created_at).getTime()) < 300000) {
            isGrouped = true;
          }
        }
      }
    }

    const stickerMatch = typeof m.contenido === "string" && m.contenido.match(/^\[sticker:(https?:\/\/.+?)\]$/);
    const isSticker = !!stickerMatch;
    const stickerUrl = isSticker ? stickerMatch[1] : null;
    const imageMatch = typeof m.contenido === "string" && m.contenido.match(/^\[image:(https?:\/\/.+?)(?:\|(.+?))?\]$/);
    const isImage = !!imageMatch;
    const imageUrl = isImage ? imageMatch[1] : null;
    const imageCaption = isImage && imageMatch[2] ? imageMatch[2] : null;
    const isEdited = m.editado === true || m.editado === "true";

    const row = document.createElement("div");
    row.className = `rkw-msg-row${isMe ? " rkw-msg-row--me" : ""}${isGrouped ? " rkw-msg-row--grouped" : ""} rkw-msg-new${(isSticker || isImage) ? " rkw-msg-new--sticker" : ""}`;
    if (m.status === "pending") row.classList.add("rkw-msg-pending");
    if (m.status === "failed") row.classList.add("rkw-msg-failed");
    row.dataset.id = m.id;

    const avatarInner = avatar ? `<img src="${avatar}" alt="">` : (alias[0] || "?").toUpperCase();
    const avatarHTML = `<div class="rkw-msg-avatar" data-uid="${m.user_id}" title="${alias}">${avatarInner}</div>`;
    const replyQuote = m.reply_preview ? `<div class="rkw-msg-reply-quote" data-target="${m.reply_to_id || ""}">` + escapeHtml(m.reply_preview) + `</div>` : "";
    const editedTag = isEdited ? `<span class="rkw-msg-edited-tag">(editado)</span>` : "";
    let msgBodyA = "";
    if (isSticker) msgBodyA = `<span class="rkw-sticker-wrap"><img class="rkw-msg-sticker" src="${stickerUrl}" alt="sticker" loading="lazy"><button class="rkw-sticker-fav-btn" data-url="${stickerUrl}" title="Guardar en favoritos">` + String.fromCodePoint(0x2B50) + `</button></span>`;
    else if (isImage) {
      msgBodyA = `<img class="rkw-msg-img" src="${imageUrl}" alt="imagen" loading="lazy" data-imgurl="${imageUrl}">`;
      if (imageCaption) msgBodyA += `<span class="rkw-msg-caption">${formatMentions(escapeHtml(imageCaption))}</span>`;
    }
    else msgBodyA = formatMentions(escapeHtml(m.contenido)) + editedTag;

    const sideItemsA = [`<button class="rkw-msg-dot-item rkw-reply-trigger" data-id="${m.id}" data-alias="${alias}" data-text="${(m.contenido || "").slice(0, 80).replace(/"/g, "&quot;")}">` + String.fromCodePoint(0x21A9) + ` Responder</button>`];
    if (isMe && !isSticker && !isImage) sideItemsA.push(`<button class="rkw-msg-dot-item rkw-edit-trigger" data-id="${m.id}" data-text="${(m.contenido || "").replace(/"/g, "&quot;")}">` + String.fromCodePoint(0x270F) + ` Editar</button>`);
    if (isMe) sideItemsA.push(`<button class="rkw-msg-dot-item danger rkw-delete-trigger" data-id="${m.id}">` + String.fromCodePoint(0x1F5D1) + ` Borrar</button>`);

    row.innerHTML = `
      ${avatarHTML}
      <div class="rkw-msg-bubble">
        <span class="rkw-msg-name" style="color:${color};${isMe ? 'text-align:right;' : ''}" data-reply-id="${m.id}" data-reply-alias="${alias}" data-reply-text="${(m.contenido || "").slice(0, 80).replace(/"/g, "&quot;")}">${alias}</span>
        ${replyQuote}
        <p class="rkw-msg-text${isSticker ? " is-sticker" : ""}${isImage ? " is-image" : ""}">
          ${msgBodyA}
        </p>
        <span class="rkw-msg-time">${time}</span>
      </div>
      <button class="rkw-msg-side-btn" title="Opciones">` + String.fromCodePoint(0x22EF) + `</button>
      <div class="rkw-msg-side-dropdown hidden">${sideItemsA.join("")}</div>`;

    row.querySelector(".rkw-reply-trigger")?.addEventListener("click", e => {
      e.stopPropagation();
      const b = e.currentTarget; setReply(b.dataset.id, b.dataset.alias, b.dataset.text);
      let sd = row.querySelector(".rkw-msg-side-dropdown"); if(sd) window.ANIM.hide(sd, 'anim-fade-out');
    });
    // Click alias to reply
    const nameElA = row.querySelector(".rkw-msg-name");
    if (nameElA) {
      nameElA.addEventListener("click", e => {
        e.stopPropagation();
        setReply(nameElA.dataset.replyId, nameElA.dataset.replyAlias, nameElA.dataset.replyText);
      });
    }
    const favBtn = row.querySelector(".rkw-sticker-fav-btn");
    if (favBtn) {
      const sUrl = favBtn.dataset.url;
      if (RK.favStickers.includes(sUrl)) favBtn.classList.add("saved");
      favBtn.addEventListener("click", e => {
        e.stopPropagation();
        if (RK.favStickers.includes(sUrl)) { RK.favStickers = RK.favStickers.filter(u => u !== sUrl); favBtn.classList.remove("saved"); }
        else { RK.favStickers.unshift(sUrl); favBtn.classList.add("saved"); }
        try { localStorage.setItem(`rk_favstickers_${RK.user.id}`, JSON.stringify(RK.favStickers)); } catch (e) { }
        renderStickerGrid();
      });
    }
    row.querySelector(".rkw-msg-reply-quote")?.addEventListener("click", () => {
      const t = msgs.querySelector(`[data-id="${m.reply_to_id}"]`);
      if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.style.outline = "2px solid #db6f4e"; setTimeout(() => { t.style.outline = ""; }, 1200); }
    });
    row.querySelectorAll(".rkw-msg-avatar").forEach(av => {
      av.addEventListener("click", e => { e.stopPropagation(); showUserCard(m.user_id, e.currentTarget); });
    });
    row.querySelector(".rkw-msg-img")?.addEventListener("click", e => { openLightbox(e.currentTarget.dataset.imgurl); });
    wireSideMenu(row, m);
    if (u.fuente_alias) {
      const nameEl2 = row.querySelector(".rkw-msg-name");
      if (u.fuente_alias.startsWith("http")) {
        const fontId = `RKMsgFont_${m.user_id.slice(0, 8)}`;
        if (![...document.fonts].find(f => f.family === fontId)) {
          new FontFace(fontId, `url(${u.fuente_alias})`).load().then(face => { document.fonts.add(face); if (nameEl2) nameEl2.style.fontFamily = `'${fontId}','RKMontserrat','Gliker',sans-serif`; }).catch(() => { });
        } else if (nameEl2) nameEl2.style.fontFamily = `'${fontId}','RKMontserrat','Gliker',sans-serif`;
      } else if (nameEl2) {
        nameEl2.style.fontFamily = `'${u.fuente_alias}','RKMontserrat','Gliker',sans-serif`;
      }
    }

    addReactionsToRow(row, m);
    msgs.appendChild(row);

    const ch = RK.activeChannel;
    const users = RK.typingUsers[ch?.id];
    if (users && users[m.user_id]) {
        clearTimeout(users[m.user_id].timeout);
        delete users[m.user_id];
        renderTypingIndicator(ch.id);
    }

    row.style.fontSize = RK.fontSize + "px";
  }

  // -- Side menu: open/close dropdown, position up/down, edit/delete --
  function wireSideMenu(row, m) {
    const sideBtn = row.querySelector(".rkw-msg-side-btn");
    const dropdown = row.querySelector(".rkw-msg-side-dropdown");
    if (!sideBtn || !dropdown) return;

    // Show side button on hover, hide 1s after mouse leaves
    let hideTimer = null;
    row.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      sideBtn.classList.add("visible");
    });
    row.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(() => {
        if (dropdown.classList.contains("hidden")) {
          sideBtn.classList.remove("visible");
        }
      }, 1000);
    });
    // Keep button visible while dropdown is open
    sideBtn.addEventListener("mouseenter", () => { clearTimeout(hideTimer); });

    sideBtn.addEventListener("click", e => {
      e.stopPropagation();
      const wasOpen = !dropdown.classList.contains("hidden");
      // Close all other open dropdowns first
      document.querySelectorAll(".rkw-msg-side-dropdown").forEach(d => window.ANIM.hide(d, 'anim-fade-out'));
      if (wasOpen) return;

      // Position dynamically: prefer downward, flip upward if not enough space
      window.ANIM.show(dropdown, 'anim-fade-in');
      const btnRect = sideBtn.getBoundingClientRect();
      const dropH = dropdown.offsetHeight || 80;
      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;

      if (spaceBelow >= dropH + 4) {
        dropdown.style.top = (sideBtn.offsetTop + sideBtn.offsetHeight + 4) + "px";
        dropdown.style.bottom = "auto";
      } else if (spaceAbove >= dropH + 4) {
        dropdown.style.bottom = (row.offsetHeight - sideBtn.offsetTop + 4) + "px";
        dropdown.style.top = "auto";
      } else {
        dropdown.style.top = (sideBtn.offsetTop + sideBtn.offsetHeight + 4) + "px";
        dropdown.style.bottom = "auto";
      }

      // Position left/right based on message ownership
      const isMe = row.classList.contains("rkw-msg-row--me");
      if (isMe) {
        dropdown.style.left = sideBtn.offsetLeft + "px";
        dropdown.style.right = "auto";
      } else {
        dropdown.style.right = (row.offsetWidth - sideBtn.offsetLeft - sideBtn.offsetWidth) + "px";
        dropdown.style.left = "auto";
      }
    });

    // Close on outside click
    document.addEventListener("click", function closer(e) {
      if (!dropdown.contains(e.target) && e.target !== sideBtn) {
        window.ANIM.hide(dropdown, 'anim-fade-out');
        // Start hide timer for side button
        hideTimer = setTimeout(() => { sideBtn.classList.remove("visible"); }, 1000);
      }
    });

    // Edit trigger
    const editTrigger = row.querySelector(".rkw-edit-trigger");
    if (editTrigger) {
      editTrigger.addEventListener("click", e => {
        e.stopPropagation();
        window.ANIM.hide(dropdown, 'anim-fade-out');
        const msgP = row.querySelector(".rkw-msg-text");
        if (!msgP) return;
        const currentText = m.contenido || "";
        msgP.innerHTML = `
          <div class="rkw-msg-edit-wrap">
            <textarea class="rkw-msg-edit-input" rows="2">${currentText.replace(/</g,'&lt;')}</textarea>
            <div class="rkw-msg-edit-btns">
              <button class="rkw-msg-edit-cancel">Cancelar</button>
              <button class="rkw-msg-edit-save">Guardar</button>
            </div>
          </div>`;
        const textarea = msgP.querySelector(".rkw-msg-edit-input");
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.addEventListener("keydown", ev => {
          if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); msgP.querySelector(".rkw-msg-edit-save").click(); }
          if (ev.key === "Escape") msgP.querySelector(".rkw-msg-edit-cancel").click();
        });
        msgP.querySelector(".rkw-msg-edit-cancel").addEventListener("click", () => {
          const editedTag = m.editado ? '<span class="rkw-msg-edited-tag">(editado)</span>' : "";
          msgP.innerHTML = formatMentions(escapeHtml(currentText)) + editedTag;
        });
        msgP.querySelector(".rkw-msg-edit-save").addEventListener("click", async () => {
          const newText = textarea.value.trim();
          if (!newText || newText === currentText) { msgP.querySelector(".rkw-msg-edit-cancel").click(); return; }
          const { error } = await RK.sb.from("mensajes").update({ contenido: newText }).eq("id", m.id);
          if (error) { showRKToast("Error al editar"); return; }
          m.contenido = newText; m.editado = true;
          if (RK.msgCache[RK.activeChannel?.id]) {
            const cached = RK.msgCache[RK.activeChannel.id].find(x => x.id === m.id);
            if (cached) { cached.contenido = newText; cached.editado = true; }
          }
          msgP.innerHTML = formatMentions(escapeHtml(newText)) + '<span class="rkw-msg-edited-tag">(editado)</span>';
          showRKToast("Mensaje editado");
        });
      });
    }

    // Delete trigger
    const delTrigger = row.querySelector(".rkw-delete-trigger");
    if (delTrigger) {
      delTrigger.addEventListener("click", async e => {
        e.stopPropagation();
        window.ANIM.hide(dropdown, 'anim-fade-out');
        if (!confirm("Borrar este mensaje?")) return;
        const { error } = await RK.sb.from("mensajes").delete().eq("id", m.id);
        if (error) { showRKToast("Error al borrar"); return; }
        if (RK.msgCache[RK.activeChannel?.id]) {
          RK.msgCache[RK.activeChannel.id] = RK.msgCache[RK.activeChannel.id].filter(x => x.id !== m.id);
        }
        row.style.transition = "opacity .25s, max-height .3s";
        row.style.opacity = "0"; row.style.maxHeight = "0"; row.style.overflow = "hidden";
        setTimeout(() => row.remove(), 320);
        showRKToast("Mensaje borrado");
      });
    }
  }


  // ── Enviar ─────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById("rkwInput");
    const text = input.value.trim();
    if (!RK.activeChannel || !RK.user) return;
    const ch = RK.activeChannel;

    // Handle normal text message Optimistically
    if (text && !RK.pendingImage) {
      input.value = "";
      const tempId = "temp-" + Date.now();
      const optMsg = {
        id: tempId,
        user_id: RK.user.id,
        contenido: text,
        created_at: new Date().toISOString(),
        status: "pending",
        usuarios: {
          alias: RK.userAlias,
          foto_url: RK.userAvatar,
          color_alias: RK.userColor,
          fuente_alias: RK.userFont
        }
      };
      if (RK.replyingTo) {
        optMsg.reply_to_id = RK.replyingTo.id;
        optMsg.reply_preview = `${RK.replyingTo.alias}: ${RK.replyingTo.text.slice(0, 60)}`;
      }
      
      // Update cache and DOM
      if (!RK.msgCache[ch.id]) RK.msgCache[ch.id] = [];
      RK.msgCache[ch.id].push(optMsg);
      appendMessage(optMsg, ch.id);
      scrollToBottom();
      
      const row = { user_id: RK.user.id, contenido: text };
      if (RK.replyingTo) { row.reply_to_id = RK.replyingTo.id; row.reply_preview = optMsg.reply_preview; }
      applyChannelFields(row, ch);
      clearReply();

      try {
        const { data, error } = await RK.sb.from("mensajes").insert(row).select().single();
        if (error) throw error;
        
        // Success: update temp message with real data
        const tempIdx = RK.msgCache[ch.id].findIndex(m => m.id === tempId);
        if (tempIdx >= 0) {
          optMsg.id = data.id; // Fix: ensure original reference has real ID
          RK.msgCache[ch.id][tempIdx] = { ...data, usuarios: optMsg.usuarios };
          const msgEl = document.querySelector(`.rkw-msg-row[data-id="${tempId}"]`);
          if (msgEl) {
            msgEl.dataset.id = data.id;
            msgEl.classList.remove("rkw-msg-pending");
            // Update side buttons with real ID
            const triggers = msgEl.querySelectorAll("[data-id]");
            triggers.forEach(t => { if (t.dataset.id === tempId) t.dataset.id = data.id; });
          }
        }
      } catch (err) {
        console.error("Optimistic Send Error:", err);
        const msgEl = document.querySelector(`.rkw-msg-row[data-id="${tempId}"]`);
        if (msgEl) {
          msgEl.classList.remove("rkw-msg-pending");
          msgEl.classList.add("rkw-msg-failed");
          msgEl.title = "Error al enviar: " + err.message;
        }
        showRKToast("✖ Error al enviar");
      }
      return;
    }

    // If there's a pending image, upload it first (not fully optimistic yet due to upload time)
    if (RK.pendingImage) {
      input.value = "";
      const file = RK.pendingImage.file;
      clearPendingImage();
      showRKToast('⏳ Subiendo imagen...');
      try {
        let url;
        if (window.uploadToCloudinary) { url = await window.uploadToCloudinary(file, 'chat_images'); }
        else {
          const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', 'reiken_default'); fd.append('folder', 'reiken_assets/chat_images');
          const r = await fetch('https://api.cloudinary.com/v1_1/dyy6zbkop/image/upload', { method: 'POST', body: fd });
          const d = await r.json(); if (!d.secure_url) throw new Error(d.error?.message || 'Error'); url = d.secure_url;
        }
        const contenido = text ? `[image:${url}|${text}]` : `[image:${url}]`;
        const row = { user_id: RK.user.id, contenido };
        if (RK.replyingTo) { row.reply_to_id = RK.replyingTo.id; row.reply_preview = RK.replyingTo.alias + ': [imagen]'; }
        applyChannelFields(row, ch);
        clearReply();
        const { error } = await RK.sb.from('mensajes').insert(row);
        if (error) showRKToast('✖ Error al enviar imagen');
        else showRKToast('✔ Imagen enviada');
      } catch(err) { showRKToast('✖ Error: ' + err.message); }
      return;
    }
  }

  function applyChannelFields(row, ch) {
    switch (ch.tipo) {
      case "proyecto": row.proyecto_id = ch.ref_id; break;
      case "seccion": row.seccion_id = ch.ref_id; break;
      case "escena": row.escena_id = ch.ref_id; break;
      case "concepto": row.concepto_id = ch.ref_id; break;
    }
  }

  // ── REACCIONES (Emojis & Stickers en mensajes) ─────────
  function buildReactionsHtml(m) {
    if (!m.mensajes_reacciones || m.mensajes_reacciones.length === 0) return '';
    const groups = {};
    m.mensajes_reacciones.forEach(r => {
      const key = r.emoji || r.sticker_url || '';
      if (!groups[key]) groups[key] = { count: 0, users: [], isSticker: !!r.sticker_url };
      groups[key].count++;
      groups[key].users.push(r.user_id);
    });
    let html = '';
    for (const key in groups) {
      const g = groups[key];
      const isMine = g.users.includes(RK.user?.id);
      if (g.isSticker) {
        html += `<span class="rkw-reaction-chip${isMine ? ' mine' : ''}" data-type="sticker" data-content="${key.replace(/"/g, '&quot;')}"><img src="${key}" class="rkw-reaction-sticker-chip"><span class="rkw-reaction-count">${g.count}</span></span>`;
      } else {
        html += `<span class="rkw-reaction-chip${isMine ? ' mine' : ''}" data-type="emoji" data-content="${key}">${key}<span class="rkw-reaction-count">${g.count}</span></span>`;
      }
    }
    return html;
  }

  function addReactionsToRow(row, m) {
    const bubble = row.querySelector('.rkw-msg-bubble');
    if (!bubble) return;

    // Animate out/in reactions bar with max-height transition
    const oldBar = row.querySelector('.rkw-reactions-bar');
    const doUpdate = () => {
      if (oldBar) oldBar.remove();
      const oldBtn = row.querySelector('.rkw-reaction-btn');
      if (oldBtn) oldBtn.remove();

      const reactionsHtml = buildReactionsHtml(m);
      if (reactionsHtml) {
        const bar = document.createElement('div');
        bar.className = 'rkw-reactions-bar';
        bar.innerHTML = reactionsHtml;
        bubble.appendChild(bar);
        ensureTwemoji(() => twemoji.parse(bar));
        bar.querySelectorAll('.rkw-reaction-chip').forEach(chip => {
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReaction(m.id, chip.dataset.type, chip.dataset.content);
          });
        });
      }

      // Reaction button (+ a la derecha del ⋮)
      const btn = document.createElement('button');
      btn.className = 'rkw-reaction-btn';
      btn.title = 'Reaccionar';
      btn.textContent = '+';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showReactionPicker(row, m);
      });
      row.appendChild(btn);

      // Controlar visibilidad con el mismo timer que el ⋮ (1s)
      if (!row._reactWired) {
        row._reactWired = true;
        let reactHideTimer = null;
        row.addEventListener("mouseenter", () => {
          const b = row.querySelector('.rkw-reaction-btn');
          if (b) { clearTimeout(reactHideTimer); b.classList.add('visible'); }
        });
        row.addEventListener("mouseleave", () => {
          reactHideTimer = setTimeout(() => {
            const b = row.querySelector('.rkw-reaction-btn');
            if (b) b.classList.remove('visible');
          }, 1000);
        });
      }
    };

    if (oldBar) {
      oldBar.classList.add('closing');
      setTimeout(doUpdate, 250);
    } else {
      doUpdate();
    }
  }

  async function toggleReaction(mensajeId, type, content) {
    const ch = RK.activeChannel;
    if (!ch || !RK.user) return;
    const msgs = RK.msgCache[ch.id] || [];
    const m = msgs.find(msg => msg.id === mensajeId);
    if (!m) return;
    if (!m.mensajes_reacciones) m.mensajes_reacciones = [];

    if (type === 'emoji') {
      const existing = m.mensajes_reacciones.find(r => r.user_id === RK.user.id && r.emoji === content);
      if (existing) {
        m.mensajes_reacciones = m.mensajes_reacciones.filter(r => r.id !== existing.id);
        RK.sb.from('mensajes_reacciones').delete().eq('id', existing.id).then();
      } else {
        const tempId = 'temp_r_' + Date.now();
        m.mensajes_reacciones.push({ id: tempId, mensaje_id: mensajeId, user_id: RK.user.id, emoji: content, sticker_url: null });
        const { data } = await RK.sb.from('mensajes_reacciones').insert({
          mensaje_id: mensajeId, user_id: RK.user.id, emoji: content
        }).select('id').single();
        if (data) {
          const idx = m.mensajes_reacciones.findIndex(r => r.id === tempId);
          if (idx >= 0) m.mensajes_reacciones[idx].id = data.id;
        }
        saveRecentEmoji(content);
      }
    } else if (type === 'sticker') {
      const existing = m.mensajes_reacciones.find(r => r.user_id === RK.user.id && r.sticker_url === content);
      if (existing) {
        m.mensajes_reacciones = m.mensajes_reacciones.filter(r => r.id !== existing.id);
        RK.sb.from('mensajes_reacciones').delete().eq('id', existing.id).then();
      } else {
        const tempId = 'temp_r_' + Date.now();
        m.mensajes_reacciones.push({ id: tempId, mensaje_id: mensajeId, user_id: RK.user.id, emoji: null, sticker_url: content });
        const { data } = await RK.sb.from('mensajes_reacciones').insert({
          mensaje_id: mensajeId, user_id: RK.user.id, sticker_url: content
        }).select('id').single();
        if (data) {
          const idx = m.mensajes_reacciones.findIndex(r => r.id === tempId);
          if (idx >= 0) m.mensajes_reacciones[idx].id = data.id;
        }
      }
    }

    // Re-render reactions for this message
    const row = document.querySelector(`.rkw-msg-row[data-id="${mensajeId}"]`);
    if (row) addReactionsToRow(row, m);
  }

  function showReactionPicker(row, m) {
    document.querySelectorAll('.rkw-reaction-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className = 'rkw-reaction-picker';

    // ── Build HTML ──
    let html = '';

    // Search input
    html += '<div class="rkw-rp-search-wrap"><input class="rkw-rp-search" type="text" placeholder="Buscar emoji..." autocomplete="off"></div>';

    // Recent emojis
    const recent = getRecentEmojis();
    if (recent.length > 0) {
      html += '<div class="rkw-rp-section rkw-rp-recent"><div class="rkw-rp-label">Recientes</div><div class="rkw-rp-grid">';
      recent.slice(0, 8).forEach(e => {
        html += `<span class="rkw-rp-item" data-type="emoji" data-content="${e}">${e}</span>`;
      });
      html += '</div></div>';
    }

    // Common emojis (default 8)
    const commonEmojis = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE2E', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDD25', '\uD83D\uDC4F', '\uD83D\uDCA1'];
    html += '<div class="rkw-rp-section rkw-rp-common"><div class="rkw-rp-label">Comunes</div><div class="rkw-rp-grid">';
    commonEmojis.forEach(e => {
      html += `<span class="rkw-rp-item" data-type="emoji" data-content="${e}">${e}</span>`;
    });
    html += '</div></div>';

    // Search results (hidden by default)
    html += '<div class="rkw-rp-section rkw-rp-results" style="display:none;"><div class="rkw-rp-label">Resultados</div><div class="rkw-rp-grid rkw-rp-results-grid"></div></div>';

    // Stickers
    if (RK.favStickers && RK.favStickers.length > 0) {
      html += '<div class="rkw-rp-stickers">';
      RK.favStickers.slice(0, 8).forEach(s => {
        html += `<span class="rkw-rp-item" data-type="sticker" data-content="${s.replace(/"/g, '&quot;')}"><img src="${s}" class="rkw-rp-sticker-img"></span>`;
      });
      html += '</div>';
    }

    picker.innerHTML = html;

    // ── Position ──
    const rect = row.getBoundingClientRect();
    const msgsContainer = document.getElementById('rkwMessages');
    const containerRect = msgsContainer?.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.left = Math.min(rect.right - 180, (containerRect?.right || window.innerWidth) - 260) + 'px';
    picker.style.top = (rect.top - 50) + 'px';
    document.body.appendChild(picker);
    ensureTwemoji(() => twemoji.parse(picker));

    // ── Close handler ──
    const removePicker = () => {
      picker.classList.add('closing');
      picker.style.pointerEvents = 'none';
      setTimeout(() => picker.remove(), 120);
    };

    // ── Search logic ──
    const searchInput = picker.querySelector('.rkw-rp-search');
    const resultsSection = picker.querySelector('.rkw-rp-results');
    const resultsGrid = picker.querySelector('.rkw-rp-results-grid');
    const recentSection = picker.querySelector('.rkw-rp-recent');
    const commonSection = picker.querySelector('.rkw-rp-common');

    function doSearch() {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        resultsSection.style.display = 'none';
        if (recentSection) recentSection.style.display = '';
        if (commonSection) commonSection.style.display = '';
        return;
      }
      if (recentSection) recentSection.style.display = 'none';
      if (commonSection) commonSection.style.display = 'none';
      resultsSection.style.display = '';

      const matches = [];
      for (const entry of EMOJI_DATA) {
        if (entry.e === q || entry.k.some(kw => kw.includes(q))) {
          matches.push(entry.e);
          if (matches.length >= 40) break;
        }
      }

      resultsGrid.innerHTML = '';
      if (matches.length === 0) {
        resultsGrid.innerHTML = '<div class="rkw-rp-empty">Sin resultados</div>';
      } else {
        matches.forEach(e => {
          const span = document.createElement('span');
          span.className = 'rkw-rp-item';
          span.dataset.type = 'emoji';
          span.dataset.content = e;
          span.textContent = e;
          span.addEventListener('click', (ev) => {
            ev.stopPropagation();
            toggleReaction(m.id, 'emoji', e);
            removePicker();
          });
          resultsGrid.appendChild(span);
        });
      }
      ensureTwemoji(() => twemoji.parse(resultsGrid));
    }

    searchInput.addEventListener('input', doSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = resultsGrid.querySelector('.rkw-rp-item');
        if (first) first.click();
      }
      if (e.key === 'Escape') {
        if (searchInput.value) {
          searchInput.value = '';
          doSearch();
        } else {
          removePicker();
        }
      }
    });

    setTimeout(() => searchInput.focus(), 0);

    // ── Item clicks ──
    picker.querySelectorAll('.rkw-rp-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleReaction(m.id, item.dataset.type, item.dataset.content);
        removePicker();
      });
    });

    // ── Close on outside click ──
    const closePicker = (e) => {
      if (!picker.contains(e.target)) {
        removePicker();
        document.removeEventListener('click', closePicker);
      }
    };
    setTimeout(() => document.addEventListener('click', closePicker), 0);
  }

  // ── Realtime ──────────────────────────────────────────
  function subscribeRealtime(ch) {
    if (RK.realtimeSub) {
      RK.realtimeSub.unsubscribe();
      RK.realtimeSub = null;
    }
    const cfg = { event: "INSERT", schema: "public", table: "mensajes" };
    const filter = buildRealtimeFilter(ch); if (filter) cfg.filter = filter;
    RK.realtimeSub = RK.sb.channel(`rk-chat-${ch.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, payload => {
        const p = payload.payload;
        if (!p || p.uid === RK.user?.id) return;
        if (!RK.typingUsers[ch.id]) RK.typingUsers[ch.id] = {};
        const users = RK.typingUsers[ch.id];
        if (users[p.uid]) clearTimeout(users[p.uid].timeout);
        users[p.uid] = {
          alias: p.alias, avatar: p.avatar,
          timeout: setTimeout(() => {
            delete users[p.uid];
            renderTypingIndicator(ch.id);
          }, 3000)
        };
        renderTypingIndicator(ch.id);
      })
      .on("postgres_changes", cfg, async payload => {
        const { data: full } = await RK.sb.from("mensajes")
          .select("id,contenido,created_at,user_id,reply_to_id,reply_preview,usuarios(alias,foto_url,color_alias,fuente_alias),mensajes_reacciones(emoji,sticker_url,user_id)")
          .eq("id", payload.new.id).single();
        if (!full) return;
        if (RK.msgCache[ch.id]) RK.msgCache[ch.id].push(full);
        else RK.msgCache[ch.id] = [full];
        appendMessage(full, ch.id);
        if (RK.autoScroll) scrollToBottom(); else updateScrollBtn();
      })
      // Reacciones en tiempo real (INSERT/DELETE)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes_reacciones" }, async payload => {
        const mensajeId = payload.new?.mensaje_id || payload.old?.mensaje_id;
        if (!mensajeId) return;
        const cache = RK.msgCache[ch.id];
        if (!cache) return;
        const mIdx = cache.findIndex(x => x.id === mensajeId);
        if (mIdx < 0) return;
        // Re-fetch message to get updated reactions array
        const { data: refreshed } = await RK.sb.from("mensajes")
          .select("id,contenido,created_at,user_id,reply_to_id,reply_preview,usuarios(alias,foto_url,color_alias,fuente_alias),mensajes_reacciones(emoji,sticker_url,user_id)")
          .eq("id", mensajeId).single();
        if (refreshed) {
          cache[mIdx].mensajes_reacciones = refreshed.mensajes_reacciones || [];
          const row = document.querySelector(`.rkw-msg-row[data-id="${mensajeId}"]`);
          if (row) addReactionsToRow(row, cache[mIdx]);
        }
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Reikanales] Realtime error en canal ${ch.id}, reintentando en 5s...`);
          setTimeout(() => subscribeRealtime(ch), 5000);
        }
      });
  }

  function buildRealtimeFilter(ch) {
    switch (ch.tipo) {
      case "proyecto": return `proyecto_id=eq.${ch.ref_id}`;
      case "seccion": return `seccion_id=eq.${ch.ref_id}`;
      case "escena": return `escena_id=eq.${ch.ref_id}`;
      case "concepto": return `concepto_id=eq.${ch.ref_id}`;
      default: return `proyecto_id=is.null&seccion_id=is.null&escena_id=is.null&concepto_id=is.null`;
    }
  }

  function subscribeGlobalNotifications() {
    if (RK.globalRealtimeSub) return;
    RK.globalRealtimeSub = RK.sb.channel("rk-global-noti", { config: { presence: { key: RK.user.id } } })
      .on("presence", { event: "sync" }, () => {
        const state = RK.globalRealtimeSub.presenceState();
        RK.onlineUsers.clear();
        for (const id in state) RK.onlineUsers.add(id);
        if (RK.membersPanelOpen) loadAndRenderMembers();
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        if (!newPresences) return;
        newPresences.forEach(p => RK.onlineUsers.add(p.presence_ref || ""));
        if (RK.membersPanelOpen) loadAndRenderMembers();
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        if (!leftPresences) return;
        leftPresences.forEach(p => RK.onlineUsers.delete(p.presence_ref || ""));
        if (RK.membersPanelOpen) loadAndRenderMembers();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, payload => {
        const m = payload.new;
        if (m.user_id === RK.user?.id) return;

        let chId = "general";
        if (m.concepto_id) chId = `concepto-${m.concepto_id}`;
        else if (m.escena_id) chId = `escena-${m.escena_id}`;
        else if (m.seccion_id) chId = `seccion-${m.seccion_id}`;
        else if (m.proyecto_id) chId = `proyecto-${m.proyecto_id}`;

        if (!RK.channels.some(c => c.id === chId)) return;

        let isMention = false;
        if (RK.userAlias && m.contenido && typeof m.contenido === "string") {
          const lower = m.contenido.toLowerCase();
          isMention = lower.includes('@' + RK.userAlias.toLowerCase()) || lower.includes('@' + RK.userAlias.split(' ')[0].toLowerCase());
        }

        const win = document.getElementById("rkChatWindow");
        const isMinimized = win && win.classList.contains("rkw--minimized");

        if (RK.windowOpen && !isMinimized && RK.activeChannel?.id === chId) {
          if (isMention) {
            if (RK.notiTimeout) { clearTimeout(RK.notiTimeout); RK.notiTimeout = null; }
            playNotiSound();
          }
          return;
        }

        triggerNotification(isMention);
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await RK.globalRealtimeSub.track({ online_at: new Date().toISOString() });
        }
      });
  }

  function triggerNotification(overrideCooldown = false) {
    document.querySelectorAll(".sidebar-item").forEach(btn => {
      if (btn.textContent.includes("Reikanales")) {
        if (!btn.querySelector(".rk-noti-dot")) {
          const dot = document.createElement("div");
          dot.className = "rk-noti-dot";
          Object.assign(dot.style, {
            position: "absolute", top: "12px", right: "12px",
            width: "10px", height: "10px", background: "#db6f4e",
            borderRadius: "50%", boxShadow: "0 0 5px rgba(219,111,78,0.8)"
          });
          if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
          btn.appendChild(dot);
        }
      }
    });

    const win = document.getElementById("rkChatWindow");
    if (win && win.classList.contains("rkw--minimized")) {
      if (!win.querySelector(".rk-bubble-noti-dot")) {
        const bd = document.createElement("div");
        bd.className = "rk-bubble-noti-dot";
        Object.assign(bd.style, {
          position: "absolute", top: "-2px", right: "-2px",
          width: "12px", height: "12px", background: "#db6f4e",
          borderRadius: "50%", boxShadow: "0 0 5px rgba(219,111,78,0.8)",
          zIndex: "10"
        });
        win.appendChild(bd);
      }
    }

    const now = Date.now();
    if (overrideCooldown || now - RK.lastNotiTime > 20000) {
      if (RK.notiTimeout) { clearTimeout(RK.notiTimeout); RK.notiTimeout = null; }
      playNotiSound();
    } else {
      if (!RK.notiTimeout) {
        RK.notiTimeout = setTimeout(playNotiSound, 20000 - (now - RK.lastNotiTime));
      }
    }
  }

  function playNotiSound() {
    RK.lastNotiTime = Date.now();
    RK.notiTimeout = null;
    const a = new Audio("sounds/noti.mp3");
    a.volume = 0.5;
    a.play().catch(() => {});
  }

  function clearNotification() {
    document.querySelectorAll(".rk-noti-dot, .rk-bubble-noti-dot").forEach(d => d.remove());
    if (RK.notiTimeout) {
      clearTimeout(RK.notiTimeout);
      RK.notiTimeout = null;
    }
  }

  function renderTypingIndicator(chId) {
    const wrap = document.getElementById("rkwTypingWrap");
    if (!wrap) return;
    if (RK.activeChannel?.id !== chId) return;
    const users = Object.values(RK.typingUsers[chId] || {});
    if (users.length === 0) {
      window.ANIM.hide(wrap, 'anim-fade-out');
      wrap.innerHTML = "";
      return;
    }
    const html = users.map(u => {
      const inner = u.avatar ? `<img src="${u.avatar}">` : (u.alias[0]||"?").toUpperCase();
      return `<div class="rkw-typing-avatar" title="${u.alias} está escribiendo...">${inner}</div>`;
    }).join("");
    wrap.innerHTML = html + `<div class="rkw-typing-dots"><span></span><span></span><span></span></div>`;
    window.ANIM.show(wrap, 'anim-slide-up');
    if (RK.autoScroll) scrollToBottom();
  }

  // ── Helpers ───────────────────────────────────────────
  function scrollToBottom() { const msgs = document.getElementById("rkwMessages"); if (msgs) msgs.scrollTop = msgs.scrollHeight; }

  function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
  }

  function formatMentions(htmlStr) {
    return htmlStr.replace(/@([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)(?:\s|$)/gi, (match, alias) => {
      let isMe = false;
      if (RK.userAlias) {
        const uAlias = RK.userAlias.toLowerCase();
        const uFirst = uAlias.split(' ')[0];
        const matchLower = alias.toLowerCase();
        isMe = (matchLower === uAlias || matchLower === uFirst);
      }
      return `<span class="rkw-mention${isMe ? ' rkw-mention-me' : ''}">@${alias}</span>${match.endsWith(' ') ? ' ' : ''}`;
    });
  }

  function showRKToast(msg) {
    if (window.showToast) { window.showToast(msg); return; }
    let t = document.getElementById("rk-mini-toast");
    if (!t) { t = document.createElement("div"); t.id = "rk-mini-toast"; Object.assign(t.style, { position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", padding: "8px 18px", borderRadius: "10px", fontFamily: "sans-serif", fontSize: "13px", color: "white", zIndex: "99999", pointerEvents: "none", transition: "opacity .4s" }); document.body.appendChild(t); }
    t.textContent = msg; t.style.background = msg.startsWith("✖") ? "#b03030" : "#2e7d50"; t.style.opacity = "1";
    clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = "0"; }, 2800);
  }

  // ── Expose ────────────────────────────────────────────
  window.RKCanales = { init, openChannel, toggleWindow, loadChannels, getStickers: () => RK.globalStickers };

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { setTimeout(init, 200); }

})();

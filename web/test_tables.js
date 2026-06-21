
(async () => {
  const RK = { sb: window.supabaseClient };
  if (!RK.sb) { console.error("No Supabase client"); return; }
  
  const tables = ["stickers_predeterminados", "stickers_global", "stickers"];
  for (const t of tables) {
    const { data, error } = await RK.sb.from(t).select("id").limit(1);
    if (!error) {
      console.log(`Table ${t} exists!`);
    } else {
      console.log(`Table ${t} does not exist or error: ${error.message}`);
    }
  }
})();

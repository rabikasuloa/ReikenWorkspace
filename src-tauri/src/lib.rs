use std::env;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct SessionData {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub user_email: String,
    pub user_rol: String,
}

#[tauri::command]
fn get_session() -> Option<SessionData> {
    let access_token = env::var("RK_ACCESS_TOKEN").ok()?;
    Some(SessionData {
        access_token,
        refresh_token: env::var("RK_REFRESH_TOKEN").unwrap_or_default(),
        user_id: env::var("RK_USER_ID").unwrap_or_default(),
        user_email: env::var("RK_USER_EMAIL").unwrap_or_default(),
        user_rol: env::var("RK_USER_ROL").unwrap_or_default(),
    })
}

#[tauri::command]
fn set_zoom(app: tauri::AppHandle, factor: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&format!("document.body.style.zoom = '{}'", factor));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_session, set_zoom])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

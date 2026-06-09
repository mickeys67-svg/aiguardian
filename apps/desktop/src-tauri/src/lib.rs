mod fileio;
mod inspector;
mod installer;
mod learning;
mod mcp;
mod recipes;
mod safety;
mod storage;

use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // dev 환경 Win 에서 WebView2 user-data 충돌 회피 — 다른 앱과 격리.
    #[cfg(all(target_os = "windows", debug_assertions))]
    {
        let dir = std::env::temp_dir().join("tg-webview-dev");
        let _ = std::fs::create_dir_all(&dir);
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &dir);
    }

    if let Err(err) = storage::init() {
        tracing::error!(?err, "storage init failed; falling back to in-memory only");
    }

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(not(debug_assertions))]
    {
        // 엔드포인트·pubkey 는 tauri.conf.json 의 plugins.updater 에서 읽는다.
        // (플러그인 Builder 에는 .endpoints() 가 없다 — v2.10 API. 런타임 UpdaterBuilder 와 혼동된 옛 코드.)
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            inspector::inspect_environment,
            installer::install_tool,
            installer::dry_run,
            mcp::register_mcp,
            mcp::check_mcp,
            recipes::list_recipes,
            recipes::run_recipe_step,
            learning::track_term,
            learning::learning_progress,
            fileio::write_file,
            fileio::read_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TG");
}

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
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
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
        let updater = tauri_plugin_updater::Builder::new()
            .endpoints(vec![
                "https://tg-backend.mickeys67.workers.dev/updates/{{target}}/{{current_version}}"
                    .parse()
                    .expect("valid updater URL"),
            ])
            .expect("updater endpoints")
            .pubkey("dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDJFNDJBRUI3NTlFQTgxMDAKUldRQWdlcFp0NjVDTHZieTRPalZIN3F4bVZMNHlmbkltVmt4NUhwQ0V1RVY2NFdyeUhLWXNWV2cK")
            .build();
        builder = builder.plugin(updater);
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

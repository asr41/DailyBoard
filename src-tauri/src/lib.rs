#[cfg_attr(mobile, tauri::mobile_entry_point)]

//contents of other files that are part of the program's crate
mod task;
mod manager;
mod category;
mod settings;
pub mod commands; //public so builder can see the functions


//rust ownership => only one person can write at a time
//app multiple thrades need to talk to Manager at once.
//Mutex is hall pass allows for sharing but data inside stays locked
//change task a thread must call .lock() (has an access queue)
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::Manager as _;
use crate::manager::Manager;

pub struct AppState {
  pub manager: Mutex<Manager>,
  //we are allowing path to be changed
  pub save_path: Mutex<PathBuf>,
  pub config_path: PathBuf,
}

pub fn run() {

  //Builder is assembly line, manage is telling Tauri to take AppState and keep it
  //in global 'backpack' for front end commands to access as necessary.
  tauri::Builder::default()
  .plugin(tauri_plugin_dialog::init())
  .setup(|app| {
    let default_path = app.path().app_data_dir()?.join("DailyBoard.json");
    let config_path = app.path().app_data_dir()?.join("config.json");

    let save_path = if config_path.exists() {
      let s = std::fs::read_to_string(&config_path)?;
      let v: serde_json::Value = serde_json::from_str(&s)?;
        v["data_path"].as_str().map(PathBuf::from).unwrap_or(default_path)
    } else {
        default_path
    };

    let mut manager = Manager::load_from_file(&save_path).unwrap_or_else(|_| Manager::new());
    manager.check_and_reset_recurring_tasks();
    manager.check_due_date_promotions();
    manager.apply_auto_clear();
    app.manage(AppState {
      manager: Mutex::new(manager),
      save_path:Mutex::new(save_path),
      config_path:config_path,
    });

    Ok(())
  })
  
  //control panel to connect front end to commands
  .invoke_handler(tauri::generate_handler![
    commands::refresh_and_get_data,
    commands::get_all_data,
    commands::add_task,
    commands::update_task,
    commands::update_tasks,
    commands::update_archived_task,
    commands::update_archived_tasks,
    commands::delete_tasks,
    commands::add_category,
    commands::rename_category,
    commands::reorder_categories,
    commands::delete_categories,
    commands::archive_categories,
    commands::unarchive_categories,
    commands::move_categories_to_group,
    commands::create_group,
    commands::rename_group,
    commands::delete_group,
    commands::update_settings,
    commands::update_settings,
    commands::get_storage_path,
    commands::export_board,
    commands::import_board,
    commands::change_storage_location,
  ])

  //run() blocks the current thread until the application is finished.
  .run(tauri::generate_context!())
  .expect("error while running tauri application")
}

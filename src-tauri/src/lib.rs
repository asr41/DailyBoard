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
  pub save_path: PathBuf,
}

pub fn run() {

  //Builder is assembly line, manage is telling Tauri to take AppState and keep it
  //in global 'backpack' for front end commands to access as necessary.
  tauri::Builder::default()
  

  .setup(|app| {
    let mut save_path = app.path().app_data_dir()?;

    //create directory if necessary
    std::fs::create_dir_all(&save_path)?;

    save_path.push("DailyBoard.json");

    let mut manager = Manager::load_from_file(save_path.to_str().unwrap()).unwrap_or_else(|_| Manager::new());
    manager.check_and_reset_recurring_tasks();
    manager.check_due_date_promotions();
    manager.apply_auto_clear();
    app.manage(AppState {
      manager: Mutex::new(manager),
      save_path:save_path,
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
  ])

  //run() blocks the current thread until the application is finished.
  .run(tauri::generate_context!())
  .expect("error while running tauri application")
}

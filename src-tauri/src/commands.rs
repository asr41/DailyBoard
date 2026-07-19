use tauri::State as TauriState;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use crate::task::{Task};
use crate::category::{Category, Group};
use crate::settings::{Settings};
use crate::manager::{TaskUpdate, Manager};
use crate::AppState; //in main.rs
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppData {
    not_started: Vec<Task>,
    in_progress: Vec<Task>,
    visible_completed: Vec<Task>,// hide_completed_delay filters for main page
    completed: Vec<Task>, // all completed task for the completed page 
    archived: Vec<Task>,
    categories: Vec<Category>,
    groups: Vec<Group>,
    settings: Settings,
}

#[tauri::command]
//periodic refresh after startup
pub fn refresh_and_get_data(state: TauriState<AppState>) -> AppData{
    //lock to read form manager, unwrap incase previous thread didnt crash while holding lock 
    //unwrap => expect a helthy mutext (not poisened by some panic) if not panic
    let mut manager = state.manager.lock().unwrap();

    manager.check_and_reset_recurring_tasks();
    manager.check_due_date_promotions();
    manager.apply_auto_clear();

    //save_to_file takes path: &str 
    //unwarp proper UTF-8 converted into string or panic
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }

    AppData {
        not_started: manager.get_not_started(),
        in_progress: manager.get_in_progress(),
        visible_completed: manager.get_visible_completed(),
        completed: manager.get_completed(),
        archived: manager.get_archived(),
        categories: manager.get_categories(),
        groups: manager.get_groups(),
        settings: manager.get_settings().clone(),
    }
}

#[tauri::command]
pub fn get_all_data(state: TauriState<AppState>) -> AppData{
    let manager = state.manager.lock().unwrap(); //display doesnt need mut
    AppData {
        not_started: manager.get_not_started(),
        in_progress: manager.get_in_progress(),
        visible_completed: manager.get_visible_completed(),
        completed: manager.get_completed(),
        archived: manager.get_archived(),
        categories: manager.get_categories(),
        groups: manager.get_groups(),
        settings: manager.get_settings().clone(),
    }
}

#[tauri::command]
pub fn add_task(state: TauriState<AppState>, name: String, category_id: Uuid, description: String) {
    let mut manager = state.manager.lock().unwrap();
    manager.add_task(name, category_id, description);
    //save_to_file takes path: &str 
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}
#[tauri::command]
pub fn update_task(state: TauriState<AppState>, id: Uuid, update: TaskUpdate) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_task(id, update);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_tasks(state: TauriState<AppState>, ids: Vec<Uuid>, update: TaskUpdate)-> usize {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_tasks(&ids, update);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_archived_task(state: TauriState<AppState>,id: Uuid, update: TaskUpdate) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_archived_task(id, update);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_archived_tasks(state: TauriState<AppState>, ids: Vec<Uuid>, update: TaskUpdate) -> usize {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_archived_tasks(&ids, update);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_tasks(state: TauriState<AppState>, ids: Vec<Uuid>){
    let mut manager = state.manager.lock().unwrap();
    manager.delete_tasks(&ids);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn add_category	(state: TauriState<AppState>, name: String) -> Category {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.add_category(name);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn rename_category(state: TauriState<AppState>,	id: Uuid, name: String) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.rename_category(id, name);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn reorder_categories(state: TauriState<AppState>, ordered_ids: Vec<Uuid>) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.reorder_categories(&ordered_ids);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.delete_categories(&ids);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn archive_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.archive_categories(&ids);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn unarchive_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.unarchive_categories(&ids);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn move_categories_to_group(state: TauriState<AppState>, ids: Vec<Uuid>, group_id: Option<Uuid>) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.move_categories_to_group(&ids, group_id);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn create_group(state: TauriState<AppState>, name: String)->Group {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.create_group(name);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn rename_group(state: TauriState<AppState>,id: Uuid, name: String)->Result<(), String>{
    let mut manager = state.manager.lock().unwrap();
    let result = manager.rename_group(id, name);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_group(state: TauriState<AppState>, id: Uuid){
    let mut manager = state.manager.lock().unwrap();
    manager.delete_group(id);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn update_settings(state: TauriState<AppState>, settings: Settings) {
    let mut manager = state.manager.lock().unwrap();
    manager.update_settings(settings);
    let path = {
        let save_path = state.save_path.lock().unwrap();
        save_path.clone()
    };

    match manager.save_to_file(&path){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn get_storage_path(state: TauriState<AppState>) -> Result<String, String>{
  //return the current data directory as a path string
  let path = state.save_path.lock().unwrap();

  //we actually want to return the parent done waht the dailyboard.json part
  //and then expects an Option which .to_str() outputs (no need to unwrap again)
  //However to_str is Option(&str) we need Option(String) so hence the map.
  path.parent().and_then(|p| p.to_str()).map(|s| s.to_string())
    .ok_or_else(|| "Could not get path".to_string())

}

#[tauri::command]
pub fn export_board(state: TauriState<AppState>, export_path: String) -> Result<(), String> {
    let manager = state.manager.lock().unwrap(); //no need to mut
    manager.save_to_file(Path::new(&export_path)).map_err(|e| format!("Failed to export: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn import_board(state: TauriState<AppState>, import_path: String)-> Result<(), String>  {
    let import: Manager = Manager::load_from_file(Path::new(&import_path))
        .map_err(|e| format!("Failed to import: {e}"))?;
    let save_path = state.save_path.lock().unwrap().clone();

    let mut manager = state.manager.lock().unwrap();
     
    //need to replace the in memory state
    *manager = import;

    //save_path.lock().unwrap() is a MutexGaurd<PathBuf> so need as_path to save_to_file
    manager.save_to_file(save_path.as_path()).map_err(|e| format!("Failed to save: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn change_storage_location(state: TauriState<AppState>, chosen_folder: String) -> Result<(), String>{

    let folder_path = PathBuf::from(chosen_folder);

    if !folder_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !folder_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    let new_path = folder_path.join("DailyBoard.json");

    //by doing .clone and ending the statement the temp MutexGaurd drops immmediatly not held.
    let old_path = state.save_path.lock().unwrap().clone();

    //copy data file to new location
    std::fs::copy(&old_path, &new_path)
        .map_err(|e| format!("Failed to copy to new location: {e}"))?;

    //we write the config so next launch the app knows where to look
    let config = serde_json::json!({ "data_path": new_path.to_str().unwrap()});

    std::fs::write(&state.config_path, config.to_string())
        .map_err(|e| format!("Failed to write config: {e}"))?;

    //finally update the runtime path
    *state.save_path.lock().unwrap() = new_path;
    Ok(())
}
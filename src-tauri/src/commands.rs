use tauri::State as TauriState;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use crate::task::{Task};
use crate::category::{Category, Group};
use crate::settings::{Settings};
use crate::manager::{TaskUpdate};
use crate::AppState; //in main.rs

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
    match manager.save_to_file(state.save_path.to_str().unwrap()){
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
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}
#[tauri::command]
pub fn update_task(state: TauriState<AppState>, id: Uuid, update: TaskUpdate) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_task(id, update);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_tasks(state: TauriState<AppState>, ids: Vec<Uuid>, update: TaskUpdate)-> usize {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_tasks(&ids, update);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_archived_task(state: TauriState<AppState>,id: Uuid, update: TaskUpdate) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_archived_task(id, update);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn update_archived_tasks(state: TauriState<AppState>, ids: Vec<Uuid>, update: TaskUpdate) -> usize {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.update_archived_tasks(&ids, update);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_tasks(state: TauriState<AppState>, ids: Vec<Uuid>){
    let mut manager = state.manager.lock().unwrap();
    manager.delete_tasks(&ids);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn add_category	(state: TauriState<AppState>, name: String) -> Category {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.add_category(name);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn rename_category(state: TauriState<AppState>,	id: Uuid, name: String) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.rename_category(id, name);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn reorder_categories(state: TauriState<AppState>, ordered_ids: Vec<Uuid>) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.reorder_categories(&ordered_ids);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.delete_categories(&ids);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn archive_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.archive_categories(&ids);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn unarchive_categories(state: TauriState<AppState>, ids: Vec<Uuid>) {
    let mut manager = state.manager.lock().unwrap();
    manager.unarchive_categories(&ids);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn move_categories_to_group(state: TauriState<AppState>, ids: Vec<Uuid>, group_id: Option<Uuid>) -> Result<(), String> {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.move_categories_to_group(&ids, group_id);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn create_group(state: TauriState<AppState>, name: String)->Group {
    let mut manager = state.manager.lock().unwrap();
    let result = manager.create_group(name);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn rename_group(state: TauriState<AppState>,id: Uuid, name: String)->Result<(), String>{
    let mut manager = state.manager.lock().unwrap();
    let result = manager.rename_group(id, name);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
    result
}

#[tauri::command]
pub fn delete_group(state: TauriState<AppState>, id: Uuid){
    let mut manager = state.manager.lock().unwrap();
    manager.delete_group(id);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

#[tauri::command]
pub fn update_settings(state: TauriState<AppState>, settings: Settings) {
    let mut manager = state.manager.lock().unwrap();
    manager.update_settings(settings);
    match manager.save_to_file(state.save_path.to_str().unwrap()){
        Ok(()) =>{},
        Err(e) => eprintln!("Failed to save: {e}"),
    }
}

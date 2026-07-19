use crate::task::{Task, State, RecurrenceUnit, Priority};
use std::collections::HashSet;
use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};
use crate::category::{Category, Group, CategoryStatus};
use crate::settings::{Settings, HideCompletedPolicy };
use serde::{Serialize, Deserialize};
use std::fs::File;
use std::io::{Write, Read};
use std::error::Error;
use uuid::Uuid;
use std::path::{Path};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct RecurrenceInput{
    pub(crate) interval: u32,
    pub(crate) unit: RecurrenceUnit,
    pub(crate) start_date: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(default)]//That field isnt in the JSON? I'll use its default value.
pub(crate) struct TaskUpdate {
    pub(crate) name: Option<String>,
    pub(crate) category_id: Option<Uuid>,
    pub(crate) description: Option<String>,
    pub(crate) state: Option<State>,
    pub(crate) due_date: Option<DateTime<Utc>>,
    pub(crate) remove_due_date: Option<bool>,
    pub(crate) recurrence: Option<RecurrenceInput>,
    pub(crate) remove_recurrence: Option<bool>,
    pub(crate) priority: Option<Priority>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Manager {
    // NotStarted, InProgress, Completed all the live tasks
    tasks: Vec<Task>,
    //Tasks the user may have given up (doesnt want to look at cluttering up the Active)
    archived: Vec<Task>,

    categories: Vec<Category>,

    groups: Vec<Group>,

    settings: Settings,
    
    next_color_index: u64,

}
impl Manager {
    pub(crate) fn new() -> Self {
        Self {
            tasks: Vec::new(),
            archived: Vec::new(),
            categories: Vec::new(),
            groups: Vec::new(),
            settings: Settings::new(),
            next_color_index: 0,

        }
    }

    pub(crate) fn save_to_file(&self, path: &Path) -> Result<(), Box<dyn Error>> {
        //typically use to_strign for sending to UI, to_string_pretty is formated and human readable.
        // the quesiton mark is an if opertaion failed immediatly return error from this func
        let json = serde_json::to_string_pretty(self)?;
        //for i/o (files) pointer instide file object thus needs to be mutable unlike for vectors
        let mut file = File::create(path)?;
        file.write_all(json.as_bytes())?;
        Ok(())
    }

    pub(crate) fn load_from_file(path: &Path) -> Result<Self, Box<dyn Error>> {
        let mut file = File::open(path)?;
        let mut contents = String::default();
        file.read_to_string(&mut contents)?;
        
        let manager: Manager = serde_json::from_str(&contents)?;
        Ok(manager)
    }

    // the imp Into<String> allows u to pass "Work" , cause this is actually a &str,
    // instead of String::from("Work").
    // Could be called from startup logic or tests with literals (so useful)
    // but not usefull if only caller is tauri command chas Tauri serializes into string
    pub(crate) fn add_task(&mut self, name: impl Into<String>, category_id: Uuid, description: impl Into<String>){
        let t = Task::new(name.into(), category_id, description.into());
        self.tasks.push(t);
    }

    pub(crate) fn update_task(&mut self, id: Uuid, update: TaskUpdate) -> Result<(), String> {

        if let Some(index) = self.tasks.iter().position(|task| task.id() == id) {
            self.update_task_at_index(index, update.clone(), false);
            self.refresh();
            return Ok(());
        }
        Err(format!("Warning: Attempted update but task {} but it was not found.", id))
    }

    //multiselect handling, returns the number of updates
    pub(crate) fn update_tasks(&mut self, ids: &[Uuid], update: TaskUpdate) -> usize {
        let mut updated = 0;

        //small selection: Vec::contains is faster
        if ids.len() <= 16 {
            //iterating in reverse since swaps can messup
            for index in (0..self.tasks.len()).rev(){
                if ids.contains(&self.tasks[index].id()){
                    if self.update_task_at_index(index, update.clone(), false) {
                        updated += 1;
                    }
                }
            }
        }
        //hashset is faster lookup for larger selection
        else {
            let selected: HashSet<Uuid> = ids.iter().copied().collect();
            for index in (0..self.tasks.len()).rev(){
                if selected.contains(&self.tasks[index].id()){
                    if self.update_task_at_index(index, update.clone(), false) {
                        updated += 1;
                    }
                }
            }
        }
        self.refresh();
        updated
    }


    fn update_task_at_index(&mut self, index: usize, update: TaskUpdate, is_archived: bool) -> bool {

        let task: &mut Task =if is_archived {
            &mut self.archived[index]
        }else{
            &mut self.tasks[index]
        };

        if let Some(name) = update.name {
            task.set_name(name);
        }

        if let Some(category_id) = update.category_id {
            task.set_category_id(category_id);
        }

        if let Some(description) = update.description {
            task.set_description(description);
        }

        if is_archived{
            if let Some(state) = update.state {
                match state {
                    State::NotStarted => {
                        let mut archived_task = self.archived.swap_remove(index);
                        archived_task.mark_not_started();
                        self.tasks.push(archived_task);
                    },
                    State::InProgress { .. } => {
                        let mut archived_task = self.archived.swap_remove(index);
                        archived_task.mark_not_started();
                        self.tasks.push(archived_task);
                    },
                    State::Completed { .. } => {
                        let mut archived_task = self.archived.swap_remove(index);
                        archived_task.mark_completed();
                        self.tasks.push(archived_task);
                    },
                    State::Archived { .. } => {}
                }
            }
            return true;
        }

        // Archive is special because ownership changes.
        //Archived placed here because technically can change name, cat_id and description before archive
        if matches!(update.state, Some(State::Archived { .. })) {
            let mut task = self.tasks.swap_remove(index);
            task.mark_archived();
            self.archived.push(task);
            return true;
        }

        if let Some(priority) = update.priority {
            task.set_priority_manual(priority);
        }

        if let Some(due_date) = update.due_date {
            task.set_due_date(due_date);
        }

        if update.remove_due_date == Some(true){
            task.remove_due_date();
        }

        if let Some(recurrence) = update.recurrence {
            if let Err(_) = task.set_recurrence(recurrence.interval, recurrence.unit, recurrence.start_date) { 
                eprintln!("Unable to update recurrence"); 
            }
        }

        if update.remove_recurrence == Some(true){
            {task.remove_recurrence();}
        }

        if let Some(state) = update.state {
            match state {
                State::NotStarted => task.mark_not_started(),
                State::InProgress { .. } => task.mark_in_progress(),
                State::Completed { .. } => task.mark_completed(),

                // Already handled above.
                State::Archived { .. } => unreachable!(),
            }
        }
        true
    }

    pub(crate) fn update_archived_task(&mut self, id: Uuid, update: TaskUpdate) -> Result<(), String> {

        if let Some(index) = self.archived.iter().position(|task| task.id() == id) {
            self.update_task_at_index(index, update.clone(), true);
            return Ok(())
        }
        Err(format!("Warning: Attempted update but task {} but it was not found.", id))
    }
    

     //multiselect handling, returns the number of updates
    pub(crate) fn update_archived_tasks(&mut self, ids: &[Uuid], update: TaskUpdate) -> usize {
        let mut updated = 0;

        //small selection: Vec::contains is faster
        if ids.len() <= 16 {
            //iterating in reverse since swaps can messup
            for index in (0..self.archived.len()).rev(){
                if ids.contains(&self.archived[index].id()){
                    if self.update_task_at_index(index, update.clone(), true) {
                        updated += 1;
                    }
                }
            }
        }
        //hashset is faster lookup for larger selection
        else {
            let selected: HashSet<Uuid> = ids.iter().copied().collect();
            for index in (0..self.archived.len()).rev(){
                if selected.contains(&self.archived[index].id()){
                    if self.update_task_at_index(index, update.clone(), true) {
                        updated += 1;
                    }
                }
            }
        }

        updated
    }

    /*

    remember that If u pass a slice then it locks in rust you cant make changes
    till released. so employ render(manager.get_not_started()); // The borrow starts and ends right here.
    manager.add_task(...); 
    
    But in tauri there is a different way:
    Arc<Mutex<Manager>>
    
    */

    pub(crate) fn get_not_started(&self) -> Vec<Task> {
        self.tasks.iter()
        .filter(|task|matches!(task.state(), State::NotStarted))
        .cloned()
        .collect()
    }

    pub(crate) fn get_in_progress(&self) -> Vec<Task> {
        self.tasks.iter()
        .filter(|task|matches!(task.state(), State::InProgress { .. }))
        .cloned()
        .collect()
    }

    pub(crate) fn get_visible_completed(&self) -> Vec<Task> {
        let duration = match self.settings.hide_completed_delay() {
            HideCompletedPolicy::Immediately => return Vec::new(),
            HideCompletedPolicy::AfterHours{num_hours} => Duration::hours(num_hours as i64),
            HideCompletedPolicy::AfterDays{num_days} => Duration::days(num_days as i64),
        };

        let cutoff = Utc::now()- duration;

        self.tasks
            .iter()
            .filter(|task| match task.state() {
                //the *completed_date needs to be dereferenced because .state passes a ref
                State::Completed {completed_date} => *completed_date > cutoff,
                _ => false,
            })
            .cloned()
            .collect()

    }
    
    pub(crate) fn get_archived(&self) -> Vec<Task> {
        self.archived.clone() 
    }

    pub(crate) fn get_completed(&self) -> Vec<Task> {
        self.tasks.iter()
            .filter(|task|matches!(task.state(), State::Completed {..}))
            .cloned()
            .collect()
    }

    //method to clear Active tasks takes in filter of tasks to be cleared
    fn clear_tasks<F>(&mut self, mut filter: F)
    //Static Dispatch (Monomorphization) validation in compile time 
    where F: FnMut(&Task) -> bool{
        //'retain keeps only thee elements where closue is true (filter what we delete so negate)
        self.tasks.retain(|task| !filter(task));
    }

    //method to clear archived tasks takes in filter of tasks to be cleared
    fn clear_archived<F>(&mut self, mut filter: F)
    where F: FnMut(&Task) -> bool{
        self.archived.retain(|task| !filter(task));
    }

    pub(crate) fn delete_tasks(&mut self, ids: &[Uuid]){
        if ids.len() <= 16 {
            self.clear_tasks(|task| ids.contains(&task.id()));
            self.clear_archived(|task| ids.contains(&task.id()));
        } else {
            let set: HashSet<Uuid> = ids.iter().copied().collect();
            self.clear_tasks(|task| set.contains(&task.id()));
            self.clear_archived(|task| set.contains(&task.id()));
        }
    }

    pub(crate) fn apply_auto_clear(&mut self){
        let duration = match self.settings.auto_clear_completed_days() {
            None => return,
            Some(days) => Duration::days(days as i64),
        };

        let cutoff = Utc::now() - duration;

        self.tasks.retain(|task| match task.state() {
            State::Completed{completed_date} => *completed_date >= cutoff,
            _ => true,
        });
    }



    fn tasks_to_archived<F>(&mut self, mut filter: F)
    where F: FnMut(&Task) -> bool{
        let mut i = 0;
        while i < self.tasks.len(){
            if filter(&self.tasks[i]){
                let task = self.tasks.swap_remove(i);
                self.archived.push(task);
            } else {
                i+=1;
            }
        }
    }
    

    fn archived_to_tasks<F>(&mut self, mut filter: F)
    where F: FnMut(&Task) -> bool{
        let mut i = 0;
        while i < self.archived.len(){
            if filter(&self.archived[i]){
                let task = self.archived.swap_remove(i);
                self.tasks.push(task);
            } else {
                i+=1;
            }
        }
    }
    
    pub(crate) fn check_and_reset_recurring_tasks(&mut self){
        for task in &mut self.tasks {
            if task.has_recurrence() {
                task.reset_recurring();
            }
        }
    }

    pub(crate) fn check_due_date_promotions(&mut self){
        for task in &mut self.tasks {
            if let Some(due_date) = task.due_date() {
                if *due_date - Utc::now() <= Duration::days(3) 
                && !task.manual_priority_flag() {
                    task.set_priority(Priority::High);
                }
            }
        }
    }

    pub(crate) fn get_categories(&self) -> Vec<Category> {
        let mut cats = self.categories.clone();
        cats.sort_by_key(|c| c.order());
        cats
    }

    pub(crate) fn add_category(&mut self, name: String) -> Category{
        let color = self.new_color();
        let order = (self.categories.len() as u32 + 1) * 1000;
        let c = Category::new(name, color, order);
        let result = c.clone();
        self.categories.push(c);
        result
    }

    fn new_color(&mut self) -> String {
        //color is chosen to be distince through golden ratio (in this case golden angle) 137.5
        let hue = (self.next_color_index as f32 * 137.5) % 360.0;
        self.next_color_index +=1;

        // perceived brightness.
        let lightness = 0.75;

        // colorfulness.
        let chroma = 0.12;

        let color = format!("oklch({:.0}% {:.2} {:.2})",
            lightness * 100.0,
            chroma,
            hue,
        );

        color

    }

    pub(crate) fn rename_category(&mut self, id: Uuid, name: String)-> Result<(), String>{
        if let Some(c) = self.categories.iter_mut().find(|category| category.id() == id){
            c.set_name(name);
            return Ok(());
        }
        Err(format!("no category found with id: {}", id))
    }

    pub(crate) fn reorder_categories(&mut self, ordered_ids: &[Uuid]) -> Result<(), String>{
        if ordered_ids.len() != self.categories.len(){
            return Err(format!("Category order length != categories length"));
        }

        //enumerate gives usize so need to convert
        let map: HashMap<Uuid, u32> = ordered_ids.iter().enumerate().map(|(i, &id)| (id, i as u32)).collect();
        if map.len() != ordered_ids.len() {
            return Err(format!("Duplicate category IDs"));
        }

        for c in &mut self.categories {
            if let Some(order) = map.get(&c.id()){
                c.set_order(*order);
            } else {
                return Err(format!("Missign category_id: {}", c.id()));
            }
        }
        Ok(())
    }

    pub(crate) fn delete_categories(&mut self, ids: &[Uuid]){
        if ids.len() <= 16{
            self.clear_tasks(|task| ids.contains(&task.category_id()));
            self.clear_archived(|task| ids.contains(&task.category_id()));
            //categories only keeps the ones that are not in ids
            self.categories.retain(|c| !ids.contains(&c.id()));

        }else {
            let set: HashSet<Uuid> = ids.iter().copied().collect();
            self.clear_tasks(|task| set.contains(&task.category_id()));
            self.clear_archived(|task| set.contains(&task.category_id()));
            self.categories.retain(|c| !set.contains(&c.id()));
        }
        self.cleanup_empty_groups();
    }

    pub(crate) fn archive_categories(&mut self, ids: &[Uuid]){
        if ids.len() <= 16{
            self.tasks_to_archived(|task| ids.contains(&task.category_id()));
            self.categories.iter_mut().filter(|c| ids.contains(&c.id())).for_each(|c| c.set_status(CategoryStatus::Archived));

        }else {
            let set: HashSet<Uuid> = ids.iter().copied().collect();
            self.tasks_to_archived(|task| set.contains(&task.category_id()));
            self.categories.iter_mut().filter(|c| set.contains(&c.id())).for_each(|c| c.set_status(CategoryStatus::Archived));
        }
        
    }

    pub(crate) fn unarchive_categories(&mut self, ids: &[Uuid]){
        if ids.len() <= 16{
            self.archived_to_tasks(|task| ids.contains(&task.category_id()));
            self.categories.iter_mut().filter(|c| ids.contains(&c.id())).for_each(|c| c.set_status(CategoryStatus::Active));

        }else {
            let set: HashSet<Uuid> = ids.iter().copied().collect();
            self.archived_to_tasks(|task| set.contains(&task.category_id()));
            self.categories.iter_mut().filter(|c| set.contains(&c.id())).for_each(|c| c.set_status(CategoryStatus::Active));
        }
        
    }

    pub(crate) fn move_categories_to_group(&mut self, ids: &[Uuid], group_id: Option<Uuid>)-> Result<(), String>{

        match group_id {
            Some(group_id) => {
                let Some(group) = self.groups.iter().find(|g| g.id() == group_id) else {
                    return Err(format!("Group with id: {} not found", group_id));
                };
                //to owned turns the borrowed &str into an owned copy as String 
                let group_color = group.color().to_owned();
                if ids.len() <= 16{
                    self.categories.iter_mut().filter(|c| ids.contains(&c.id())).for_each(|c|
                    c.set_group(group_id, group_color.clone()));       
                }else {
                    let set: HashSet<Uuid> = ids.iter().copied().collect();
                    self.categories.iter_mut().filter(|c| set.contains(&c.id())).for_each(|c|
                    c.set_group(group_id, group_color.clone()));
                }
            }
            None =>{
                if ids.len() <= 16{
                    self.categories.iter_mut().filter(|c| ids.contains(&c.id())).for_each(|c| c.remove_group());     
                }else {
                    let set: HashSet<Uuid> = ids.iter().copied().collect();
                    self.categories.iter_mut().filter(|c| set.contains(&c.id())).for_each(|c| c.remove_group());

                }
            }
        
        }
        self.cleanup_empty_groups();
        Ok(())
    }

    pub(crate) fn get_groups(&self) -> Vec<Group>{
        self.groups.clone()
    }

    pub(crate) fn create_group(&mut self, name: String) -> Group{
        let color = self.new_color();
        let group = Group::new(name, color);
        let result = group.clone();
        self.groups.push(group);
        result
    }
    pub(crate) fn rename_group(&mut self, id: Uuid, name: String) -> Result<(), String>{
        // we are modifying the groups vec so need to &mut here
        for group in &mut self.groups{
            if group.id() == id {
                group.set_name(name);
                return Ok(());
            }
        }
        Err(format!("no group found with id: {}", id))
    }

    //fn iterates through and removes any groups without catagories in them
    fn cleanup_empty_groups(&mut self) {
        self.groups.retain(|group| {
            self.categories.iter().any(|c| c.group_id() == Some(group.id()))
        });
    }

    //fn does NOT delete categories, it just clears group_id on all categories 
    // that belong to it, then removes the Group. Categories survive ungrouped.
    pub(crate) fn delete_group(&mut self, id: Uuid){
        for category in &mut self.categories {
            if category.group_id() == Some(id) {
                category.remove_group();
            }
        }

        self.groups.retain(|group| group.id() != id);
    }

    pub(crate) fn get_settings(&self) -> &Settings {
        &self.settings
    }

    pub(crate) fn update_settings(&mut self, s: Settings) { 
        self.settings = s;
        self.refresh();
    }

    fn refresh(&mut self){
        self.check_and_reset_recurring_tasks();
        self.check_due_date_promotions();
        self.apply_auto_clear();
    }
}

impl Default for Manager {
    fn default () -> Self {
        Self::new()
    }
}
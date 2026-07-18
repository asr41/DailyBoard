use chrono::{DateTime, Utc, Local, Duration};
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use std::fmt;


// since there are 2 options would a boollean be better than enum
// or perhaps enum allows it to be easily extendable
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum Priority{ 
    Normal,
    High,
}

//recurrence is fair but I am unsure if we want to add in the
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Recurrence{
    interval: u32,
    unit: RecurrenceUnit,
    cycle_start: DateTime<Utc>,
    streak: u32,
    longest_streak: u32, 
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum RecurrenceUnit {
    Hours,
    Days,
    Weeks,
    Months,
    Years,
}

impl Recurrence{
    fn new(interval: u32, unit: RecurrenceUnit, start_date: Option<DateTime<Utc>>)-> Self{
        Self {
            interval:interval,
            unit:unit,
            cycle_start: start_date.unwrap_or_else(Utc::now), // actually more efficient than unwrap_or whcih evaluets Utc::now regardless
            streak:0,
            longest_streak:0,
        }
    }

    fn next_cycle_start(&mut self)->u32{
        match self.unit {
            RecurrenceUnit::Hours => self.fixed_duration_next(Duration::hours(self.interval as i64)),
            RecurrenceUnit::Days => self.fixed_duration_next(Duration::days(self.interval as i64)),
            RecurrenceUnit::Weeks => self.fixed_duration_next(Duration::weeks(self.interval as i64)),
            RecurrenceUnit::Months => self.varied_duration_next(self.interval),
            RecurrenceUnit::Years => self.varied_duration_next(self.interval*12),
        }
    }

    fn varied_duration_next(&mut self, interval: u32)-> u32{
        // default i32
        let mut cycles: u32 = 0;
        loop {
            let next = self.cycle_start + chrono::Months::new(interval);
            if next > Utc::now(){
                break;
            }
            self.cycle_start = next;
            cycles +=1;
        }
        cycles
    }
    
    fn fixed_duration_next(&mut self, interval: Duration)-> u32{
        let elapsed = Utc::now() - self.cycle_start;
        let cycles = elapsed.num_seconds()/interval.num_seconds();
        self.cycle_start += interval* (cycles as i32);
        cycles as u32
    }
}

// Serialize (WebAPI relevent) is send and transmit vis file fomats like JSON 
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) enum State {
    NotStarted,
    //start date gets set the moment a task is moved to inprogress (only inprogress tasks have start date)
    InProgress {start_date: DateTime<Utc>}, 
    //Only Completed tasks have completed date, Illegal states should be unrepresentable
    Completed {completed_date: DateTime<Utc>},

    Archived {archived_date: DateTime<Utc>},
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Task {
    id: Uuid,
    name: String,
    category_id: Uuid,
    description: String, // description is description
    created_date: DateTime<Utc>,
    recurrence: Option<Recurrence>,
    completed_history: Vec<DateTime<Utc>>,
    state: State,
    priority: Priority,
    manual_priority_flag: bool,
    due_date: Option<DateTime<Utc>>,

}
impl Task {
    //method to crate new task
    // Into<String> means this function accepts any type that can be converted
    // into a String (e.g., String, &str, Cow<str>, etc.)
    pub(crate) fn new(name: impl Into<String>, category_id: Uuid, description: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            category_id:category_id,
            description: description.into(),
            created_date: Utc::now(),
            completed_history: Vec::new(),
            state: State::NotStarted,
            priority: Priority::Normal,
            manual_priority_flag: false,
            recurrence: None,
            due_date: None,
        }
    }

    pub(crate) fn reset_recurring(&mut self){
        if let Some(recurrence) = &mut self.recurrence {
            //number of cycles that happend, next cycle start moves to nearest cycle less than now 
            let num_cycles = recurrence.next_cycle_start();
            if num_cycles > 0{
                //task must be completed and only one cycle must have happned
                //if u open daily planner after multiple cycles pass streak ends
                if matches!(self.state, State::Completed{..}) && num_cycles == 1 {
                    recurrence.streak += 1;
                    if recurrence.streak > recurrence.longest_streak {
                        recurrence.longest_streak = recurrence.streak;
                    }
                } else{
                    recurrence.streak = 0;
                }

                self.state = State::NotStarted;
            }
                
        }
    }
    //setters:
    pub(crate) fn set_name(&mut self, new_name: String){
        self.name = new_name;
    }

    pub(crate) fn set_description(&mut self, new_description: String){
        self.description = new_description;
    }

    pub(crate) fn set_category_id(&mut self, new_category_id: Uuid){
        self.category_id = new_category_id;
    }

    // remeber if you mark again it will replace completed date with current mark
    pub(crate) fn mark_completed(&mut self) {
            self.due_date = None;
            self.priority = Priority::Normal;
            let date_now = Utc::now();
            self.state = State::Completed {completed_date: date_now};
        match &self.recurrence {
            None => {},
            Some(_) => {
                self.reset_recurring();
                //makes sure no repeeated completions within one recurrence cycle
                if self.completed_history.last().is_some_and(|x| x > &self.recurrence.as_ref().unwrap().cycle_start){
                    let last = self.completed_history.pop();
                }
                self.completed_history.push(date_now);
            }   
        }
    }

    pub(crate) fn mark_archived(&mut self) {
        self.state = State::Archived {archived_date: Utc::now()};
        self.recurrence = None;
        self.priority = Priority::Normal;
        self.due_date = None;
    }

    pub(crate) fn mark_in_progress(&mut self) {
        self.state = State::InProgress {start_date: Utc::now()};
    }

    pub(crate) fn mark_not_started(&mut self) {
        self.state = State::NotStarted;
    }


    pub(crate) fn set_recurrence(&mut self, interval: u32, unit: RecurrenceUnit, start_date: Option<DateTime<Utc>>) -> Result<(), String>{
        //macro: runs in compile time expands into rust code
        if matches!(self.state, State::Archived { .. }) { 
            return Err("Archived so no recurrence".to_string()); 
        }
        self.recurrence = Some(Recurrence::new(interval, unit, start_date));
        Ok(())
    }

    pub(crate) fn remove_recurrence(&mut self) {
        self.recurrence = None;
    }
    

    pub(crate) fn set_priority_manual(&mut self, priority: Priority){
        self.priority = priority;
        self.manual_priority_flag = true;
    }

     pub(crate) fn set_priority(&mut self, priority: Priority){
        self.priority = priority;
    }

    pub(crate) fn set_due_date(&mut self, due_date: DateTime<Utc>){
        self.due_date = Some(due_date);
        // if set due date is after a manualt priority is set it has ability to change priority
        self.manual_priority_flag = false;
        if due_date - Utc::now() <= Duration::days(3) {
            self.priority = Priority::High;
        }

    }

    pub(crate) fn remove_due_date(&mut self){
        self.due_date = None;
    }


    //getters:
    pub(crate) fn priority(&self) -> &Priority {
        &self.priority
    }

    pub(crate) fn due_date(&self) -> Option<&DateTime<Utc>> {
        //method converts &Option<T> → Option<&T> cleanly.
        self.due_date.as_ref()
    }

    pub(crate) fn state(&self) -> &State {
        &self.state
    }

    pub(crate) fn created_date(&self) -> &DateTime<Utc> {
        &self.created_date
    }
    //Uuid implements clone and copy is cheap not heap allocated so no need to pass by ref
    //also aviods uneccesary borrow lifetimes
    pub(crate) fn id(&self) -> Uuid {
        self.id
    }

    pub(crate) fn category_id(&self) -> Uuid {
        self.category_id
    }

    pub(crate) fn description(&self) -> &str {
        &self.description
    }

    pub(crate) fn name(&self) -> &str {
        &self.name
    }

    pub(crate) fn has_recurrence(&self) -> bool {
        self.recurrence.is_some()
    }

    pub(crate) fn manual_priority_flag(&self) -> bool {
        self.manual_priority_flag
    }

}

impl fmt::Display for State {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            State::NotStarted => write!(f, "Not Started"),
            State::InProgress {start_date} => write!(f, "In Progress {}", start_date.with_timezone(&Local).format("%m/%d/%y")),
            //format() already implements display so dont need to do a .to_string at the end and have an uneccesary heap allocation
            State::Completed {completed_date} => write!(f, "Completed {}", completed_date.with_timezone(&Local).format("%m/%d/%y")),
            State::Archived {archived_date} => write!(f, "Archived {}", archived_date.with_timezone(&Local).format("%m/%d/%y")),
        }
    }
}
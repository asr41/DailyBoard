use chrono::{NaiveDateTime, Datelike, DateTime, Utc, Local, Duration, TimeZone};
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

//info for weekly recurrence
#[derive(Serialize, Deserialize, Clone, Debug, Copy)]
pub(crate) struct WeeklySchedule{
    day_mask: u8,
    //we want it a specific local time M,W,F not UTC
    naive_cycle_start: NaiveDateTime,
}

//recurrence is fair but I am unsure if we want to add in the
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Recurrence{
    interval: u32,
    //Serde's derive treats a missing Option field as None, so allows old v1 files to load
    weekly: Option<WeeklySchedule>,
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
    fn new(interval: u32, unit: RecurrenceUnit, day_mask: Option<u8>, start_date: Option<DateTime<Utc>>)-> Self{
        // Utc::now without () passes the function itself; unwrap_or_else only calls it if start_date is None.
        let cycle_start = start_date.unwrap_or_else(Utc::now); // actually more efficient than unwrap_or whcih evaluets Utc::now regardless

        // Only weeks with a mask gets a schedule
        // matching on `&unit` borrows it instead of moving cause we want to move into the Self below
        let weekly = match (&unit, day_mask) {
            (RecurrenceUnit::Weeks, Some(mask)) => {
                // pure wall clock time importatn to ensure always: (ex. "Mon 09:00") moving timezones or DST never shifts it.
                let naive_cycle_start = cycle_start.with_timezone(&Local).naive_local();
                let start_bit = 1u8 << naive_cycle_start.weekday().num_days_from_monday();
                Some(WeeklySchedule {
                    // & 0b0111_1111 drops bit 7 (there are only 7 days)
                    // | start_bit guarantees start day is always selected
                    day_mask: (mask & 0b0111_1111) | start_bit,
                    naive_cycle_start,
                })
            }
            _ => None,
        };

        Self {
            interval:interval,
            weekly: weekly,
            unit:unit,
            cycle_start: cycle_start,
            streak:0,
            longest_streak:0,
        }
    }

    fn next_cycle_start(&mut self)->u32{
        match self.unit {
            RecurrenceUnit::Hours => self.fixed_duration_next(Duration::hours(self.interval as i64)),
            RecurrenceUnit::Days => self.fixed_duration_next(Duration::days(self.interval as i64)),
            // handles legacy save files that had the fixed 7 day recurrence for weeks (might deprecate later)
            RecurrenceUnit::Weeks => match self.weekly {
                Some(_) => self.weekly_next(),
                None => self.fixed_duration_next(Duration::weeks(self.interval as i64)),
            },
            RecurrenceUnit::Months => self.varied_duration_next(self.interval),
            RecurrenceUnit::Years => self.varied_duration_next(self.interval*12),
        }
    }


    // we move cycle_start anchor forward till next one is the neext one in the future. 
    // If the cycle only progressed one then streak++ in reset recurring 
    // consistent with the other next cycle start helpers
    fn weekly_next(&mut self) -> u32 {
        let interval = self.interval;
        let Some(weekly) = self.weekly.as_mut() else { 
            return 0 
        };

        // we want to sidestep DST, compare naive to naive so that Mon 9:00 is 9:00 local on your machine
        let now = Local::now().naive_local();
        let mut cycles: u32 = 0;
        loop {
            let pos = weekly.naive_cycle_start.weekday().num_days_from_monday();
            //helper (Mon -> Wed -> Fri) and the gap to the next selected day depends on where you are.
            let days = Self::days_until_next(weekly.day_mask, pos, interval);
            // u can add days to a NaiveDateTime and it keeps the time of day exactly same
            let next = weekly.naive_cycle_start + Duration::days(days as i64);
            if next > now {
                break;
            }
            weekly.naive_cycle_start = next;
            cycles += 1;
        }

        // keep the UTC cycle_start mirroring the local cycle_start anchor so mark_complete and frontend work
        // we implement helper local_to_utc to deal with irregularities (AI really helped catch this edge case I would have missed fs)
        if cycles > 0 {
            self.cycle_start = Self::local_to_utc(weekly.naive_cycle_start);
        }
        cycles
    }

    
    // this helper doesnt take self, hence the Self::days_until_next call
    // this allows for easy unit tests on it
    fn days_until_next(day_mask: u8, current_pos: u32, interval: u32) -> u32 {
        //create wrap around
        let wrap14 = (day_mask as u16) | ((day_mask as u16) << 7);

        //get rid of up to current position
        let upcoming = wrap14 >> (current_pos + 1);

        //find how many days are left till u get to the next day in mask
        let days_til_next = upcoming.trailing_zeros() + 1;

        // bit 0 = Monday thus passing position 6 -> 0 means we crossed into the next week.
        // in the every N weeks case we add the N-1 off-weeks here
        if current_pos + days_til_next >= 7 {
            // saturating_sub so interval 0 can't go negative (set_recurrence also rejects it).
            days_til_next + interval.saturating_sub(1) * 7
        } else {
            days_til_next
        }
    }

    // AI: the one place timezones are unavoidable: a wall time might not exist (spring-forward gap, e.g.
    // 02:30) or exist twice (fall-back). `.earliest()` picks the first instant when ambiguous and returns
    // None for the gap; then shift forward an hour (02:30 -> 03:30), the time the clock actually shows.
    fn local_to_utc(naive: NaiveDateTime) -> DateTime<Utc> {
        Local.from_local_datetime(&naive).earliest()
            .or_else(|| Local.from_local_datetime(&(naive + Duration::hours(1))).earliest())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now)
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
        // if cycle_start is in the future then elapsed is negative 
        // need max(0) cause the u32 cycles will turn -1 into 4294967295 ect
        let cycles = (elapsed.num_seconds()/interval.num_seconds()).max(0);
        self.cycle_start += interval* (cycles as i32);
        cycles as u32
    }
}

// Serialize (WebAPI relevent) is send and transmit with file fomats like JSON 
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
        self.mark_completed_at(Utc::now());
    }

    // Same as mark_completed but with a caller-chosen timestamp. complete_categories passes one shared `now`
    // important for reversion
    pub(crate) fn mark_completed_at(&mut self, date_now: DateTime<Utc>) {
            self.due_date = None;
            self.priority = Priority::Normal;
            self.state = State::Completed {completed_date: date_now};
        match &self.recurrence {
            None => {},
            Some(_) => {
                self.reset_recurring();
                //makes sure no repeeated completions within one recurrence cycle
                if self.completed_history.last().is_some_and(|x| x > &self.recurrence.as_ref().unwrap().cycle_start){
                    // poped vlaue isnt needed so we dont bind it so we dont get unused value warnigns rust compiler
                    self.completed_history.pop();
                }
                self.completed_history.push(date_now);
            }   
        }
    }

    // When revertign a completed category it undos completions that happened at the exact date category was completed.
    // Allows us to keep tasks that were completed before the category was completed as completed
    // tasks that were completed becauase the category was marked completed revert
    pub(crate) fn revert_completion_at(&mut self, date: DateTime<Utc>) -> bool {
        //lil macro
        if !matches!(self.state, State::Completed { completed_date } if completed_date == date) {
            return false;
        }
        self.state = State::NotStarted;
        if self.completed_history.last() == Some(&date) {
            self.completed_history.pop();
        }
        true
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

    pub(crate) fn set_recurrence(&mut self, interval: u32, unit: RecurrenceUnit, day_mask: Option<u8>, start_date: Option<DateTime<Utc>>) -> Result<(), String>{
        //macro: runs in compile time expands into rust code
        if matches!(self.state, State::Archived { .. }) {
            return Err("Archived so no recurrence".to_string());
        }
        if interval == 0 {
            return Err("Recurrence interval must be at least 1".to_string());
        }
        self.recurrence = Some(Recurrence::new(interval, unit, day_mask, start_date));
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

    pub(crate) fn has_completion_history(&self) -> bool {
        !self.completed_history.is_empty()
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

// Claud wrote some nice unit nests for days until next
// #[cfg(test) means this module is only compiled for cargo test` so doesnt add to the release binary
mod tests {
    use super::*;

    const MON: u8 = 1 << 0;
    const WED: u8 = 1 << 2;
    const FRI: u8 = 1 << 4;

    #[test]
    fn next_day_within_same_week() {
        assert_eq!(Recurrence::days_until_next(MON | WED | FRI, 2, 1), 2); // Wed -> Fri
        assert_eq!(Recurrence::days_until_next(MON | WED | FRI, 2, 2), 2); // interval ignored mid-week
    }

    #[test]
    fn wrap_into_next_week() {
        assert_eq!(Recurrence::days_until_next(MON | WED | FRI, 4, 1), 3);  // Fri -> Mon
        assert_eq!(Recurrence::days_until_next(MON | WED | FRI, 4, 2), 10); // Fri -> Mon, skip one week
    }

    #[test]
    fn single_day_matches_old_weekly_behaviour() {
        assert_eq!(Recurrence::days_until_next(WED, 2, 1), 7);
        assert_eq!(Recurrence::days_until_next(WED, 2, 3), 21);
    }

    #[test]
    fn sunday_wraps_to_monday() {
        assert_eq!(Recurrence::days_until_next(MON | (1 << 6), 6, 1), 1); // Sun -> Mon
    }

    #[test]
    fn new_forces_start_day_into_mask() {
        // 2026-11-23 is a Monday; ask for Wednesday only, Monday must still be included
        let start = Local.with_ymd_and_hms(2026, 11, 23, 9, 0, 0).unwrap().with_timezone(&Utc);
        let rec = Recurrence::new(1, RecurrenceUnit::Weeks, Some(WED), Some(start));
        let weekly = rec.weekly.unwrap();
        assert_eq!(weekly.day_mask, MON | WED);
        assert_eq!(weekly.naive_cycle_start.format("%H:%M").to_string(), "09:00");
    }

    #[test]
    fn future_start_date_is_zero_cycles() {
        let start = Utc::now() + Duration::days(10);
        let mut rec = Recurrence::new(1, RecurrenceUnit::Days, None, Some(start));
        assert_eq!(rec.next_cycle_start(), 0);
        assert_eq!(rec.cycle_start, start);
    }

    #[test]
    fn non_weekly_units_get_no_schedule() {
        let rec = Recurrence::new(1, RecurrenceUnit::Days, Some(WED), None);
        assert!(rec.weekly.is_none());
    }
}

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Settings {
    hide_completed_delay: HideCompletedPolicy,
    auto_clear_completed_days: Option<u32>,
}

impl Settings {
    pub(crate) fn new() -> Self{
        //defaults
        Self {
            // hide completed tasks from your main board based on X policy
            hide_completed_delay: HideCompletedPolicy::AfterDays{num_days: 1},

            //auto clear completed tasks after a set amount of days
            auto_clear_completed_days: None,
        }
    }

    //getters
    pub(crate) fn hide_completed_delay(&self)-> HideCompletedPolicy{
        self.hide_completed_delay
    }
    pub(crate) fn auto_clear_completed_days(&self)->Option<u32>{
        self.auto_clear_completed_days
    }

}

#[derive(Serialize, Deserialize, Copy, Clone, Debug)]
pub(crate) enum HideCompletedPolicy { 
    Immediately,
    AfterHours{num_hours: u32}, 
    AfterDays{num_days: u32},
}
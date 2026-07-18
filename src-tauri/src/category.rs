use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]//Make a note about Debug
pub(crate) struct Category {
    id: Uuid,
    name: String,
    color: String, // can yse a u32 but to avoid frontend conversion hex string better (unique)
    display_color: String, // color for display (can be different from color if part of group)
    order: u32,
    group_id: Option<Uuid>, //optional only catagories in groups
    status: CategoryStatus,
}

impl Category {
    pub(crate) fn new(name: String, color: String, order: u32) -> Self{
        Self {
            id: Uuid::new_v4(),
            name: name,
            display_color: color.clone(),
            color: color,
            order: order,
            group_id: None,
            status: CategoryStatus::Active,
        }
    }

    //setters

    //setting group makes all the categories in group have same color
    pub(crate) fn set_group(&mut self, group_id: Uuid, color: String){
        self.group_id = Some(group_id);
        self.display_color = color;
    }

    pub(crate) fn remove_group(&mut self){
        self.group_id = None;
        self.display_color = self.color.clone();
    }

    pub(crate) fn set_name(&mut self, name: String){
        self.name = name;
    }

    pub(crate) fn set_order(&mut self, order: u32){
        self.order = order;
    }

    pub(crate) fn set_status(&mut self, status: CategoryStatus){
        self.status = status;
    }



    //getters

    pub(crate) fn id(&self)-> Uuid{
        self.id
    }

    pub(crate) fn name(&self)-> &str{
        &self.name
    }

    pub(crate) fn display_color(&self)-> &str{
        &self.display_color
    }

    pub(crate) fn order(&self)-> u32{
        self.order
    }

    pub(crate) fn group_id(&self)-> Option<Uuid>{
        self.group_id
    }
    pub(crate) fn status(&self)-> CategoryStatus{
        self.status
    }

}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct Group {
    id: Uuid,
    name: String,
    color: String,
}

impl Group {
    pub(crate) fn new(name: String, color: String)-> Self{
        Self{
            id: Uuid::new_v4(),
            name: name,
            color: color,
        }
    }

    //setter
    pub(crate) fn set_name(&mut self, name: String) {
        self.name = name;
    }

    //getters 
    pub(crate) fn name(&self)-> &str{
        &self.name
    }

    //getters 
    pub(crate) fn id(&self)-> Uuid{
        self.id
    }

    //getters
    pub(crate) fn color(&self)-> &str{
        &self.color
    }

}



#[derive(Serialize, Deserialize, Copy, Clone, Debug)]
pub(crate) enum CategoryStatus{
    Active,
    Archived,
    Completed  
}
class Action{
    constructor(){}
}


class ActionError extends Error{
    constructor(message = "Error with an action!"){
        super(); 
        this.name = "ActionError";
        this.message = message;
    }
}

module.exports = {Action,ActionError};
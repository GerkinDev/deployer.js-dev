'use strict';

var ActionGroup = require("./actiongroup.js");
var Breadcrumb = require("./breadcrumb.js");

/**
 * Creates a new command
 * @class Command
 * @param   {object}   config Configuration of the command
 * @param   {Command.Type} config.type Type of command
 * @param   {ActionGroup} config.actionGroup Related base action group
 */
function Command(config){
    if(is_na(config))
        throw "Can't create Command with null or undefined config.";

    console.log("Creating COMMAND with", config);

    var type,
        actionGroup;

    Object.defineProperties(this, {
        /**
         * @member {Command.Type} type
         * @memberof Command
         * @public
         * @instance
         */
        type: {
            get: function(){
                return type;
            },
            set: function(val){
                if(Object.keys(Command.Type).indexOf(val) != -1){
                    type = Command.Type[val];
                    return type;
                } else if(Object.values(Command.Type).indexOf(val) != -1){
                    type = val;
                    return type;
                } else {
                    return undefined;
                }
            }
        },
        /**
         * @member {ActionGroup} actionGroup
         * @memberof Command
         * @public
         * @instance
         */
        actionGroup: {
            get: function(){
                return actionGroup;
            },
            set: function(val){
                if(val.constructor.name != "ActionGroup")
                    return undefined;
                actionGroup = val;
                return val;
                return undefined;
            }
        }
    });

    if(config.awake === true && (config.command_group === false || is_na(config.command_group))){
        this.type = "PERMANENT"
    } else if((config.awake === false || is_na(config.awake)) && config.command_group === true){
        this.type = "MOMENTARY"
    } else {
        throw "Could not resolve command type: listener or command_group";
    }

    try{
        this.actionGroup = new ActionGroup(config.actionGroup);
        console.log(actionGroup);
    } catch(e){
        throw e;
    }
    
    if(is_na(this.type) || is_na(this.actionGroup)){
        throw "Properties not correctly initialized";
    }
}

/**
 * @readonly
 * @enum {number}
 */
Command.Type = {
    PERMANENT: 1,
    MOMENTARY: 2
}

Command.prototype.execute = function(next){
    var breadcrumb = new Breadcrumb();
    this.actionGroup.execute(breadcrumb.startTimer(), next);
}

module.exports = Command;
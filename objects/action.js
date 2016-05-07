'use strict';

var Breadcrumb = require("./breadcrumb.js");

/**
 * Creates a new action
 * @class Action
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 */
function Action(config){
    if(is_na(config))
        throw "Can't create Action with null or undefined config.";

    console.log("Creating ACTION with", config);


    var actionName,
        vars,
        processFunction;

    Object.defineProperties(this, {
        /**
         * @member {string} actionName
         * @memberof Action
         * @public
         * @instance
         */
        actionName: {
            get: function(){
                return actionName;
            },
            set: function(val){
                var actionPath = "../actions/" + val + ".js";
                var handler = require(actionPath);
                if(handler != null && handler.process && typeof handler.process == "function"){
                    actionName = val;
                    processFunction = handler.process;
                    return actionName;
                }
                return undefined;
            }
        },
        vars: {
            get: function(){
                return vars;
            },
            set: function(val){
                vars = val;
            }
        },
        /**
         * @member {ProcessFunction} processFunction
         * @memberof Action
         * @public
         * @readonly
         * @instance
         */
        processFunction:{
            get: function(){return processFunction;}
        }
    });

    if(is_na(config.action) && is_na(config.actionName == null)){
        throw `Could not find action for config: ${ JSON.stringify(config) }`;
    }
    this.actionName = config.action || config.actionName
}

Action.test = function(){
    return true;
}


/**
 * Runs the specified action
 * @author Gerkin
 * @param   {Breadcrumb} breadcrumb The actions breadcrumb
 * @param   {Function} callback   Action to call afterwards
 * @returns {undefined} Async
 */
Action.prototype.execute = function(breadcrumb, callback){
    deployer.log.info(`Starting Action "${ breadcrumb.toString() }"`);
    console.log(this.processFunction.toString());
    deployer.log.info(`Ended Action "${ breadcrumb.toString() }" after ${ breadcrumb.getTimer() }ms`);
    return callback()
    processFunction(this.vars, function(){
    deployer.log.info(`Starting Action "${ breadcrumb.toString() }"`);
        callback();
    });
}

module.exports = Action;
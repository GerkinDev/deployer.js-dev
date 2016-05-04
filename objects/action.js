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
        vars;

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
        }
    });

    if(is_na(config.action) && is_na(config.actionName == null)){
        throw "Could not find action for config: " + JSON.stringify(config);
    }
    this.actionName = config.action || config.actionName
}

Action.test = function(){
    return true;
}

var processFunction;

Action.prototype.execute = function(breadcrumb, callback){
    deployer.log.info("Starting Action " + breadcrumb.toString());
    var timer = (new Date()).getTime();
    var time = ((new Date()).getTime() - timer);
    deployer.log.info("Ending Action " + breadcrumb.toString() + " after " + time + "ms");
    return callback();
    processFunction(this.vars, function(){
        deployer.log.info("Starting ActionGroup " + breadcrumb.toString());
        callback();
    });
}

module.exports = Action;
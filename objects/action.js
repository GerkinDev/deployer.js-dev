'use strict';

const Breadcrumb = require("./breadcrumb.js");
const Arguments = require('./arguments.js');

/**
 * Creates a new action
 * @class Action
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 */
function Action(config){
    if(is_na(config))
        throw new Error("Can't create Action with null or undefined config.");

    console.log("Creating ACTION with", config);


    var actionName,
        actionConfig,
        processFunction,
        args;

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
        config: {
            get: function(){
                return actionConfig;
            },
            set: function(val){
                actionConfig = val;
            }
        },
        arguments: {
            get: function(){
                return args;
            },
            set: function(newArgs){
                args = newArgs;
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
        throw new Error(`Could not find action for config: ${ JSON.stringify(config) }`);
    }
    this.actionName = config.action || config.actionName;
    this.config = config.data;
    args = new Arguments(config.arguments);
}

Action.test = function(){
    return true;
}
Action.prototype.setArguments = function(arg){
    if(!(arg instanceof Arguments))
        throw new TypeError(`Function "setArguments" expects object of type "Arguments", "${ typeof arg }" given.`);
    this.arguments.ancestor = arg.arguments;
    return this;
}


/**
 * Runs the specified action. It first compile local arguments with ancestors (see {@link Arguments.brewArguments}), then it replaces {@link Action.config} placeholders with {@link Action.arguments} values.
 * @author Gerkin
 * @see Arguments.brewArguments
 * @param   {Breadcrumb} breadcrumb The actions breadcrumb
 * @param   {Function} callback   Action to call afterwards
 * @returns {undefined} Async
 */
Action.prototype.execute = function(breadcrumb, callback){
    deployer.log.info(`Starting Action "${ breadcrumb.toString() }" with action name "${ this.actionName }"`);
    return this.arguments.brewArguments((values)=>{
        var compiledArgs = this.arguments.prepareActionArgs(this.config);
        console.log(JSON.stringify(compiledArgs, null, 4)); 
        deployer.log.info(`Ended Action "${ breadcrumb.toString() }" after ${ breadcrumb.getTimer() }ms`);
        return callback()
        processFunction(compiledArgs, function(){
            deployer.log.info(`Starting Action "${ breadcrumb.toString() }" with action name "${ this.actionName }"`);
            callback();
        });
    });
}

module.exports = Action;
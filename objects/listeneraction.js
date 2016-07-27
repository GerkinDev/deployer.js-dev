/**
 * @file Class file for event single handler
 *
 * @author Gerkin
 * @copyright 2016 %company.name%
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPLv3
 * @package deployer.js
 *
 * @version 0.4.0
 */

'use strict';

const Arguments = require('./arguments.js');
const Action = require('./action.js').Action;
const ActionError = require('./action.js').ActionError;

/**
 * @class ListenerAction
 * @description Creates a new action
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 * @param   {object} config.data Object to pass to the called action after being replaced using {@link Arguments.prepareActionArgs}
 */
class ListenerAction extends Action{
    constructor ({action, actionName, data, args}){
        if(isNA(arguments[0]))
            throw new Error("Can't create ListenerAction with null or undefined config.");
        super();

        console.log(arguments[0]);

        var _actionName,
            _actionConfig,
            _processFunction,
            _args;

        Object.defineProperties(this, {
            /**
             * @member {string} actionName
             * @memberof ListenerAction
             * @public
             * @instance
             */
            actionName: {
                get: function(){
                    return _actionName;
                },
                set: val=>{
                    var actionPath = "../actions/" + val + ".js";
                    var handler = require(actionPath);
                    if(handler != null && handler.processSingle && typeof handler.processSingle == "function"){
                        _actionName = val;
                        _processFunction = handler.processSingle;
                        if(isNA(_processFunction)){
                            throw new ActionError(`Could not find "${ this.eventListener ? "processSingle" : "process" } for action "${ _actionName }". This action will do nothing`);
                        }
                        return _actionName;
                    }
                    return undefined;
                }
            },
            /**
             * @member {object} config
             * @memberof ListenerAction
             * @public
             * @instance
             */
            config: {
                get: function(){
                    return _actionConfig;
                },
                set: function(val){
                    _actionConfig = val;
                }
            },
            /**
             * @member {Arguments} arguments
             * @memberof ListenerAction
             * @public
             * @instance
             */
            arguments: {
                get: function(){
                    return _args;
                },
                set: function(newArgs){
                    if(!(newArgs instanceof Arguments))
                        throw new TypeError(`Function "setArguments" expects object of type "Arguments", "${ typeof newArgs }" given.`);
                    _args = newArgs;
                }
            },
            /**
             * @member {ProcessFunction} processFunction
             * @memberof ListenerAction
             * @public
             * @readonly
             * @instance
             */
            processFunction:{
                get: function(){return _processFunction;}
            }
        });

        if(isNA(action) && isNA(actionName)){
            throw new Error(`Could not find action for config: ${ JSON.stringify(arguments[0]) }`);
        }
        this.actionName = action || actionName;
        this.config = data;
        this.arguments = new Arguments(args);
    }

    /**
     * @function test
     * @memberof ListenerAction
     * @description Check if given object is ok to be parsed by {@link ListenerAction constructor}
     * @param   {object} obj The object to test
     * @returns {boolean} True if ok, false otherwise
     * @static
     * @public
     * @author Gerkin
     */
    static test (obj){
        return true;
    }

    /**
     * @method trigger
     * @memberof ListenerAction
     * @description Todo
     * @param   {Breadcrumb} breadcrumb The actions breadcrumb
     * @param   {string} filepath Filepath of event
     * @param   {Function} callback   Action to call afterwards
     * @returns {undefined} Async
     * @instance
     * @public
     * @author Gerkin
     * @see {@link Arguments.brewArguments}
     */
    trigger (breadcrumb, filepath, callback){
        breadcrumb.startTimer();

        deployer.log.info(`Starting EventHandler "${ breadcrumb.toString() }" with handler "${ this.actionName }"`);
        return this.arguments.brewArguments((brewedArguments)=>{
            var compiledArgs = brewedArguments.prepareActionArgs(this.config);
            console.log(JSON.stringify(compiledArgs, null, 4)); 
            return this.processFunction(compiledArgs,filepath, ()=>{
                deployer.log.info(`Ended EventHandler "${ breadcrumb.toString() }" after ${ breadcrumb.getTimer() }ms`);
                callback();
            });
        });
    }

    /**
     * @function setArguments
     * @memberof ListenerAction
     * @description Prepare {@link Action#arguments} by setting its {@link Arguments#ancestor} for placeholder operations
     * @param   {Arguments} arg The argument object to put as ancestor
     * @instance
     * @public
     * @author Gerkin
     */
    setArguments (arg){
        if(!(arg instanceof Arguments))
            throw new TypeError(`Function "setArguments" expects object of type "Arguments", "${ typeof arg }" given.`);
        this.arguments.ancestor = arg;
        return this;
    }
}

module.exports = ListenerAction
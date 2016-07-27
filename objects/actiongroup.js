/**
 * @file A group of executable sub-groups/actions
 *
 * @author Gerkin
 * @copyright 2016 %company.name%
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPLv3
 * @package deployer.js
 *
 * @version %version%
 */

'use strict';

const CommandAction = require("./commandaction.js");
const CommandActionCommand = require("./commandactioncommand.js");
const Breadcrumb = require("./breadcrumb.js");
const Arguments = require('./arguments.js');


/**
 * @typedef ActionGroupChild
 * @type   {CommandAction|ActionGroup}
 */

/**
 * Creates a new ActionGroup
 * @class ActionGroup
 * @param   {object}   config Configuration of the action group
 * @param   {ActionGroup.Mode} config.mode Type of async execution of the command group
 * @param   {ActionGroupChild[]} config.actions Sub action groups or child actions
 */
class ActionGroup{
	constructor ({args,mode,actions}){
		if(isNA(arguments[0]))
			throw new Error("Can't create ActionGroup with null or undefined config.");

		var _mode,
			_actions,
			_args;

		Object.defineProperties(this, {
			/**
             * @member {ActionGroup.Mode} mode
             * @memberof ActionGroup
             * @public
             * @instance
             */
			mode: {
				get: function(){
					return _mode;
				},
				set: function(val){
					if(Object.keys(ActionGroup.Mode).indexOf(val) != -1){
						_mode = ActionGroup.Mode[val];
						return _mode;
					} else if(Object.values(ActionGroup.Mode).indexOf(val) != -1){
						_mode = val;
						return _mode;
					} else {
						return undefined;
					}
				}
			},
			/**
             * @member {ActionGroupChild[]} actions
             * @memberof ActionGroup
             * @public
             * @instance
             */
			actions: {
				get: function(){
					return _actions;
				},
				set: function(val){
					if(isNA(val))
						return undefined;
					if(val.constructor.name != "Array")
						return undefined;

					var ok = true;
					for(var i = 0, j = val.length; i < j; i++){
						ok &= ["ActionGroup", "CommandAction", "CommandActionCommand"].indexOf(val[i].constructor.name) != -1;
					}
					if(!ok)
						return undefined;

					_actions = val;
					return val;
				}
			},
			/**
             * @member {Arguments} arguments
             * @memberof ActionGroup
             * @public
             * @instance
             */
			arguments: {
				get: function(){return _args;},
				set: function(newArgs){
					if(!(newArgs instanceof Arguments))
						throw new TypeError(`Setter of "ActionGroup.arguments" expects object of type "Arguments", "${ typeof newArgs }" given.`);
					_args = newArgs;
				}
			}
		});
		this.arguments = new Arguments(args);

		if(mode === "parallel"){
			_mode = ActionGroup.Mode.PARALLEL;
		} else if(mode === "serie"){
			_mode = ActionGroup.Mode.SERIE;
		} else {
			throw new Error('Could not resolve ActionGroup type: "parallel" or "serie"');
		}

		let actionsGroupChild = [];
		for(var i = 0, j = actions.length; i < j; i++){
			let actionGroupChildConfig = actions[i];
			let actionGroupChild = null;

			if(actionGroupChild === null && ActionGroup.test(actionGroupChildConfig)){
				try{
					actionGroupChild = new ActionGroup(actionGroupChildConfig);
				} catch(e){
					deployer.log.warn("ActionGroup said it can parse an object it failed on:", JSON.stringify(actionGroupChildConfig))
				}
			}
			if(actionGroupChild === null && CommandActionCommand.test(actionGroupChildConfig)){
				try{
					actionGroupChild = new CommandActionCommand(actionGroupChildConfig);
				} catch(e){
					deployer.log.warn("CommandActionCommand said it can parse an object it failed on:", JSON.stringify(actionGroupChildConfig), e);
				}
			}
			if(actionGroupChild === null && CommandAction.test(actionGroupChildConfig)){
				try{
					actionGroupChild = new CommandAction(actionGroupChildConfig);
				} catch(e){
					deployer.log.warn("CommandAction said it can parse an object it failed on:", JSON.stringify(actionGroupChildConfig), e);
				}
			}
			if(actionGroupChild === null){
				throw "Could not parse ActionGroup child: " + JSON.stringify(actionGroupChildConfig);
			}
			//console.log(actionGroupChild);
			actionsGroupChild.push(actionGroupChild);
		}
		this.actions = actionsGroupChild;

		if(isNA(this.mode) || isNA(this.actions) || this.actions.length < 1){
			throw new Error("Properties not correctly initialized");
		}
	}

	/**
     * @function test
     * @memberof ActionGroup
     * @description Check if given object is ok to be parsed by {@link ActionGroup constructor}
     * @param   {object} config The object to test
     * @returns {boolean} True if ok, false otherwise
     * @static
     * @public
     * @author Gerkin
     */
	static test (config){
		return (!isNA(config.mode)) && (typeof config.mode == "string") && (!isNA(config.actions)) && (config.actions.constructor.name == "Array");
	}

	/**
     * @method execute
     * @memberof ActionGroup
     * @description todo
     * @param   {Breadcrumb} breadcrumb The actions breadcrumb
     * @param   {Function} callback   Function to call afterwards
     * @returns {undefined} Async
     * @instance
     * @public
     * @author Gerkin
     * @see {@link Arguments.brewArguments}
     */
	execute (breadcrumb, next){
		breadcrumb.startTimer();
		deployer.log.info("Starting ActionGroup " + breadcrumb.toString());
		var mode;

		switch(this.mode){
			case 1:{
				mode = "forEachOf";
			} break;

			case 2:{
				mode = "forEachOfSeries";
			} break;
		}

		return this.arguments.brewArguments((brewedArguments)=>{
			async[mode](this.actions, (action, index, callback)=>{
				action.setArguments(brewedArguments).execute(breadcrumb.clone().push(index), callback);
			}, function(){
				deployer.log.info("Ended ActionGroup " + breadcrumb.toString() + " after " + breadcrumb.getTimer() + "ms");
				return next();
			});
		});
	}
	/**
     * @function setArguments
     * @memberof ActionGroup
     * @description Prepare {@link ActionGroup#arguments} by setting its {@link Arguments#ancestor} for placeholder operations
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
/**
 * @readonly
 * @enum {number}
 */
ActionGroup.Mode = {
	PARALLEL: 1,
	SERIE: 2
}

module.exports = ActionGroup;
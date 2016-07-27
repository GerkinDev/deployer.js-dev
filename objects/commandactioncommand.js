/**
 * @file A single executable action for command CLI
 *
 * @author Gerkin
 * @copyright 2016 %company.name%
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPLv3
 * @package deployer.js
 *
 * @version 0.4.0
 */

'use strict';

const Breadcrumb = require("./breadcrumb.js");
const Arguments = require('./arguments.js');
const Action = require('./action.js').Action;

/**
 * @class CommandActionCommand
 * @description Creates a new action
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 * @param   {object} config.data Object to pass to the called action after being replaced using {@link Arguments.prepareActionArgs}
 */
class CommandActionCommand extends Action{
	constructor ({command, data}){
		if(isNA(arguments[0]))
			throw new Error("Can't create CommandActionCommand with null or undefined config.");
		super();

		var _commandName,
			_commandConfig,
			_args;

		Object.defineProperties(this, {
			/**
             * @member {string} commandName
             * @memberof CommandActionCommand
             * @public
             * @instance
             */
			commandName: {
				get: function(){
					return _commandName;
				},
				set: val=>{
					_commandName = val;
				}
			},
			/**
             * @member {object} config
             * @memberof CommandActionCommand
             * @public
             * @instance
             */
			config: {
				get: function(){
					return _commandConfig;
				},
				set: function(val){
					_commandConfig = val;
				}
			},
			/**
             * @member {Arguments} arguments
             * @memberof CommandActionCommand
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
		});

		this.commandName = command;
		this.config = data;
		this.arguments = new Arguments(data);
	}

	/**
     * @function test
     * @memberof CommandActionCommand
     * @description Check if given object is ok to be parsed by {@link CommandActionCommand constructor}
     * @param   {object} obj The object to test
     * @returns {boolean} True if ok, false otherwise
     * @static
     * @public
     * @author Gerkin
     */
	static test (obj){
		return Object.keys(obj).filter(function(key){
			return ["command", "data"].indexOf(key) === -1
		}).length === 0;
	}

	/**
     * @method execute
     * @memberof CommandActionCommand
     * @description Runs the specified action. It first compile local arguments with ancestors (see {@link Arguments#brewArguments}), then it replaces {@link CommandActionCommand#config} placeholders with {@link CommandActionCommand#arguments} values, and finally, it calls {@link CommandActionCommand#processFunction}.
     * @param   {Breadcrumb} breadcrumb The actions breadcrumb
     * @param   {Function} callback   CommandActionCommand to call afterwards
     * @returns {undefined} Async
     * @instance
     * @public
     * @author Gerkin
     * @see {@link Arguments.brewArguments}
     */
	execute (breadcrumb, callback){
		function endExecute(){
			deployer.log.info(`Ended CommandActionCommand "${ breadcrumb.toString() }" after ${ breadcrumb.getTimer() }ms`);
			callback();
		}

		breadcrumb.startTimer();

		var targetedCommand = deployer.config.actionObjects[this.commandName];
		if(isNA(targetedCommand)){
			deployer.log.error(`Trying to execute an inexistant command ${ this.commandName }`);
			return endExecute();
		}

		var commandClone = targetedCommand.clone();
		console.log({
			clone:commandClone,
			args:commandClone.commandArgs.arguments,
			thisArgs:this.arguments
		});
		return this.arguments.brewArguments((brewedArguments)=>{
			var compiledArgs = brewedArguments.prepareActionArgs(this.config);
			console.log(compiledArgs);
			process.exit();
			deployer.log.info(`Starting CommandActionCommand "${ breadcrumb.toString() }" with command name "${ this.commandName }"`);
			return this.processFunction(compiledArgs, endExecute);
		});
	}

	/**
     * @function setArguments
     * @memberof CommandActionCommand
     * @description Prepare {@link CommandActionCommand#arguments} by setting its {@link Arguments#ancestor} for placeholder operations
     * @param   {Arguments} arg The argument object to put as ancestor
     * @instance
     * @public
     * @author Gerkin
     */
	setArguments (arg){
		if(!(arg instanceof Arguments))
			throw new TypeError(`Function "setArguments" expects object of type "Arguments", "${ typeof arg }" given.`);
		this.arguments.ancestor = arg;
		console.log(arg);
		return this;
	}
}

module.exports = CommandActionCommand;
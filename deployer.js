/**
 * @file deployer.js Global deployment handler
 * @description false
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.0
 */

/**
 * @module deployer
 * @requires fs
 * @requires async
 */

fs = require("fs");
child_process = require("child_process");
async = require("async");
colour = require("colour");
merge = require('merge');
path = require('path');
const commander = require('commander')
const cli = new commander.Command();
const readline = require('readline');
rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.pause();
const spawnargs = require('spawn-args');

require('./utils.js');

var init = true;
process.on('uncaughtException', function (error) {
	deployer.log.error(error.stack);
}).on('unhandledRejection', function (error) {
	deployer.log.error(error.stack);
});


function composeLog(args, predatas){
	var argsR = [];
	argsR[0] = predatas["0"];
	argsR[1] = predatas["1"];
	for(var i in args){
		argsR.push(args[i]);
	}
	return argsR;
}
/**
 * Handler to process the deployment.
 * @global
 */
deployer = {
	log: {
		levels: [
			"silly",
			"verbose",
			"info",
			"warn",
			"error",
			"silent"
		],
		silly: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"rainbow","1":"silly"}));},
		verbose: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"blue","1":"verbose"}));},
		info: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"cyan","1":"info"}));},
		warn: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"yellow","1":"warn"}));},
		error: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"red","1":"error"}));},
		always: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"gray","1":"silent"}));},
		custom: function(string){
			var level = arguments[1];
			var color = arguments[0];
			if(deployer.log.levels.indexOf(level) >= deployer.log.levels.indexOf(deployer.config.loglevel || init)){
				var argsR = [];
				argsR[0] = colour[color](level.charAt(0).toUpperCase() + level.slice(1) + ":");
				for(var i = 2, j = arguments.length; i < j; i++){
					argsR[i - 1] = arguments[i];
				}
				console.log.apply(console.log, argsR);
				if(deployer.log.levels.indexOf(level) >= deployer.log.levels.indexOf("warn") && level != "silent"){
					console.trace();
				}
			}
		},
	},
	config: {
		loglevel: "silly",
		excludeExplore: [
			"^.\\/node_modules($|\\/.+)"
		],
		project: {
			commands:{
				_default:{
					awake: true
				}
			}
		},
		action: "_default"
	}
};
/**
 * @todo Describe options
 */

function self_update(){
	deployer.log.verbose("Self updating");
}

getModuleVersion("deployer", function(){
	cli.version(deployer.config.moduleVersion.deployer);
	cli.option('-d, --dump_config', 'Dump the compiled config file', false);
	cli.option('-l, --log_level <level>', 'Set the log level', /^(silly|verbose|info|warn|error|silent)$/i, false);
	cli.option('-g, --global_config_file <path>', 'Will use the file <path> as global base config file', /.*\.json(?![^a-zA-Z])$/, "config.global.json");
	cli.option('-c, --config_file <path>', 'Will use the project file <path>', /.*\.json(?![^a-zA-Z])$/, "deployer_config.json");
	cli.command('self-update').description("Update deployer.js").action(self_update);
	cli.command('dry-run').description("Get help for commands available with current config").action(function(){
		handleCli();
		deployer.config.action = null;
		run(true);
	});
	cli.command('help').description("Get help for commands & options").action(function(){
		handleCli();
		deployer.config.action = null;
		cli.outputHelp();
	});
	cli.command('*').description("The name of the command you want to use").action(function(action){
		handleCli();
		deployer.config.action = action;
		run();
	});
	cli.parse(process.argv);

	if(cli.args.length == 0){ // Nothing was given
		handleCli();
		run();
	}
});

function handleCli(){
	deployer.config.configFile = cli.opts()["config_file"];
	deployer.config.globalConfigFile = cli.opts()["global_config_file"];
	if(cli.opts()["log_level"]){
		deployer.config.loglevel = cli.opts()["log_level"];
	}
	init = false;
}

/**
 * Runs the specified command
 * @author Gerkin
 * @param   {boolean} [dry=false] Set to true to parse the config file and output the available commands
 * @returns {undefined}
 */
function run(dry){
	if(typeof dry == "undefined")
		dry = false;
	deployer.log.verbose('Executing action "'+deployer.config.action+'"');
	//deployer.config = merge(deployer.config, checkArgs());
	var file;
	deployer.config.base_path = __dirname;
	async.waterfall(
		[
			function(cb){ // search global config file
				file = path.resolve(__dirname, deployer.config.globalConfigFile);
				fs.access(file, fs.W_OK, cb);
			},
			function(cb){ // Read global config file
				deployer.log.verbose("Found GLOBAL config file " + file);
				fs.readFile(file, 'UTF-8', cb);
			},
			function(str, cb){ // parse global config file
				try{
					var configFile = JSON.parse(str);
					deployer.config = merge.recursive(deployer.config, configFile);
					if(cli.opts()["log_level"]){
						deployer.config.loglevel = cli.opts()["log_level"];
					}
					return cb();
				} catch(e) {
					deployer.log.error("Parse error of GLOBAL config file:", e);
					return cb(e);
				}
			},
			function(cb){ // search local config file
				file = path.resolve(".", deployer.config.configFile);
				fs.access(file, fs.W_OK, function(err){
					if(err){
						deployer.log.warn("No local config file found at " + file);
						return cb(true);
					} else {
						deployer.log.verbose("Found LOCAL config file " + file);
						return cb();
					}
				});
			},
			function(cb){ // Read local config file
				fs.readFile(file, 'UTF-8', cb);
			},
			function(str, cb){ // parse local config file
				try{
					var configFile = JSON.parse(str);
					deployer.config = merge.recursive(deployer.config, configFile);
					if(cli.opts()["log_level"]){
						deployer.config.loglevel = cli.opts()["log_level"];
					}
					return cb();
				} catch(e) {
					deployer.log.warn("Invalid JSON file " + file + ": ",e);
					return cb(e , false);
				}
			},
		],
		function(err, critical){
			deployer.config = replacePlaceHolders(deployer.config);
			if(deployer.config.project.documentation){
				if(!deployer.config.project.documentation.resources){
					deployer.config.project.documentation.resources = {
						url: composeUrl({base: "url"}, 0,2) + "/resources",
						path: composeUrl({base: "path"}, 0,2) + "/resources"
					}
				}
			}
			if(!deployer.config.version_history){
				deployer.config.version_history = {};
			}
			if(typeof err != "undefined" && err !== true){
				if(typeof critical === "undefined")
					critical = true;
				throwError(err, critical);
			}

			return getFilesRec(process.cwd(), function(err, files){
				if(cli.opts()["dump_config"])
					deployer.log.always("Configuration: " + JSON.stringify(deployer.config, null, 4));

				deployer.config.files = files;


				function reformatHelp(output){
					output = output.replace(/\s*Usage:.*(\s*^\s*$\s)*/gm, "").replace(/\s*Options(\s|.)*/gm,"");
					output = colour.italic(output);
					return "\n"+output+"\n\n";
				}

				if(dry){
					const helpCli = new commander.Command();
					helpCli.command("help").description("Output the help.").action(function(){
						innerCli.outputHelp(reformatHelp);
					});

					for(var command in deployer.config.project.commands){
						var tmpcmd = deployer.config.project.commands[command];
						deployer.log.verbose("Registering command "+command);
						helpCli.command(command).description(
							(tmpcmd.description ? tmpcmd.description : "") +
							(tmpcmd.description && tmpcmd.awake ? " - " : "") +
							(tmpcmd.awake ? colour.underline("Open listening CLI") : "")
						);
					}
					helpCli.help(reformatHelp);
				} else {
					var exit = false;
					var initialCmd = deployer.config.project.commands[deployer.config.action];
					if(initialCmd){
						if(initialCmd.awake){ // If the command used for initialization is awake (IE, if it will keep deployer command line up)
							// Create the inner CLI
							const innerCli = new commander.Command();

							// This callback will be assigned later. It is called by every innerCLI action
							var clicb = null;

							innerCli.command("help [command]").description("Output the help. [command] is optionnal.").action(function(askedCmd){
								if(typeof askedCmd == "undefined"){
									innerCli.outputHelp(reformatHelp);
									if(clicb != null && clicb.constructor.name == "Function"){
										return clicb();
									}
								} else {
									console.log("Requested help for ",askedCmd);
								}
							});
							innerCli.command("exit").description("Exit the program").action(function(){
								exit = true;
								if(clicb != null && clicb.constructor.name == "Function"){
									clicb();
								}
							});
							innerCli.on("*", function(c){
								console.log();
								deployer.log.info("Command " + colour.red(c) + " does not exist");
								innerCli.outputHelp(reformatHelp);
								if(clicb != null && clicb.constructor.name == "Function"){
									return clicb();
								}
							});

							for(var command in deployer.config.project.commands){
								var tmpcmd = deployer.config.project.commands[command];
								if(!tmpcmd.awake){
									deployer.log.verbose("Registering command "+command);
									var commandHelp = "";
									var tmpcli;
									if(tmpcmd.arguments && Object.keys(tmpcmd.arguments).length){
										deployer.log.verbose("Command "+command+" have arguments.");
										commandHelp = colour.bold("For more informations, run " + colour.blue("help " + command));
									}
									if(tmpcmd.description){
										tmpcli = innerCli.command(command).description(tmpcmd.description + "    " + commandHelp);
									} else {
										tmpcli = innerCli.command(command).description(commandHelp);
									}
									for(var i in tmpcmd.arguments){
										var optDesc = tmpcmd.arguments[i] ? tmpcmd.arguments[i] : "No description available";
										tmpcli.option("--"+i, optDesc);
									}
									tmpcli.action((function(){
										var cmd = command;
										return function(){
											if(clicb != null && clicb.constructor.name == "Function"){
												execCommandRoot(cmd,clicb);
											}
										}
									})());
								}
							}

							execCommandRoot(deployer.config.action, function(err){
								innerCli.outputHelp(reformatHelp);
								rl.setPrompt(colour["green"](colour["bold"]("    => ")));
								rl.on('close',function(){
									process.exit(0);
								});
								async.doUntil(
									function(cb){
										rl.prompt();
										rl.on('line', function(data){
											var args = [process.argv[0],process.argv[1]].concat(spawnargs(data)); // Prepend to allow the args to be run by commander
											rl.pause();
											rl.removeAllListeners('line');
											clicb = cb;
											innerCli.parse(args);
										});
									},
									function(){return exit},
									function(){
										deployer.log.always("Exiting...");
										rl.close();
									}
								);
							});
						} else {
							execCommandRoot(deployer.config.action,function(){});
						}
					} else {
						deployer.log.error('Tried to launch Deployer with unexistent action "' + deployer.config.action + '"');
					}
				}
				//return execCommandGroups(files);
			});
		}
	);
}

function execCommandRoot(command, callback){
	var cmds = deployer.config.project.commands;
	if(cmds[command]){
		deployer.log.silly('Running command "' + command + '".');
		var cmd = cmds[command];
		deployer.log.verbose('Command "' + command + '" config:',cmd);
		if(cmd.command_group){
			if(typeof cmd.arguments != "undefined" && cmd.arguments != null && cmd.arguments.constructor.name == "Array"){ // If this command requires global arguments
				return async.map(cmd.arguments, function(argument, cb){
					// Enqueue prompt with text query
					requestPrompt('Please provide a value for argument "'+argument+'": ', function(argVal){
						return cb(null, argVal);
					})
				}, function(err, values){
					console.log(values);
					return execCommandGroup(cmd, "", callback);
				})
			} else {
				return execCommandGroup(cmd, "", callback);
			}
		}
	} else {
		deployer.log.error('Command "' + command + '" is not configured.');
	}
	if(typeof callback != "undefined"){
		deployer.log.info("Listen");
		callback();
	}
}

function execCommandGroup(command, prefix, callback){
	var act = (command.actions.length > 0);
	var mod = (["serie","parallel"].indexOf(command.mode) > -1);
	if(act ^ mod){
		deployer.log.error("Misconfigured command group "+prefix+": missing action or mode");
		callback();
	} else {
		if(!act && !mod){
			deployer.log.silly("Empty command, return");
			callback();
		} else {
			if(prefix)
				prefix += ".";

			deployer.log.silly("Executing in mode " + command.mode);
			var mode = command.mode == "serie" ? "forEachOfSeries" : "forEachOf";
			async[mode](command.actions, function(action,index,cb){
				var timestart = (new Date()).getTime();
				deployer.log.info("====> Starting action " + prefix + index + ": " + action.action);
				if(action.command_group){
					execCommandGroup(action.actions, prefix + index, callback);
				} else {
					deployer.log.silly("Action: ", JSON.stringify(action));
					var handler = require("./actions/" + action.action + ".js");
					// If the handler exists and can process
					if(handler){
						if(handler.process){					
							// Prepare required arguments
							if(typeof handler.arguments != "undefined" && handler.arguments != null){ // If there are some args...
								var ret;
								if(handler.arguments.constructor.name == "Function"){ // ... and this is a function...
									ret = handler.arguments(action.data);// ... execute
								} else { // ..., else,
									ret = handler.arguments; // Simply get them
								}
								if(typeof ret != "undefined" && ret != null){ // If this action needs arguments
									if(ret.constructor.name != "Array") // Force cast it to array
										ret = [ret];
								}
								deployer.log.verbose("Action " + key + " requires following args: ", ret);
							}
							return handler.process(action.data, function(){
								deployer.log.info("====> Finished action " + index + ": " + action.action + " after " + ((new Date()).getTime() - timestart) + "ms");
								return cb();
							});
						} else {
							var err = 'Action "' +action.action+'" has no method '+colour.italic("process")+'!';
							deployer.log.error(err)
							return cb(err)
						}
					} else {
						var err = 'Action "' +action.action+'" not found!';
						deployer.log.error(err)
						return cb(err)
					}
				}
			}, function(err){
				if(err)
					deployer.log.error(err);
				callback(err);
			});
		}
	}
}


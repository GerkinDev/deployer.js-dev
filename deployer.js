/**
 * @file deployer.js Global deployment handler
 * @description false
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.3
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

var Command = require('./objects/command.js');
var Arguments = require('./objects/arguments.js');

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
    }
};

var actionObjects;

function load(){
    deployer.config = {
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
    actionObjects = {};

    /**
     * @todo Describe options
     */

    getModuleVersion("deployer", function(){
        cli.version(deployer.config.moduleVersion.deployer);
        cli.option('-d, --dump_config', 'Dump the compiled config file', false);
        //cli.option('-t, --terminal', 'Run into console', false);
        cli.option('-l, --log_level <level>', 'Set the log level', /^(silly|verbose|info|warn|error|silent)$/i, false);
        cli.option('-g, --global_config_file <path>', 'Will use the file <path> as global base config file', /.*\.json(?![^a-zA-Z])$/, "config.global.json");
        cli.option('-c, --config_file <path>', 'Will use the project file <path>', /.*\.json(?![^a-zA-Z])$/, "deployer_config.json");
        cli.command('dry-run').description("Get help for commands available with current config").action(function(){
            handleCli(deployer.config);
            deployer.config.action = null;
            return run(true);
        });
        cli.command('help').description("Get help for commands & options").action(function(){
            handleCli(deployer.config);
            deployer.config.action = null;
            cli.outputHelp();
        });
        cli.command('*').description("The name of the command you want to use").action(function(action){
            handleCli(deployer.config);
            deployer.config.action = action;
            return run();
        });
        cli.parse(process.argv);

        if(cli.args.length == 0){ // Nothing was given
            handleCli(deployer.config);
            return run();
        }
    });
}
load();

/**
 * Put command-line options into the program config
 * @author Gerkin
 * @param   {object}    conf Base configuration
 * @returns {object} Configuration modified by commandline args
 */
function handleCli(conf){
    conf.configFile = cli.opts()["config_file"];
    conf.globalConfigFile = cli.opts()["global_config_file"];
    if(cli.opts()["log_level"]){
        conf.loglevel = cli.opts()["log_level"];
    }
    conf.dump = cli.opts()["dump_config"];
    // conf.no_gui = is_na(cli.opts()["terminal"]) ? false : cli.opts()["terminal"] && false;// Remove && false

    init = false;
    return conf;
}

/**
 * Parse each config files provided in array, from lower to higher priority
 * @author Gerkin
 * @param {null|string|string[]} globalConfigFiles One or several paths that leads to config files in APP FOLDER. Will be parsed BEFORE localConfigFiles
 * @param {null|string|string[]} localConfigFiles One or several paths that leads to config files in CURRENT FOLDER. Will be parsed AFTER globalConfigFiles
 * @param {Function} callback Function to run afterwards. Must take error as 1st arg, and config object as 2nd arg
 * @return {undefined} Async
 */
function parseConfig(globalConfigFiles, localConfigFiles, callback){
    if(typeof globalConfigFiles == "undefined" || globalConfigFiles == null)
        globalConfigFiles = [];
    if(globalConfigFiles.constructor != Array)
        globalConfigFiles = [globalConfigFiles];

    if(typeof localConfigFiles == "undefined" || localConfigFiles == null)
        localConfigFiles = [];
    if(localConfigFiles.constructor != Array)
        localConfigFiles = [localConfigFiles];


    var filesConfObj = {};
    async.parallel({
        global:function(catCallback){
            return async.mapSeries(globalConfigFiles, function(file, configFileCallback){
                return parseFile(file, true, configFileCallback)
            }, function(err,filesConfObj){
                if(err)
                    deployer.log.error(err);
                return catCallback(err, filesConfObj);
            });
        },
        local:function(catCallback){
            return async.mapSeries(localConfigFiles, function(file, configFileCallback){
                return parseFile(file, false, configFileCallback)
            }, function(err,filesConfObj){
                if(err)
                    deployer.log.error(err);
                return catCallback(err, filesConfObj);
            });
        }
    }, function(err, configs){
        return callback(err, handleCli(merge.recursive(merge.recursive.apply([],configs.global), merge.recursive.apply([],configs.local))));
    })
}

/**
 * Parse a single config file from the appropriated path.
 * @author Gerkin
 * @param   {string} filename The name/path of the file to parse
 * @param   {boolean} global   Set to true to search in APP folder. False to search in CWD
 * @param   {Function} callback Function to execute afterwards. Takes the error as 1st parameter, the parsed config obj as 2nd parameter
 * @returns {undefined} Async
 */
function parseFile(filename, global, callback){
    var configFilePath;
    async.waterfall([
        function(cb){ // search global config file
            configFilePath = path.resolve(global ? __dirname : ".", filename);
            return fs.access(configFilePath, fs.W_OK, cb);
        },
        function(cb){ // Read global config file
            deployer.log.verbose("Found " + (global ? "GLOBAL" : "LOCAL") + " config file " + configFilePath);
            return fs.readFile(configFilePath, 'UTF-8', cb);
        },
        function(str, cb){ // parse global config file
            try{
                var configObj = JSON.parse(str);
                return cb(null, configObj);
            } catch(e) {
                deployer.log.error("Parse error of " + (global ? "GLOBAL" : "LOCAL") + " config file " + configFilePath + ": ", e);
                return cb(e, {});
            }
        }
    ], function(err, config){
        return callback(err, handleCli(config));
    });
}

/**
 * Filter the top part of the Commander help (`usage`)
 * @author Gerkin
 * @param   {string} output Help provided by Commander
 * @returns {string} Reformated help
 */
function reformatHelp(output){
    output = output.replace(/\s*Usage:.*(\s*^\s*$\s)*/gm, "").replace(/\s*Options(\s|.)*/gm,"");
    output = colour.italic(output);
    return "\n"+output+"\n\n";
}

/**
 * Display help once config files are parsed
 * @author Gerkin
 */
function dryHelp(){
    const helpCli = new commander.Command();
    helpCli.command("help").description("Output the help.").action(function(){
        innerCli.outputHelp(reformatHelp);
    });

    // Add all commands
    for(var command in deployer.config.project.commands){
        var tmpcmd = deployer.config.project.commands[command];
        deployer.log.silly("Registering command "+command);
        helpCli.command(command).description(
            (tmpcmd.description ? tmpcmd.description : "") +
            (tmpcmd.description && tmpcmd.awake ? " - " : "") +
            (tmpcmd.awake ? colour.underline("Open listening CLI") : "")
        );
    }
    helpCli.help(reformatHelp);
}

function endProgram(){
    rl.close();
}

/**
 * Launch the program
 * @author Gerkin
 * @param   {boolean} [dry=false] Set to true to parse the config file and output the available commands
 * @returns {undefined}
 */
function run(dry){
        if(typeof dry == "undefined")
            dry = false;
        deployer.log.verbose('Executing action "'+deployer.config.action+'"');
        var configFilePath;
        deployer.config.base_path = __dirname;
        async.series([
            function(cb){
                return parseConfig(deployer.config.globalConfigFile,deployer.config.configFile, function(err, config){
                    deployer.config = merge.recursive(deployer.config, config);
                    console.log(deployer.config);
                    if(err){
                        deployer.log.error(err);
                    }
                    if(deployer.config["dump_config"] === true)
                        deployer.log.always("Configuration: " + JSON.stringify(deployer.config, null, 4));
                    return cb();
                });
            },
            function(cb){
                return getFilesRec(process.cwd(), function(err, files){
                    deployer.files = files;
                    return cb(err);
                });
            }
        ], function(err){
            // Parse commands
            for(var command in deployer.config.project.commands){
                try{
                    actionObjects[command] = new Command(deployer.config.project.commands[command]);
                    console.log(actionObjects[command]);
                } catch(e){
                    deployer.log.error("Error while parsing command \"" + command + "\": " + e);
                }
            }
            var arg = new Arguments({
                hello: {
                    dude: "world"
                },
                how: {
                    _type: "prompt"
                },
                yop: "${how}${ hello.dude }"
            });
            arg.brewArguments(function(values){
                console.log("Output values: ", values, arg);
            });
            return;

            if(dry){
                return dryHelp();
            } else {
                var initialCmd = deployer.config.project.commands[deployer.config.action];
                if(initialCmd){
                    if(initialCmd.awake){ // If the command used for initialization is awake (IE, if it will keep deployer command line up)
                        // Create the inner CLI
                        return runPermanentCli();
                    } else {
                        console.log(actionObjects, deployer.config.action);
                        actionObjects[deployer.config.action].execute(endProgram);
                        /*return execCommandRoot(deployer.config.action, function(){
                        rl.close();
                    });*/
                    }
                } else {
                    deployer.log.error('Tried to launch Deployer with unexistent action "' + deployer.config.action + '"');
                }
            }
        });
}

function runPermanentCli(){
    const innerCli = new commander.Command();

    // This callback will be assigned later. It is called by every innerCLI action
    var clicb = null;
    var exit = false;

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
            return clicb();
        }
    });
    innerCli.command("reload").description("Reload the configuration file. Use if changed on the fly").action(load);
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
                        return execCommandRoot(cmd,clicb);
                    }
                }
            })());
        }
    }

    deployer.log.silly("Running pre-listen actions");
    return execCommandRoot(deployer.config.action, function(err){
        deployer.log.silly("Pre-listen actions done");
        innerCli.outputHelp(reformatHelp);
        rl.setPrompt(colour["green"](colour["bold"]("    => ")));
        rl.on('close',function(){
            process.exit(0);
        });
        return async.doUntil(
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
}


function execCommandRoot(command, callback){
    var cmds = deployer.config.project.commands;
    if(cmds[command]){
        deployer.log.silly('Running command "' + command + '".');
        var cmd = cmds[command];

        // If called with -d/--dump_config
        if(deployer.config["dump_config"] === true)
            deployer.log.verbose('Command "' + command + '" config:',cmd);

        // If the command is a listener
        if(cmd.awake){
            var deletedIndex = [];
            for(var i = 0, j = cmd.actions.length; i < j; i++){
                var action = cmd["actions"][i];
                // If this action uses events
                if(action.events){
                    console.log(action, "is event listener");
                    deletedIndex.unshift(i);

                    var handler = require("./actions/" + action.action + ".js");
                    var fctL = handler.processSingle;

                    if(typeof fctL == "function"){
                        for(var event in action.events){
                            var eventConf = action.events[event];
                            var eventFiles = filesFromSelectors(eventConf["selection"]);
                            console.log("For event ",event,eventFiles);
                            for(var k = 0, l = eventFiles.length; k < l; k++){
                                switch(event){
                                    case "onchange":{
                                        var filenameL = path.resolve(".", eventFiles[k]);
                                        fs.watch(path.resolve(".", eventFiles[k]), (function(){
                                            var fn = filenameL;
                                            var conf = action.data;
                                            var fct = fctL;
                                            var singleProcess = function(callback){
                                                return fct(conf,fn, nextSingleProcess,callback);
                                            }
                                            if(eventConf.warmup === true){
                                                singleProcess();
                                            }
                                            return singleProcess;
                                        })());
                                    } break;
                                }
                            }
                        }
                    } else {
                        console.log("Action " + action.action + " have no processSingle function"); 
                    }
                } else {
                    console.log(action, "is runnable action");
                }
            }
        } else if(cmd.command_group){ // If this is not a listener, this may be a command group
            deployer.log.silly("Command group:", cmd);
            var args = merge.recursive(deployer.config.project.arguments, true);
            deployer.log.always("Arguments from config:", args);
            if(typeof cmd.arguments != "undefined" && cmd.arguments != null && cmd.arguments.constructor.name == "Object"){ // If this command requires global arguments
                // Filter to take config args
                return transformArguments(args, cmd.arguments, function(err, childArguments){
                    return execCommandGroup(cmd, childArguments, "", callback);
                });
            } else {
                return execCommandGroup(cmd, args, "", callback);
            }
        } else { // This is neither a listener nor a command group: what is it?
            deployer.log.warn("Action \"" + command + "\" can't be identified neither as a listener nor as a command group...");
        }
    } else {
        deployer.log.error('Command "' + command + '" is not configured.');
    }
    if(typeof callback != "undefined"){
        deployer.log.info("Listen");
        return callback();
    }
}

function nextSingleProcess(config,filename,callback){
    if(config.next && config.next.action){
        var action = config.next
        var handler = require("./actions/" + action.action + ".js");
        var fct = handler.processSingle;

        if(typeof fct == "function"){
            return fct(action.data, filename, nextSingleProcess,callback);
        }
    } else { // If this was the last action, call the callback
        if(typeof callback == "function")
            callback();
    }
}

function execCommandGroup(command, args, prefix, callback){
    deployer.log.silly("Command:",command);
    deployer.log.silly("Arguments:",args);
    var act = (command.actions.length > 0);
    var mod = (["serie","parallel"].indexOf(command.mode) > -1);
    if(act ^ mod){
        deployer.log.error("Misconfigured command group "+prefix+": missing action or mode");
        return callback();
    } else {
        if(!act && !mod){
            deployer.log.silly("Empty command, return");
            return callback();
        } else {
            if(prefix)
                prefix += ".";

            var mode = command.mode == "serie" ? "forEachOfSeries" : "forEachOf";
            if(prefix === ""){
                deployer.log.silly("==> Starting root level");
            } else {
                deployer.log.silly("==> Starting level " + prefix);
            }
            return async[mode](command.actions, function(action,index,cb){
                // argsObjAction contains args for specific action.

                return transformArguments(args,action.arguments, function(err,argumentsChild){
                    // argumentsChild contains the associative array containing vars adapted to specified rules
                    if(action.command_group){
                        return execCommandGroup(action, argumentsChild, prefix + index, cb);
                    } else {
                        deployer.log.silly("Action: ", JSON.stringify(action));
                        (function(){
                            var handler = require("./actions/" + action.action + ".js");
                            // If the handler exists and can process
                            if(handler){
                                deployer.log.silly("Handler exists for " + action.action);
                                if(handler.process){
                                    deployer.log.silly("Handler.process exists " + action.action);	
                                    // Prepare required arguments

                                    // Call it when args are OK
                                    function execAction(){
                                        var timestart = (new Date()).getTime();
                                        deployer.log.info("====> Starting action " + prefix + index + ": " + action.action);
                                        var actionDatas = replacePlaceHolders(action.data, argumentsChild);
                                        deployer.log.silly("Processing with " + action.action,handler.toString());
                                        return handler.process(
                                            actionDatas,
                                            (function(){
                                                deployer.log.silly("Copying callback for " + action.action);
                                                var localcb = cb;
                                                return function(err){
                                                    deployer.log.info("====> Finished action " + prefix + index + ": " + action.action + " after " + ((new Date()).getTime() - timestart) + "ms");
                                                    return localcb(null);
                                                };
                                            })()
                                        );
                                    }

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
                                        deployer.log.verbose("Action " + action.action + " requires following args: ", ret);
                                        console.log(argumentsChild);


                                        ret = ret.filter(function(elem){
                                            return Object.keys(argumentsChild).indexOf(elem) == -1;
                                        });

                                        return async.each(ret, function(elem,cb1){
                                            return requestPrompt("Please provide a value for action argument \"" + elem + "\" in action \"" + action.action + "\": ", function(val){
                                                argumentsChild[elem] = val;
                                                return cb1();
                                            });
                                        }, function(){
                                            console.log("Dump all",argumentsChild);
                                            return execAction();
                                        });
                                    } else {
                                        return execAction();
                                    }
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
                        })();
                    }
                });
            }, function(err){
                if(prefix === ""){
                    deployer.log.silly("==> Ended root level");
                } else {
                    deployer.log.silly("==> Ended level " + prefix);
                }
                if(err)
                    deployer.log.error(err);
                return callback(err);
            });
        }
    }
}


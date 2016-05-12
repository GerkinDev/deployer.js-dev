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

const Command = require('./objects/command.js');
const Arguments = require('./objects/arguments.js');

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
        deployer.log.silly(`Registering command "${ command }.`);
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
                //console.log(actionObjects[command]);
            } catch(e){
                deployer.log.error("Error while parsing command \"" + command + "\": ", e, e.stack);
            }
        }/*
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
            return;*/

        if(dry){
            return dryHelp();
        } else {
            var initialCmd = actionObjects[deployer.config.action];
            if(initialCmd){
                console.log(actionObjects, deployer.config.action);
                if(initialCmd.type == Command.Type.PERMANENT){ // If the command used for initialization is awake (IE, if it will keep deployer command line up)
                    // Create the inner CLI
                    return runPermanentCli();
                } else if(initialCmd.type == Command.Type.MOMENTARY){
                    initialCmd.setArgumentsGlobal(deployer.config.project.args).execute(endProgram);
                } else {
                    deployer.log.error(`Tried to launch Deployer with command having unexistent type value "${ initialCmd.type }".`);
                }
            } else {
                deployer.log.error(`Tried to launch Deployer with unexistent command "${ deployer.config.action }".`);
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
    return async.doUntil(
        function(cb){
            rl.on('close',function(){
                console.log("");
                process.exit(0);
            });
            rl.setPrompt(colour["green"](colour["bold"]("    => ")));
            rl.prompt();
            rl.on('line', function(data){
                var args = [process.argv[0],process.argv[1]].concat(spawnargs(data)); // Prepend to allow the args to be run by commander
                rl.pause();
                rl.removeAllListeners('line');
                clicb = cb;
                innerCli.parse(args);
            });
        },
        () => exit,
        function(){
            deployer.log.always("Exiting...");
            rl.close();
        }
    );
    /*return execCommandRoot(deployer.config.action, function(err){
        deployer.log.silly("Pre-listen actions done");
        innerCli.outputHelp(reformatHelp);
        rl.setPrompt(colour["green"](colour["bold"]("    => ")));
        rl.on('close',function(){
            process.exit(0);
        });
    });*/
}
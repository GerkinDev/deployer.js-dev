/**
 * @file deployer.js Global deployment handler
 * @description false
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.25
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
			"error"
		],
		silly: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"rainbow","1":"silly"}));},
		verbose: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"blue","1":"verbose"}));},
		info: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"cyan","1":"info"}));},
		warn: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"yellow","1":"warn"}));},
		error: function(string){deployer.log.custom.apply( this, composeLog(arguments, {'0':"red","1":"error"}));},
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
				/*if(deployer.log.levels.indexOf(level) >= deployer.log.levels.indexOf("warn"))
					console.trace();*/
			}
		},
	},
	config: {
		globalConfigFile: "config.global.json",
		configFile: "config.json",
		loglevel: "silly",
		excludeExplore: [
			"^.\\/node_modules($|\\/.+)"
		]
	}
};
/**
 * @todo Describe options
 */



/**
 * @class action
 */

/**
 * @method process
 * @memberof deployer~action
 */

/**
 * @method test
 * @memberof deployer~action
 */



/**
 * @function __autoexec
 * @desc This init function execute itself as soon as module is included
 * @package deployer.js
 * @abstract
 */
(function(){
	deployer.config = merge(deployer.config, checkArgs());
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
					return cb();
				} catch(e) {
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
					return cb();
				} catch(e) {
					deployer.log.warn("Invalid JSON file " + file + ": " + JSON.stringify(e));
					return cb(e , false);
				}
			},
		],
		function(err, critical){
			deployer.config = replacePlaceHolders(deployer.config);
			if(!deployer.config.project.documentation.resources)
				deployer.config.project.documentation.resources = {
					url: composeUrl({base: "url"}, 0,2) + "/resources",
					path: composeUrl({base: "path"}, 0,2) + "/resources"
				}
				if(!deployer.config.version_history){
					deployer.config.version_history = {};
				}
			init = false;
			if(typeof err != "undefined" && err !== true){
				if(typeof critical === "undefined")
					critical = true;
				throwError(err, critical);
			}

			getFilesRec(process.cwd(), function(err, files){
				deployer.log.silly("Configuration: " + JSON.stringify(deployer.config, null, 4));
				execCommandGroups(files);
			});
		}
	);
})();

/**
 * @function checkArgs
 * @desc Retrive arguments, check them and build an object with them
 * @return Parsed arguments
 * @private
 */
function checkArgs(){
	var args = process.argv.slice(2);
	var r = {}
	if(args.length < 1){
		deployer.log.error("Should be called this way:")
		deployer.log.error(process.argv[0] + " " + process.argv[1] + " [version] [optional: config file]");
		process.exit(1);
	}

	if(!args[0].match(/\d+(\d+\.)*/)){
		deployer.log.error("Version " + args[0] + " is not a valid format.");
		process.exit(1);
	}
	r["version"] = args[0];
	r["minor_version"] = r.version.replace(/^(\d+\.\d+).*$/, "$1");

	if(args[1])
		r["configFile"] = args[1];
	return r;
}

/**
 * @function execCommandGroups
 * @desc Dispatch actions to submodules
 * @param   {array} files Files returned by {@link getFilesRec}
 * @private
 */
function execCommandGroups(files){
	var i = 1;
	var timestartGroup;
	async.eachSeries(deployer.config.project.commands, function(commandGroup, cb1){
		timestartGroup = (new Date()).getTime();
		deployer.log.info("========> Processing group " + (i++));
		if(commandGroup != null && typeof commandGroup != "undefined" && commandGroup.constructor.name == "Object"){
			execParallelCommandGroup(files, commandGroup, function(err){
				deployer.log.info("========> Finished group " + (i - 1) + " after " + ((new Date()).getTime() - timestartGroup) + "ms");
				cb1(err)
			});
		} else if(commandGroup.constructor.name == "Array"){
			async.each(commandGroup, function(subCommandGroup, cb2){
				execParallelCommandGroup(files, subCommandGroup, cb2);
			}, function(err){
				deployer.log.info("========> Finished group " + (i - 1) + " after " + ((new Date()).getTime() - timestartGroup) + "ms");
				cb1(err);
			});
		} else {
			deployer.log.error("Unhandled type for commandGroup " + (i - 1) + ": " + typeof commandGroup);
			deployer.log.info("========> Finished group " + (i - 1) + " after " + ((new Date()).getTime() - timestartGroup) + "ms");
			cb1();
		}
	}, function(err){
		if(err){
			throwError(err, true);
		} else {
			deployer.log.info("-=- Deployer ended ok -=-");
			// Write 
		}
		process.removeAllListeners("uncaughtException");
		process.removeAllListeners("unhandledRejection");
		process.exit();
	});
}

/**
 * @function execSyncCommandGroup
 * @desc Dispatch actions to submodules
 * @param   {array} files Files returned by {@link getFilesRec}
 * @private
 */
function execParallelCommandGroup(files, group, cb){
	async.forEachOf(group, function(value, key, cb2){
		var timestart = (new Date()).getTime();
		deployer.log.info("====> Starting action " + key);
		var handler = require("./actions/" + key + ".js");
		handler.process(value, files, function(){
			deployer.log.info("====> Finished action " + key + " after " + ((new Date()).getTime() - timestart) + "ms");
			cb2();
		});
	}, function(err){
		cb(err);
	});
}

/**
 * @file Global functions used through Deployer.js package
 * @description Retrieve all files from path, excluding ones in the {@link deployer}.config.excludeExplore
 *
 * @author false
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.11
 */

throwError = function(error, critical){
}/*
	if(typeof critical == "undefined"){
		critical = false;
	}

	var text = colour["italic"](JSON.stringify(error));
	if(critical){
		deployer.log.error(text);
		process.exit(1);
	} else {
		deployer.log.warn(text);
	}
}*/

/**
 *
 * @method getFilesRec
 * @param {callback} cb Callback to call afterwards. Returns (err, files)
 * @returns {undefined}
 */
getFilesRec = function(path, cb){
	var out = [];
	var dirs = {};
	fs.readdir(path, function(err, files){
		if(err){
			throwError(err);
		}
		async.each(files, function(file, cb1){
			// Used with fs
			var filepath = path + "/" + file;
			// Used for regex match
			var transformedPath = filepath.replace(process.cwd(), '.');
			fs.stat(filepath, function(err, stat){
				if(err){
					throwError(err);
				} else {
					if(stat.isDirectory()){

						var isOk = true;
						for(var i = 0, j = deployer.config.excludeExplore.length && isOk; i < j; i++){
							var excludedPath = deployer.config.excludeExplore[i];
							if(transformedPath.match(new RegExp(excludedPath))){
								isOk = false;
							}
						}
						if(isOk){
							getFilesRec(filepath, function(err, subfiles){
								if(err){
									throwError(err);
								}
								dirs[file] = subfiles;
								cb1()
							});
						} else {
							cb1();
						}
					} else {
						out.push(file);
						cb1();
					}
				}
			});
		}, function(err){
			if(Object.keys(dirs).length > 0){
				out.push(dirs);
			}
			cb(err, out);
		});
	})
}

checkFiles = function(files, regex, status, basePath, force){
	if(typeof basePath == "undefined"){
		basePath = ".";
	}
	if(typeof force == "undefined"){
		force = false;
	}
	for(var file in files){
		var match = (basePath + "/" + file).match(regex);
		if(force || match){
			if(typeof files[file] == "boolean"){
				files[file] = status
			} else {
				files[file].included = status;
			}
		}
		if(typeof files[file] != "boolean"){
			files[file].files = checkFiles(files[file].files, regex, status, basePath + "/" + file, force || match);
		}
	}
	return files;
}

reformatFiles = function(files){
	var ret = {};
	for(var i = 0, j = files.length; i < j; i++){
		if(typeof files[i] === "object"){
			for(var k = Object.keys(files[i]), l = 0, m = k.length; l < m; l++){
				ret[k[l]] = {included: false, files: reformatFiles(files[i][k[l]])};
			}
		} else {
			ret[files[i]] = false;
		}
	}
	return ret;
}

filesStructToArray = function(files, basepath){
	if(typeof basepath == "undefined"){
		basepath = ".";
	}
	var ret = [];
	for(var file in files){
		var filepath = basepath + "/" + file;
		if(typeof files[file] == "boolean"){
			if(files[file]){
				ret.push(filepath);
			}
		} else {
			ret = ret.concat(filesStructToArray(files[file].files, filepath));
		}
	}
	return ret;
}

replacePlaceHolders = function(obj){
	if(obj == null){
		return obj;
	} else if(typeof obj == "object" && obj != null && obj.constructor != Array){
		var ret = {};
		for(var i in obj){
			ret[i] = replacePlaceHolders(obj[i]);
		}
		return ret;
	} else if(obj.constructor == Array){
		var ret = [];
		for(var i = 0, j = obj.length; i < j; i++){
			ret.push(replacePlaceHolders(obj[i]));
		}
		return ret;
	} else if(typeof obj == "string"){
		return obj.replace(/%VERSION_MINOR%/g, deployer.config.minor_version).replace(/%VERSION%/g, deployer.config.version).replace(/%PROJECT%/g, deployer.config.project.project_name);
	} else {
		return obj;
	}
}

mkdir = function(path, root) {

	var dirs = path.split('/'), dir = dirs.shift(), root = (root || '') + dir + '/';

	try { fs.mkdirSync(root); }
	catch (e) {
		//dir wasn't made, something went wrong
		if(!fs.statSync(root).isDirectory()) throw new Error(e);
	}

	return !dirs.length || mkdir(dirs.join('/'), root);
}

composeUrl = function(args, from, to){
	var composed = deployer.config.project.documentation.format.slice(from, to).join("/");
	if(args.base == "url"){
		composed = composed.replace("%BASE%", deployer.config.project.documentation.base.url)
	} else if(args.base == "path"){
		composed = composed.replace("%BASE%", deployer.config.project.documentation.base.path);
	}
	if(args.type){
		composed = composed.replace("%TYPE%", args.type);
	}
	return composed;
}

readLocalConfigFile = function(cb){
	var file = path.resolve(".", deployer.config.configFile);
	fs.readFile(file, 'UTF-8', function(err, filecontent){
		if(err){
			return cb(err);
		}
		try{
			var configFile = JSON.parse(filecontent);
			return cb(null,configFile);
		} catch(e) {
			deployer.log.warn("Invalid JSON file " + file,e);
			return cb(e);
		}
	});
}

writeLocalConfigFile = function(filecontent, cb){
	var file = path.resolve(".", deployer.config.configFile);
	fs.writeFile(file, JSON.stringify(filecontent,null,4), function(err){
		cb(err);
	});
}

getModuleVersion = function(moduleName, callback){
	if(!deployer.config.moduleVersion)
		deployer.config.moduleVersion = {};
	fs.readFile(path.resolve(moduleName.match(/\.js$/) ? moduleName : moduleName + ".js"), "UTF-8", function(err, content){
		if(err){
			deployer.log.error("Could not find version of module \"" + moduleName + "\"");
			deployer.config.moduleVersion[moduleName] = "unknown"
		} else {
			var version = content.match(/^\/\*\*(?:\s|.)+?(@version\s+[\d\.\w]+)/);
			if(version[1] && content.indexOf(version) < content.indexOf("*/")){
				deployer.config.moduleVersion[moduleName] = version[1].replace(/@version\s+/,"");
			} else {
				deployer.config.moduleVersion[moduleName] = "unknown";
			}
		}
		callback();
	});
}

var enqueuedPrompts = [];
var runningPromp = null;
requestPrompt = function(question, callback){
	if(runningPromp == null){
		runningPromp = {question: question, cb: callback};
		rl.question(question, function(value){
			runningPromp.cb(value); // Call this prompt request callback
			runningPromp = null;
			if(enqueuedPrompts.length > 0){ // If other prompts were enqueued
				var newPrompt = enqueuedPrompts[0];
				enqueuedPrompts.slice(1);
				return requestPrompt(newPrompt.question, newPrompt.cb); // Execute the next prompt
			}
		})
	} else {
		enqueuedPrompts.push({question: question, cb: callback});
	}
}
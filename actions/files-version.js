/**
 * @file Set version at changes
 * @description false
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.3
 */

const checksum = require('checksum');
const readline = require('readline');

/**
 * @todo description {@link deployer}
 * @module actions/files-version
 * @implements {deployer.action}
 * @requires fs
 * @requires readline
 * @requires checksum
 */
module.exports = {
	/**
     * Process the generation operation with the config provided
	 * @method
     * @param   {object} config Options to explain to the module how to behave
     * @param   {array} files Files returned by {@link utils.getFilesRec}
     * @param   {callback} Function to call at the end of action
     * @returns {undefined}
     */
	process: function(config, files, cb){
		var reformatedFiles = reformatFiles(files);
		var selectors = Object.keys(config.selection)
		for(var i = 0, j = selectors.length; i < j; i++){
			var selector = selectors[i];
			try{
				var regex = new RegExp(selector);
			} catch(e){
				deployer.log.error(e);
			}
			reformatedFiles = checkFiles(reformatedFiles, regex, config.selection[selector]);
		}
		var filesArray = filesStructToArray(reformatedFiles);

		var checksums = {};

		async.each(filesArray, function(file, cb1){
			var filepath = path.resolve(".", file);
			async.parallel([
				function(cb2){
					checksum.file(filepath, {algorithm:"sha1"}, cb2);
				},
				function(cb2){
					checksum.file(filepath, {algorithm:"md5"}, cb2);
				}
			], function(err, returns){
				checksums[file] = {
					sha1: returns[0],
					md5: returns[1],
				}
				cb1(err);
			});
		}, function(err){
			if(err){
				deployer.log.error(err);
				return cb(err);
			}
			return readLocalConfigFile(function(err, localConfig){
				if(err){
					deployer.log.error(err);
					return cb(err);
				}
				if(!localConfig)
					return cb("Could not read config file");

				var filesChecked = [];
				async.forEachOfSeries(checksums, function(checksum, file, cb1){
					var localConfigChecksum = (localConfig.project.checksums ? localConfig.project.checksums[file] : false);
					if(!localConfigChecksum){
						return fileChanged(file, cb1);
					} else {
						var typesums = Object.keys(
							localConfigChecksum
						).concat(
							Object.keys(
								checksum
							)
						).filter(
							function(v,i,s){
								return s.indexOf(v)===i;
							}
						);
						var changed = false;
						for(var i = 0, j = typesums.length; i < j; i++){
							var type = typesums[i];
							changed |= (typeof checksum[type] != "undefined" && checksum[type] != null && typeof localConfigChecksum[type] != "undefined" && localConfigChecksum[type] != null && localConfigChecksum[type] != checksum[type]);
						}
						if(changed){
							return fileChanged(file, function(err, newChercksums){
								if(err){
									deployer.log.error(err)
									return cb1(err);
								}
								checksums[file] = newChercksums;
								cb1(err);
							});
						} else {
							return cb1();
						}
					}
				}, function(err){
					// Rewrite checksums
					localConfig.project.checksums = checksums;
					return writeLocalConfigFile(localConfig, cb);
				});
			});
		});
	}
}

function fileChanged(file, cb){
	var regexHeader = new RegExp((file.match(/\.php$/) ? "<\\?php[\\n\\s]*(?:.*\\n)?" : "^") + "(\\/\\*\\*\\n(?:\\s*\\*\\s*(?:@?.*)?\\n)*\\s*\\*\\/)");
	var filepath = path.resolve(".", file);
	fs.readFile(filepath, "UTF-8", function(err, content){
		var header = content.match(regexHeader);
		var infos = {
			fd:{
				file: false,
				description: false
			},
			legal:{
				"author":false,
				"copyright":false,
				"license":false,
				"package":false,
			},
			other:{},
			version:{
				version: false
			}
		};
		if(header != null && header.length >= 2 && header[1])
			header = header[1];
		if(!header){
			deployer.log.warn("File " + file + " has no file header");
		} else {
			deployer.log.silly("File " + file + " has changed");
			var splitInfos = /^[\f\t ]*\*[\f\t ]*(?!\/)(?:@(\w+))?[\f\t ]*(.*)??$/gm;
			var splittedHeader = header.match(splitInfos);
			var requiredInfos = ["file", "copyright", "license", "package", "author", "version"];
			for(var i = 0, j = splittedHeader.length; i < j; i++){
				var info = splittedHeader[i].match(new RegExp(splitInfos.source));
				if(typeof info[1] == "undefined"){
					if(typeof info[2] != "undefined"){
						infos["fd"]["description"] = (infos["fd"]["description"] ? infos["fd"]["description"] : "") + info[2];
					}
				} else {
					var index = requiredInfos.indexOf(info[1]);
					if(index > -1)
						requiredInfos.splice(index, 1);
					switch(info[1]){
						case "file":{
							infos["fd"]["file"] = info[2];
						} break;

						case "description":
						case "desc": {
							infos["fd"]["description"] = (infos["fd"]["description"] ? infos["fd"]["description"] : "") + info[2];
						} break;

						case "copyright":
						case "license":
						case "package":
						case "author":{
							infos["legal"][info[1]] = info[2];
						} break;

						case "version":{
							infos["version"][info[1]] = info[2];
						} break;

						default:{
							infos["other"][info[1]] = info[2];
						} break;
					}
				}
			}
		}
		checkHeaderDatas(infos, file, function(infosMod){
			infosMod["version"]["version"] = deployer.config.version;
			if(Object.keys(infosMod["other"]).length == 0)
				delete infosMod["other"];
			var docblock = "/**";
			for(var type in infosMod){
				docblock += "\n";
				for(var data in infosMod[type]){
					docblock += " * @" + data + " " + infosMod[type][data] + "\n";
				}
				docblock += " *";
			}
			docblock += "/";
			if(header){
				content = content.replace(header, docblock);
			} else {
				content = content.replace(new RegExp("(" + (file.match(/\.php$/) ? "<\\?php" : "^") + ")"), "$1\n\n" + docblock + "\n\n");
			}
			return fs.writeFile(filepath, content, cb);
		});
	});
}

function checkHeaderDatas(infos, file, cb){
	var headWasLogged = false;
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	async.series([
		function(cb1){
			if(!infos["fd"]["file"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				rl.question("Please provide a file description: ", function(value){
					infos["fd"]["file"] = value;
					cb1();
				});
			} else {
				cb1();
			}
		},
		function(cb1){
			if(!infos["legal"]["copyright"]){
				var y = (new Date()).getFullYear();
				infos["legal"]["copyright"] = y + " " + deployer.config.project.company.name
			}
			cb1();
		},
		function(cb1){
			if(!infos["legal"]["license"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				rl.question("Please give the URL to the license: ", function(url){
					rl.question("Please provide the license name: ", function(name){
						infos["legal"]["license"] = url + " " + name;
						cb1();
					});
				});
			} else {
				cb1();
			}
		},
		function(cb1){
			if(!infos["legal"]["package"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				rl.question("Please provide a package name: ", function(name){
					infos["legal"]["package"] = name;
					cb1();
				});
			} else {
				cb1();
			}
		},
		function(cb1){
			if(!infos["legal"]["package"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				rl.question("Please provide the author name: ", function(name){
					infos["legal"]["author"] = name;
					cb1();
				});
			} else {
				cb1();
			}
		},
	], function(){
		rl.close();
		cb(infos);
	});
}
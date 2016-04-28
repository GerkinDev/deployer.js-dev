/**
 * @file Set version at changes
 * @description Set version at changes
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.2
 */

const checksum = require('checksum');

/**
 * @todo description {@link deployer}
 * @module actions/files-version
 * @requires fs
 * @requires readline
 * @requires checksum
 */
module.exports = {
	/**
	 * @method process
	 * @static
	 * @memberof module:actions/files-version
	 * @param   {object} config Options to explain to the module how to behave
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Browse each file in `files`, check if they changed, then rewrite them by changing their version header 
	 */
	process: function(config, cb){
		console.log("In files-version",config);
        var filesArray = filesFromSelectors(config.selection);

		var checksums = {};

		return async.each(filesArray, function(file, cb1){
			var filepath = path.resolve(".", file);
			makeChecksums(filepath, function(err, returns){
				checksums[file] = returns
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
					return cb("FILES-VERSION => Could not read config file");

				var filesChecked = [];
				return async.forEachOfSeries(checksums, function(checksum, file, cb1){
					var localConfigChecksum = (localConfig.project.checksums ? localConfig.project.checksums[file] : false);
					if(!localConfigChecksum){
						deployer.log.silly("FILES-VERSION => File " + file + " is new");
						return fileChanged(file, config.version,config, function(err, newChecksums){
							if(err){
								deployer.log.error(err)
								return cb1(err);
							}
							checksums[file] = newChecksums;
							return cb1(err);
						});
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
							deployer.log.silly("FILES-VERSION => File " + file + " changed");
							return fileChanged(file, config.targetVersion,config, function(err, newChecksums){
								if(err){
									deployer.log.error(err)
									checksums[file] = {};
									return cb1(err);
								}
								checksums[file] = newChecksums;
								return cb1(err);
							});
						} else {
							deployer.log.silly("FILES-VERSION => File " + file + " has the same checksums");
							checksums[file] = localConfigChecksum;
							return cb1();
						}
					}
				}, function(err){
					// Rewrite checksums
					localConfig.project.checksums = checksums;
					return writeLocalConfigFile(localConfig, function(){cb()});
				});
			});
		});
	},
	arguments: "version"
}

function fileChanged(file, version,config, cb){
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
			deployer.log.warn("FILES-VERSION => File " + file + " has no file header");
		} else {
			deployer.log.info("FILES-VERSION => File " + file + " has changed");
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
		checkHeaderDatas(infos, file,config, function(infosMod){
			infosMod["version"]["version"] = version;
			if(Object.keys(infosMod["other"]).length == 0)
				delete infosMod["other"];
			var docblock = "/**";
			for(var type in infosMod){
				docblock += "\n";
				for(var data in infosMod[type]){
					if(infosMod[type][data]){
						docblock += " * @" + data + " " + infosMod[type][data] + "\n";
					}
				}
				docblock += " *";
			}
			docblock += "/";
			if(header){
				content = content.replace(header, docblock);
			} else {
				var isPhp = file.match(/\.php$/);
				content = content.replace(new RegExp("(" + (isPhp ? "<\\?php" : "^") + ")"), "$1" + (isPhp ? "\n\n" : "") + docblock + "\n\n");
			}
			return fs.writeFile(filepath, content, function(err){
				if(err){
					deployer.log.warn("FILES-VERSION => Error while rewriting " + file + "");
					return cb(err)
				}
				makeChecksums(filepath, cb);
			});
		});
	});
}

function makeChecksums(file, cb){
	async.parallel({
		sha1: function(cb2){
			checksum.file(file, {algorithm:"sha1"}, cb2);
		},
		md5: function(cb2){
			checksum.file(file, {algorithm:"md5"}, cb2);
		}
	}, cb);
}

function checkHeaderDatas(infos, file, config, cb){
	var headWasLogged = false;
	async.series([
		function(cb1){
			if(!infos["fd"]["file"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				return requestPrompt("Please provide a file description: ", function(value){
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
				infos["legal"]["copyright"] = y + " " + config.companyName
			}
			cb1();
		},
		function(cb1){
			if(!infos["legal"]["license"]){
				if(!headWasLogged){
					console.log("==> For file " + file);
					headWasLogged = true;
				}
				async.series({
					url:function(cb2){
						return requestPrompt("Please give the URL to the license: ", function(url){
							cb2(null, url);
						});
					},
					name:function(cb2){
						return requestPrompt("Please give the name of the license: ", function(name){
							cb2(null,name);
						});
					}
				}, function(err, data){					
					infos["legal"]["license"] = data.url + " " + data.name;
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
				return requestPrompt("Please provide a package name: ", function(name){
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
				requestPrompt("Please provide the author name: ", function(name){
					infos["legal"]["author"] = name;
					cb1();
				});
			} else {
				cb1();
			}
		},
	], function(){
		cb(infos);
	});
}
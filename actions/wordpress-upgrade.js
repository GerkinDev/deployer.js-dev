/**
 * @file actions/wordpress-upgrade upgrades WordPress infos
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1
 */

const randomstring = require("randomstring");

/**
 * @todo description {@link deployer}
 * @module actions/wordpress-upgrade
 * @requires fs
 * @requires randomstring
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
		var versions = {};
		var fileContents = {};
		async.parallel([
			function(cb1){
				var file = "readme.txt";
				var fp = path.resolve(".", file);
				fs.access(fp, fs.W_OK | fs.R_OK, function(err){
					if(err)
						return cb1(err);
					fs.readFile(fp, 'UTF-8', function(err, out){
						if(err)
							return cb1(err);
						var regex = /^(Stable tag:\s*)(\d+[\.\d+]*)$/mi;
						var matched = regex.exec(out);
						if(matched){
							var matched = matched[0];
							versions[file] = matched.replace(regex, "$2");
							fileContents[file] = out.replace(regex, "$1" + deployer.config.version);
							return cb1();
						} else {
							return cb1("WORDPRESS-UPGRADE => \"Stable tag\" not found in \"readme.txt\"");
						}
					});
				});
			},
			function(cb1){
				var file = new RegExp(deployer.config.project.project_name.replace(/[\W]/g, ".?") + "\\.php", "i");
				for(var i = 0, j = files.length; i < j && file.constructor.name != "String"; i++){
					if(files[i].match && files[i].match(file))
						file = files[i];
				}
				if(file.constructor.name != "String"){
					return cb1("WORDPRESS-UPGRADE => Could not find which file is the main file.");
				}
				var fp = path.resolve(".", file);
				fs.access(fp, fs.W_OK | fs.R_OK, function(err){
					if(err)
						return cb1(err);
					fs.readFile(fp, 'UTF-8', function(err, out){
						if(err)
							return cb1(err);
						var regex = /^(Version:\s*)(\d+[\.\d+]*)$/mi;
						var matched = regex.exec(out);
						if(matched){
							var matched = matched[0];
							versions[file] = matched.replace(regex, "$2");
							fileContents[file] = out.replace(regex, "$1" + deployer.config.version);
							return cb1();
						} else {
							return cb1("WORDPRESS-UPGRADE => \"Version\" not found in \"" + file + "\"");
						}
					});
				});
			}
		], function(err){
			if(err){
				deployer.log.error(err);
				return cb(err);
			}
			async.series({
				changelog: function(cb1){
					var swapName = "changelog_" + randomstring.generate(15);
					var swapPath = path.resolve("/tmp", swapName);
					var args = config.command.args.slice(0);
					for(var i = 0, j = args.length; i < j; i++){
						args[i] = args[i].replace(/%FILE%/g, swapPath);
					}
					textEditor(swapPath, "\n\n# Please enter changelog for version "+deployer.config.version+"\n# Lines beginning with # will be ignored.\n# Empty message will abort publication\n# " + config.command.closeMessage, {bin: config.command.bin, args: args}, function(err, content){
						if(err)
							deployer.log.error("WORDPRESS-UPGRADE => Error while executing text editor for changelog...", err);
						content = content.replace(/^[\t\f ]*#.*$/gm, "").replace(/[\r\n]+([\r\n])/g, "$1");
						content = content.replace(/^[\r\n\f]+|[\r\n\f]+$/,"").trim();
						if(content == ""){
							deployer.log.error("WORDPRESS-UPGRADE => Empty changelog, abort");
							return cb1("EXIT","");
						}
						cb1(err,content);
					});
				},
				upgrade_notice: function(cb1){
					var swapName = "upgrade_notice_" + randomstring.generate(15);
					var swapPath = path.resolve("/tmp", swapName);
					var args = config.command.args.slice(0);
					for(var i = 0, j = args.length; i < j; i++){
						args[i] = args[i].replace(/%FILE%/g, swapPath);
					}
					textEditor(swapPath, "\n\n# Please enter Upgrade Notice for version "+deployer.config.version+"\n# Lines beginning with # will be ignored.\n# " + config.command.closeMessage, {bin: config.command.bin, args: args}, function(err, content){
						if(err)
							deployer.log.error("WORDPRESS-UPGRADE => Error while executing text editor for changelog...", err);
						content = content.replace(/^[\t\f ]*#.*$/gm, "").replace(/[\r\n]+([\r\n])/g, "$1");
						content = content.replace(/^[\r\n\f]+|[\r\n\f]+$/,"").trim();
						cb1(err,content);
					});
				}
			}, function(err, out){
				if(err){
					deployer.log.error("WORDPRESS-UPGRADE => Error while getting new readme infos:", err);
					return cb(err);
				}
				var files = Object.keys(versions);
				if(versions[files[0]] == versions[files[1]]){
					async.each(files, function(file, cb2){
						var fp = path.resolve(".", file);
						var content = fileContents[file];
						if(file.match(/readme\.txt$/)){
							var version_header = "= " + deployer.config.version + " =\n";
							var version_headers = [];
							var index = -1;
							while((index = content.indexOf(version_header, index + 1)) >= 0){
								version_headers.push(index);
							}

							var indexOf = {
								changelog: content.indexOf("== Changelog =="),
								upgrade_notice: content.indexOf("== Upgrade Notice ==")
							};

							var idx;
							if((indexOf.changelog < indexOf.upgrade_notice && (idx = version_headers.filter(function(elem){
								return elem > indexOf.changelog && elem < indexOf.upgrade_notice;
							})).length > 0) || (indexOf.changelog > indexOf.upgrade_notice && (idx = version_headers.filter(function(elem){
								return elem > indexOf.changelog;
							})).length > 0)){
								var i = idx[0] + version_header.length;
								deployer.log.silly("WORDPRESS-UPGRADE => Found Changelog version header");
								content = [content.slice(0, i), out.changelog + "\n", content.slice(i)].join('');
							} else {
								// If no Changelog header
								deployer.log.silly("WORDPRESS-UPGRADE => Did not found Changelog version header");
								content = content.replace(/(== Changelog ==)/, "$1\n\n= " + deployer.config.version + " =\n" + out.changelog);
							}

							if((indexOf.changelog > indexOf.upgrade_notice && (idx = version_headers.filter(function(elem){
								return elem < indexOf.changelog && elem > indexOf.upgrade_notice;
							})).length > 0) || (indexOf.changelog < indexOf.upgrade_notice && (idx = version_headers.filter(function(elem){
								return elem > indexOf.upgrade_notice;
							})).length > 0)){
								var i = idx[0] + version_header.length;
								deployer.log.silly("WORDPRESS-UPGRADE => Found Upgrade Notice version header");
								content = [content.slice(0, i), out.upgrade_notice + "\n", content.slice(i)].join('');
							} else {
								// If no Upgrade Notice header
								deployer.log.silly("WORDPRESS-UPGRADE => Did not found Upgrade Notice version header");
								content = content.replace(/(== Upgrade Notice ==)/, "$1\n\n= " + deployer.config.version + " =\n" + out.upgrade_notice);
							}
						}
						fs.writeFile(fp, content, function(err){
							cb2(err);
						});
					}, function(err){
						if(err){
							deployer.log.error(err);
							return cb(err);
						}
						return cb();
					});
				} else {
					deployer.log.error("WORDPRESS-UPGRADE => Incoherent versions! Stop here");
					return cb("WORDPRESS-UPGRADE => Incoherent versions! Stop here");
				}
			});
		});
	}
}

function textEditor(filepath, initialFileContent, commandObject, cb){
	fs.writeFile(filepath, initialFileContent, function(err){
		if(err)
			deployer.log.error(err);
		deployer.log.silly("WORDPRESS-UPGRADE => Creating text-editor instance with config",commandObject);
		var texteditor = child_process.spawn(commandObject.bin, commandObject.args, {stdio: 'inherit'});
		texteditor.on('exit', function(err, ret){
			if(err){
				deployer.log.error("WORDPRESS-UPGRADE => Error while executing text editor...", err);
			}
			fs.readFile(filepath, "UTF-8", function(err, content){
				if(err){
					deployer.log.error("WORDPRESS-UPGRADE => Error while reading temp file " + filepath);
					return cb(err, "");
				}
				fs.unlink(filepath, function(err){
					if(err){
						deployer.log.warn("WORDPRESS-UPGRADE => Could not remove temp file " + filepath);
					}
					return cb(0,content.trim());
				});
			});
		});
	});
}
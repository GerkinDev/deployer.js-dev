/**
 * @file Generates the documentation of javascript
 * @description Generates the documentation of javascript
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.11
 */

const xmlbuilder = require('xmlbuilder');
const randomstring = require("randomstring");
const replace = require("replace");

/**
 * handles generation of php documentation from {@link deployer}
 * @module actions/minify
 * @requires xmlbuilder
 * @requires randomstring
 * @requires fs
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
		var l = filesArray.length;
		if(l == 0){
			deployer.log.info("PHPDOC => No files to document with phpdoc");
			return cb();
		}
		for(var i = 0; i < l; i++){
			filesArray[i] = path.resolve(".", filesArray[i]);
		}
		var root = xmlbuilder.create('phpdoc',{version: '1.0', encoding: 'UTF-8'});
		root.ele("title", deployer.config.project.project_name);
		root.ele("author", deployer.config.project.author);
		{
			var parser = root.ele("parser");
			parser.ele("target", "data/output");
			parser.ele("encoding", "utf8");

			var parserExtension = parser.ele("extensions")
			parserExtension.ele({
				extension: [
					"php",
					"php3",
					"phtml"
				]
			});

			var parserMarkers = parser.ele("markers")
			parserMarkers.ele({
				item: [
					"TODO",
					"FIXME"
				]
			});

			root.ele({
				logging: {
					level: "quiet",
					paths: {
						default: path.resolve(".", "logs/phpdoc/{DATE}.log"),
						errors: path.resolve(".", "logs/phpdoc/{DATE}.error.log"),
					}
				}
			});

			root.ele({
				transformer: {
					target: "data/output"
				}
			});

			root.ele({
				files: {
					file: filesArray
				}
			});

			var transformations = root.ele("transformations");
			for(var template in config.templates){
				var templateObj = {
					template: {
						"@name": template
					}
				};
				if(config.templates[template].length){
					templateObj["template"]["parameters"] = {
						variables: config.templates[template]
					};
				}
				transformations.ele(templateObj);	
			}

			var targetName = "phpdoc-" + randomstring.generate(15) + "-config.xml";
			var targetPath = path.resolve("/tmp", targetName);
			fs.writeFile(targetPath, root.end({ pretty: true}), function(cb2){
				var args = [];
				if(config.private){
					args.push("--parseprivate");
				}
				args.push("-t");
				args.push(composeUrl({base: "path",type:config.typepath},0,3));
				args.push("-c");
				args.push(targetPath);
				deployer.log.info("PHPDOC => Command: \"" + args + "\"");
				var process = child_process.spawn("phpdoc", args);
				process.stdout.on("data", function(data){
					deployer.log.verbose("PHPDoc =>", data.toString("UTF-8").slice(0,-1));
				})
				process.stderr.on("data", function(data){
					deployer.log.error("PHPDoc =>", data.toString("UTF-8").slice(0,-1));
				})
				process.on("exit", function(exitCode){
					deployer.log.info("PHPDOC => Process PHPDOC exited with code " + exitCode);
					if(config.replace_output && config.replace_output.constructor.name == "Object" && Object.keys(config.replace_output).length > 0){
						getFilesRec(composeUrl({base: "path",type:config.typepath},0,3), function(err, docfiles){
							docfiles = reformatFiles(docfiles);
							docfiles = checkFiles(docfiles, /\.html$/, true);
							docfiles = filesStructToArray(docfiles);
							var docfilesLength = docfiles.length;
							if(deployer.config.project.company){
								if(deployer.config.project.company.start){
									var str = (new Date()).getFullYear();
									if(str != deployer.config.project.company.start){
										str = deployer.config.project.company.start + " - " + str;
									}
									config.replace_output["%COMPANY-YEAR%"] = str;
								}
								
								if(deployer.config.project.company.name){
									config.replace_output["%COMPANY-NAME%"] = deployer.config.project.company.name;
								}
							}
							async.each(docfiles, function(file, cb1){
								var absfile = path.resolve(composeUrl({base: "path",type:config.typepath},0,3), file);
								fs.readFile(absfile, 'UTF-8', function(err, content){
									if(err)
										deployer.log.error("PHPDOC => Error while read", absfile, err);
									for(var key in config.replace_output){
										var regexstr = "\\[" + key + "\\]";
										var regex = new RegExp(regexstr,"g");
										content = content.replace(regex,config.replace_output[key]);
									}
									fs.writeFile(absfile, content, cb1);
								});
							}, function(err){
								if(err)
									deployer.log.error(err);
								cb(err);
							});
						});
					} else {
						fs.unlink(targetPath, function(err){
							if(err)
								deployer.warn("PHPDOC => Could not unlink config file " + targetPath);
							cb();
						});
					}
				})
			});
		}
	}
}
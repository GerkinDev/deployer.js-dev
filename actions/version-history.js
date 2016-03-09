/**
 * @file Generates the documentation index
 * @description Generates the documentation index
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.11
 */

const swig = require("swig");
const ncp = require("ncp");

/**
 * @todo description {@link deployer}
 * @module actions/version-history
 * @requires fs
 * @requires swig
 * @requires ncp
 */
module.exports = {
	/**
     * Generates a templated PHP file for the version history
	 * @method
     * @param   {object} config Options to explain to the module how to behave
     * @param   {array} files Files returned by {@link utils.getFilesRec}
     * @param   {callback} Function to call at the end of action
     * @returns {undefined}
     */
	process: function(config, files, cb){
		var templatePath = path.resolve(deployer.config.base_path,"templates/" + config.template + "/versionner.swig.php");
		var templateArgs = {
			title: deployer.config.project.project_name,
			author: deployer.config.project.author,
			now: new Date(),
			head_links: config.head_links,
			base_url: {
				resources: config.resources != null ? config.resources : config.base_url + "/resources"
			},
			versions: deployer.config.version_history,
			current: {
				version: deployer.config.minor_version,
				url: composeUrl({base:"url"},0,2)
			},
			resources: deployer.config.project.documentation.resources.url
		}
		var content = swig.renderFile(templatePath, templateArgs);
		var output = composeUrl({base: "path"}, 0, 1) + "/index.php";
		async.waterfall([
			function(cb1){
				fs.writeFile(path.resolve(output), content, function(err){
					cb1(err);
				});
			},
			function(cb1){
				fs.chmod(path.resolve(output), '0777', function(err){
					cb1(err);
				});
			},
			function(cb){ // search local config file
				var file = path.resolve(".", deployer.config.configFile);
				fs.access(file, fs.W_OK, function(err){
					if(err){
						deployer.log.warn("No local config file found at " + file);
						return cb(err, file);
					} else {
						deployer.log.verbose("Found LOCAL config file " + file);
						return cb(null, file);
					}
				});
			},
			function(file, cb){ // Read local config file
				readLocalConfigFile(function(err, configFile){
					if(err)
						return cb(err);
					var newObj = {};
					newObj[templateArgs.current.version] = templateArgs.current.url;
					var config = merge.recursive(configFile,{project:{versions:newObj}});
					writeLocalConfigFile(config, cb);
				});
			},
		], function(err){
			if(err)
				deployer.log.error("Error while creating version-history", err);
			cb();
		});
	}
}
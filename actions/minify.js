/**
 * @file Handles minifying actions from deployer
 * @description Handles minifying actions from deployer
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.11
 */

const minifier = require("minifier");
minifier.on('error', function(err) {
	deployer.log.error(err);
});

/**
 * handles minifying actions from {@link deployer}
 * @module actions/minify
 * @requires minifier
 */
module.exports = {
	/**
     * Process the minify operation with the config provided
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
		var nameReplacement = new RegExp(config.output.from);
		filesArray.forEach(function(file){
			var outputName = file.replace(nameReplacement, config.output.to);
			deployer.log.silly("MINIFY => Minifying " + colour.italic(file) + " to " + colour.italic(outputName));
			minifier.minify(file, {
				output: outputName,
				uglify:{
					warnings: true,
					unsafe: true,
					hoist_vars: true
				}
			});
		});
		deployer.log.info("MINIFY => Minification completed");
		return cb();
	}
};
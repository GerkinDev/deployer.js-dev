/**
 * @file Handles minifying actions from deployer
 * @description Handles minifying actions from deployer
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.3
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
     * @param   {callback} Function to call at the end of action
     * @returns {undefined}
     */
    process: function(config, cb){
        var filesArray = filesFromSelectors(config.selection);
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
    },

    /**
     * @description Minifies a single file. Triggered by listen
     * @param {object} config [[Description]]
     * @param {string}   file   File path
     */
    processSingle: function(config, file,cb){
        outputName = file.replace(new RegExp(config.from), config.to); 
        deployer.log.info(file + " changed. Minifying to " + outputName);
        minifier.minify(file, {
            output: outputName,
            uglify:{
                warnings: true,
                unsafe: true,
                hoist_vars: true
            }
        });
        cb(config, file);
    }
};
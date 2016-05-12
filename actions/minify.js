/**
 * @file Handles minifying actions from deployer
 * @description Handles minifying actions from deployer
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 2.5.0
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
            module.exports.minify(file, outputName);
        });
        deployer.log.info("MINIFY => Minification completed");
        return cb();
    },

    /**
     * @description Minifies a single file. Triggered by listen
     * @param {object}   config Configuration of this object
     * @param {string}   file   File path
     * @param {Function} cb     Callback to call after the end of the action
     * @param {Function} endcb  Callback to call after the end of the chain of singleProcess actions
     */
    processSingle: function(config, file,cb, endcb){
        outputName = file.replace(new RegExp(config.from), config.to); 
        deployer.log.info(file + " changed. Minifying to " + outputName);
        module.exports.minify(file, outputName);
        cb(config, file, endcb);
    },
    minify: function(input, output, uglify){
        if(is_na(uglify) || uglify === true){
            try{
                try{
                    minifier.minify(input, {
                        output: output,
                        uglify:{
                            warnings: true,
                            unsafe: true,
                            hoist_vars: true
                        }
                    });
                } catch(e){
                    deployer.log.error("Invalid JS file. Maybe it is not ES5 compatible.");
                    minifier.minify(input, {
                        output: output,
                        uglify:false
                    });
                }
            } catch(e){
                deployer.log.error("Invalid JS file. EcmaScript > ES5 not yet supported");
            }
        } else {
            try{
                minifier.minify(input, {
                    output: output,
                    uglify:false
                });
            } catch(e){
                deployer.log.error("Invalid JS file. EcmaScript > ES5 not yet supported");
            }
        }
    }
};
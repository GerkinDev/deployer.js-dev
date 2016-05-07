/**
 * @file Compiles LESS stylesheets to CSS. Includes the plugin "browser"
 * @description undefined
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 2.5.0
 */

const LessPluginAutoPrefix = require('less-plugin-autoprefix'),
      less = require('less');

/**
 * {@link deployer}
 * @module actions/less-compile
 * @requires fs
 */
module.exports = {
    /**
     * Compiles the given less file to an unminified, prefixed (if plugin included) CSS file
     * @param {object}   config Config of the action
     * @param {string}   file   Path of the file to process relative to the project root directory
     * @param {Function} cb     Callback to call after the end of the action
     * @param {Function} endcb  Callback to call after the end of the chain of singleProcess actions
     */
    processSingle: function(config, file, cb, endcb){
        var plugins = [];
        if(config.browsers)
            plugins.push(new LessPluginAutoPrefix({browsers: config.browsers}));
        fs.readFile(file, "UTF-8", function(err, filecontent){
            less.render(filecontent,{
                plugins:plugins,
                filename:file
            },function (e, output) {
                outputName = file.replace(new RegExp(config.from), config.to); 
                deployer.log.info(file + " changed. Recompiling to CSS to " + outputName);
                if(outputName === file){
                    deployer.log.error("Target file is the same as source file. Operation aborted");
                    deployer.log.verbose("Regexes used:", new RegExp(config.from), config.to);
                    return cb(config,file,endcb);
                } else {
                    fs.writeFile(outputName, output.css, function(){
                        return cb(config, file, endcb);
                    });
                }
            });
        });
    }
}
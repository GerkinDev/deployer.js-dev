/**
 * @file Compiles LESS stylesheets to CSS. Includes the plugin "browser"
 * @description undefined
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 */

const LessPluginAutoPrefix = require('less-plugin-autoprefix'),
      less = require('less');

/**
 * {@link deployer}
 * @module actions/less-compile
 * @requires fs
 */
module.exports = {
    processSingle: function(config, file, cb){
        var plugins = [];
        if(config.browsers)
            plugins.push(new LessPluginAutoPrefix({browsers: config.browsers}));
        fs.readFile(file, "UTF-8", function(err, filecontent){
            console.log(err,filecontent);
            less.render(filecontent,{
                plugins:plugins,
                filename:file
            },function (e, output) {
                outputName = file.replace(new RegExp(config.from), config.to); 
                console.log(e, output, outputName);
                fs.writeFile(outputName, output.css, function(){
                    cb(config, file);
                });
            });
        });
        console.log("Compile " + file, config);
    }
}
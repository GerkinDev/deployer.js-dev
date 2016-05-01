/**
 * @file Copy specified files to another directory
 * @description Copy specified files to another directory
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.3
 */

const fs_extra = require("fs-extra");

/**
 * @todo description {@link deployer}
 * @module actions/cp
 * @requires fs
 * @requires fs-extra
 */
module.exports = {
	/**
	 * @method process
	 * @static
	 * @memberof module:actions/cp
	 * @param   {object} config Options to explain to the module how to behave
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Copy. 
	 */
	process: function(config, cb){
		return async.each(config, function(pair, cb1){
			deployer.log.silly('CP => Copy from "' + path.resolve(".", pair.from) + '" to "' + path.resolve(".", pair.to) + '"');
			return new fs_extra.copy(path.resolve(".", pair.from),path.resolve(".", pair.to), {
				filter: function(name){
					var hidden = /(^\.)|\/\./.test(name);
					//deployer.log.silly(name, hidden);
					return !hidden;
				}
			}, function(err){
				return cb1(err);
			});
		},function(err){
			if(err)
				deployer.log.error('CP => Error during copy:', err);
			else
				deployer.log.silly('CP => All copies ended');
			return cb(err);
		});
	}
}
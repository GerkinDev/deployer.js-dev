/**
 * @file Sync with SVN
 * @description Sync with SVN
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.0
 */

const SVN = require('node.svn');

/**
 * @todo description {@link deployer}
 * @module actions/svn
 * @requires svn
 */
module.exports = {
	/**
	 * @method process
	 * @static
	 * @memberof module:actions/svn
	 * @param   {object} config Options to explain to the module how to behave
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Sync. 
	 */
	process: function(config, cb){
		var repoPath = path.resolve(config.path ? config.path : ".");
		const svn = new SVN(repoPath);
		async.eachSeries(config.actions, function(action, cb1){
			const actionPath = action.data.path ? action.data.path : ".";
			switch(action.action){
				case "commit":{
					deployer.log.silly('SVN => Prepare commit with message "' + action.data.message + '"');
					return svn.commit(actionPath, action.data.message, cb1);
				} break;

				case "add":{
					deployer.log.silly('SVN => Prepare add "' + actionPath + '"');
					var args = [];
					if(action.data.force)
						args.push("--force");
					return svn.add(actionPath, args, cb1);
				} break;

				case "copy":
				case "cp":{
					deployer.log.silly('SVN => Prepare cp from "' + action.data.from + '" to "' + action.data.to + '"');
					return svn.cp(action.data.from, action.data.to, cb1);
				} break;

				default: {
					var err = "SVN does not support action \"" + action.action + "\"";
					deployer.log.error("SVN => ",err);
					return cb1(err);
				} break;
			}
			deployer.log.warn("SVN => Was not catched by switch");
		}, function(err, out){
			if(err)
				deployer.log.error("SVN => Error: ",err);
			deployer.log.verbose("SVN => Command returned", out);
			cb(err);
		});
	}
}
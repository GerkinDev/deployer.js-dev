/**
 * @file Execute following command
 * @description Execute following command
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.0
 */

const exec = require('child_process').exec;

/**
 * @todo description {@link deployer}
 * @module actions/exec
 * @requires child_process
 */
module.exports = {
	/**
	 * @method process
	 * @static
	 * @memberof module:actions/exec
	 * @param   {object} config Options to explain to the module how to behave
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Exec bash commands
	 */
	process: function(config, cb){
		console.log(config);
		if(!config.command){
			return cb("No command given for action exec!");
		}
		const process = exec(config.command);
		process.stdout.on('data', function(data){
			deployer.log.verbose(data);
		});

		process.stderr.on('data', function(data){
			deployer.log.error(data);
		});


		process.on('exit', function(code){
			deployer.log.info('Command "' + config.command + '" ended with code ' + code);
			return cb();
		});
	}
}
/**
 * @file Sync with git
 * @description Sync with git
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.1.24
 */

const git = require("nodegit");

/**
 * @todo description  with {@link deployer}
 * @module actions/git
 * @requires nodegit
 */
module.exports = {
	/**
	 * @method process
	 * @static
	 * @memberof module:actions/git
	 * @param   {object} config Options to explain to the module how to behave
	 * @param   {array} files Unused.
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Execute git actions with the provided config. Files are ignored.
	 * @tutorial actions/git
     */
	process: function(config, files, cb){
		var repoPath = path.resolve(config.path ? config.path : ".");
		git.Repository.open(repoPath).done(function(repository){
			var signature = git.Signature.default(repository);//.create(ret.name,ret.email,(new Date()).getTime(), 0);
			async.eachSeries(config.actions, function(action, cb1){
				switch(action.action){
					case "commit":{
						deployer.log.silly('GIT => Prepare commit with message "' + action.data.message + '"');
						var index;
						var reference;
						return repository.index().then(function(idx){
							index = idx;
							return index.read(1);
						}).then(function(){
							return index.addAll();
						}).then(function(){
							return index.write();
						}).then(function(){
							return index.writeTree();
						}).then(function(ref){
							reference = ref;
							return git.Reference.nameToId(repository, "HEAD");
						}).then(function(head){
							return repository.getCommit(head);
						}).then(function(parent){
							return repository.createCommit("HEAD", signature, signature, action.data.message, reference, [parent]);
						}).done(function(commitId){
							deployer.log.info("GIT => Created commit " + commitId);
							return cb1();
						},function(err){
							deployer.log.error('GIT => Error in "Done" while creating commit with message "' + action.data.message + '"', err);
							return cb1();
						});
					} break;

					case "tag":{
						deployer.log.silly('GIT => Prepare tag "' + action.data.label + '" with message "' + action.data.message + '"');
						return git.Reference.nameToId(repository, "HEAD").then(function(head){
							return repository.createTag(head, action.data.label, action.data.message);
						}).done(function(tag){
							deployer.log.info("GIT => Created tag " + tag.name());
							return cb1();
						},function(error){
							deployer.log.error('GIT => Error while tagging "' + action.data.label + '"', error);
							return cb1();
						});
					} break;

					case "push":{
						deployer.log.silly('GIT => Prepare pushing');
						return repository.getRemote("origin", function(){
						}).then(function(remote){
							return remote.push([
								"refs/heads/master:refs/heads/master"
							],{
								callbacks: {
									credentials: function(url, userName) {
										var creds = git.Cred.sshKeyFromAgent(userName);
										return creds;
									}
								}
							});
						}).done(function(){
							deployer.log.info("GIT => Pushed to repository");
							return cb1();
						},function(error){
							deployer.log.error('GIT => Error while pushing', error);
							return cb1();
						});
					} break;

					default: {
						var err = "Git does not support action \"" + action.action + "\"";
						deployer.log.error("GIT => ",err);
						return cb1(err);
					} break;
				}
				deployer.log.warn("Was not catched by switch");
			}, function(err){
				if(err)
					deployer.log.error("==> Git:",err);
				cb(err)
			});
		});
	}
}
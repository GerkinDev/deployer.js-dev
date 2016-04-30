/**
 * @file Sync with git
 * @description Sync with git
 *
 * @author Gerkin
 * @copyright 2016 GerkinDevelopment
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPL v3
 * @package deployer.js
 *
 * @version 0.2.3
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
	 * @param   {callback} cb Function to call at the end of action
	 * @returns {undefined}
	 * @description Execute git actions with the provided config.
	 * @tutorial git-process
     */
    process: function(config, cb){
        console.log("In git",config);
        var repoPath = path.resolve(config.path ? config.path : ".");
        git.Repository.open(repoPath).done(function(repository){
            var signature = git.Signature.default(repository);//.create(ret.name,ret.email,(new Date()).getTime(), 0);
            async.eachSeries(config.actions, function(action, cb1){
                return getArgsRuntime(action, function(err, args){
                    var keysData = (action.data && action.data.constructor == Object ? Object.keys(action.data) : []);
                    var missingArgs = args.filter( function( el ) {
                        return keysData.indexOf( el ) < 0;
                    } );
                    deployer.log.info("Missing args", missingArgs);
                    async.each(missingArgs, function(arg,cb2){
                        requestPrompt("Please provide a value for \""+arg+"\" in git: ", function(val){
                            action.data[arg] = val;
                            cb2();
                        });
                    }, function(){
                        console.log(action.data)
                        switch(action.action){
                            case "commit":{
                                deployer.log.silly('GIT => Prepare commit');
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
                                deployer.log.silly('GIT => Prepare tag');
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
                                var remote;
                                return repository.getRemote("origin", function(){
                                }).then(function(rem){
                                    remote = rem;
                                    var branch = (action.data && action.data.branch) ? action.data.branch : "master";
                                    if(typeof remote != "undefined" && remote != null && remote) {
                                        return remote.push([
                                            "refs/heads/"+branch+":refs/heads/"+branch
                                        ],{
                                            callbacks: {
                                                credentials: function(url, userName) {
                                                    var creds;
                                                    if(userName != ""){
                                                        deployer.log.silly('Using username "'+userName+'"');
                                                        creds = git.Cred.sshKeyFromAgent(userName);
                                                        return creds;
                                                    } else {
                                                        deployer.log.silly('No username detected. Maybe you are trying to push to a non-ssh remote (' + url + '). Currently, only SSH remotes are handled.');
                                                        return {};
                                                    }
                                                }
                                            }
                                        });
                                    } else {
                                        throw 'Remote "origin" not found';
                                    }
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
                        if(err){
                            deployer.log.error(err);
                        }
                        cb1(err);
                    });
                });
            }, function(err){
                if(err)
                    deployer.log.error("GIT => ",err);
                cb(err)
            });
        });
    },
    arguments: []
}

function getArgsRuntime(action, cb){
    var args = [];
    switch(action.action){
        case "commit":{
            args = ["message"];
        } break;
    }
    cb(null,args);
}
/**
 * @file actions/ithoughts-index-doc generates the documentation index
 * @author Gerkin
 *         
 * @version 0.1
*/

const swig = require("swig");
const ncp = require("ncp");

/**
 * @todo description {@link deployer}
 * @module actions/ithoughts-index-doc
 * @requires fs
 * @requires swig
 */
module.exports = {
	/**
     * Process the generation operation with the config provided
	 * @method
     * @param   {object} config Options to explain to the module how to behave
     * @param   {array} files Files returned by {@link utils.getFilesRec}
     * @param   {callback} Function to call at the end of action
     * @returns {undefined}
     */
	process: function(config, files, cb){
		var templatePath = path.resolve(deployer.config.base_path,"templates/" + config.template + "/" + config.template + ".swig.html");
		var templateArgs = {
			title: deployer.config.project.project_name,
			author: deployer.config.project.author,
			now: new Date(),
			head_links: config.head_links,
			index_link: deployer.config.project.documentation_index,
			start_year: deployer.config.project.company_start,
			doc_links: config.doc_links,
			base_url: composeUrl({base:"url"}, 0,1),
			base_type: composeUrl({base:"url"}, 0,2),
			version: deployer.config.minor_version,
			resources: deployer.config.project.documentation.resources.url
		}
		deployer.log.silly("ITHOUGHTS-INDEX-DOC => config:",JSON.stringify(templateArgs, null, 4));
		var output = composeUrl({base: "path"}, 0, 2)
		var content = swig.renderFile(templatePath, templateArgs);
		mkdir(output);
		mkdir(deployer.config.project.documentation.resources.path);
		ncp.ncp(path.resolve(deployer.config.base_path,"templates/" + config.template + "/resources"), deployer.config.project.documentation.resources.path, function(err){
			deployer.log.silly("ITHOUGHTS-INDEX-DOC => Resource files copied");
			if(err)
				deployer.log.error(err);
			fs.writeFile(path.resolve(output, "index.html"), content, function(err){
				if(err)
					deployer.log.error("ITHOUGHTS-INDEX-DOC => Error while writing index of doc:",err);
				else
					deployer.log.silly("ITHOUGHTS-INDEX-DOC => Index of doc written");
				cb();
			});
		});
		//console.log(content);
	}
}
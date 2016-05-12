'use strict';

/**
 * @class Arguments
 * @description Handle arguments transmitted from a {@link Command},{@link ActionGroup} or {@link Action}, to a {@link ActionGroup} or {@link Action}
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 * @param {Arguments} [sourceObj] Other {@link Arguments} instance to set as {@link Arguments.ancestor}
 */
function Arguments(config, sourceObj){
    /**
     * @member {object} arguments
     * @memberof Arguments
     * @public
     * @instance
     */
    this.arguments = Arguments.parseRec(config,this);
    /**
     * @member {Arguments} ancestor
     * @memberof Arguments
     * @public
     * @instance
     */
    if(typeof sourceObj != "undefined")
        this.ancestor = sourceObj;
    else
        this.ancestor = null;
}

/**
 * @function _brewArguments
 * @memberof Arguments
 * @description Recurse over given object to trigger {@link ComputedArgument} and execute {@link Arguments#replacePlaceHolder}. Must be called in an {@link Arguments Arguments instance} context (usually via {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Function/call Function.prototype.call} or {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Function/apply Function.prototype.apply})
 * @param {object} obj      Arguments to convert
 * @param {Function} callback Function to trigger afterwards
 * @static
 * @private
 * @author Gerkin
 */
Arguments._brewArguments = function(obj, callback){
    async.forEachOfSeries(obj, (value, key, next)=>{
        console.log(value, key);
        if(value.constructor.name === "ComputedArgument"){
            return value.brew((val)=>{
                if(typeof val == "undefined" || val === null)
                    return next();
                obj[key] = this.replacePlaceHolder(val);
                next()
            });
        } else if(value.constructor.name === "Object"){
            return Arguments._brewArguments.call(this, value, next);
        } else if(value.constructor.name === "String"){
            obj[key] = this.replacePlaceHolder(value);
            next();
        } else {
            deployer.log.warn(`Can't find type of ${value}: ${ typeof value}, ${ value.constructor.name}` );
            next();
        }
    }, function(){
        callback();
    });
}
/**
 * @function parseRec
 * @memberof Arguments
 * @description Generates plain string or {@link ComputedArgument} with given args object
 * @param   {object} args Arguments description
 * @returns {object} Parsed with {@link ComputedArgument ComputedArguments instances}
 * @static
 * @public
 * @author Gerkin
 */
Arguments.parseRec = function(args,parent){
    var newObj = {};
    for(var key in args){
        var arg = args[key];
        if(typeof arg == "undefined" && arg == null){
            continue;
        } else {
            if(arg.constructor.name == "Object"){
                if(arg.hasOwnProperty("_type")){ // If computed
                    newObj[key] = new ComputedArgument(arg, key, parent);
                } else { // Must be a nested var
                    newObj[key] = Arguments.parseRec(arg,parent);
                }
            } else {
                newObj[key] = arg;
            }
        }
    }
    return newObj;
}
/**
 * @method brewArguments
 * @memberof Arguments
 * @description Do all operations to convert variable arguments to plain object. Initialize call of recursive function {@link Arguments._brewArguments}
 * @param {Function} callback Function to call afterwards
 * @returns {undefined} Async
 * @instance
 * @public
 * @author Gerkin
 */
Arguments.prototype.brewArguments = function(callback){
    Arguments._brewArguments.call(this, this.arguments, ()=>{
        if(this.ancestor)
            this.arguments = merge.recursive(this.arguments, this.ancestor.arguments);
        return callback(this.arguments)
    });
}
/**
 * @method prepareActionArgs
 * @memberof Arguments
 * @description Apply {@link Arguments#replacePlaceHolder} on every strings of given object. It should be typically applied on the {@link Action#config} object once it was {@link Arguments#brewArguments brew}, then pass the resulting object to the {@link Action#processFunction}: {@snippet prepareActionArgs}.
 * @param   {object}   actionVars Object to replace placeholders in
 * @returns {object} Replaced
 * @instance
 * @public
 * @author Gerkin
 */
Arguments.prototype.prepareActionArgs = function(actionVars){
    Object.keys(actionVars).map((key,index)=>{
        let val = actionVars[key];
        if(typeof val == "object"){
            actionVars[key] = this.prepareActionArgs(val);
        } else if(typeof val == "string"){
            actionVars[key] = this.replacePlaceHolder(val);
        } else {
            actionVars[key] = val;
        }
    });
    return actionVars;
}
/**
 * @method replacePlaceHolder
 * @memberof Arguments
 * @description Replace given string placeholders with instance vars.
 * @param   {string}   string String to replace placeholders
 * @returns {string} Replaced string
 * @instance
 * @public
 * @todo Demo
 * @author Gerkin
 */
Arguments.prototype.replacePlaceHolder = function(string){
    return string.replace(/\$\{\s*([\w\.]+)\s*\}/g, (matched, identifier)=>{
        let identifiers = identifier.split(".");
        let value = this.arguments;
        let valueAncestor = this.ancestor.arguments || "";
        for(let i = 0, j = identifiers.length; i < j; i++){
            // Search in both ancestor & current obj
            if(typeof value == "object"){
                value = value[identifiers[i]];
            } else {
                value = "";
            }
            if(typeof valueAncestor == "object"){
                valueAncestor = valueAncestor[identifiers[i]];
            } else {
                valueAncestor = "";
            }
            if(value == "" && valueAncestor == ""){
                break;
            }
        }
        return value || valueAncestor || "";
    });
}





/**
 * @class ComputedArgument
 * @description Special arguments requiring specific handling. It usually have describing data
 * @param {object}   config  Description of this ComputedArgument object
 * @param {string} argName Name of this argument
 * @author Gerkin
 */
function ComputedArgument(config, argName, parent){
    this.type = config._type;
    this.argName = argName;
    delete config["_type"];
    this.data = config;
    this.parent = parent;
}
/**
 * @method brew
 * @memberof ComputedArgument
 * @description Execute special handling.
 * @param   {Function} callback Function to call afterwards. The computed value is given to this function as only argument
 * @returns {undefined} Async
 * @instance
 * @public
 * @author Gerkin
 */
ComputedArgument.prototype.brew = function(callback){
    switch(this.type){
        case "prompt":{
            return requestPrompt(is_na(this.data.question) ? `Please provide a value for argument "${ this.argName }": ` : this.data.question, callback);
        } break;

        case "regex_replace": {
            return callback(this.parent.replacePlaceHolder(this.data.value).replace(new RegExp(this.data.search), this.data.replacement));
        } break;
    }
    return callback(null);
}

module.exports = Arguments;
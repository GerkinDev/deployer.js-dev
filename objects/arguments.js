'use strict';

/**
 * Handle arguùments transmitted from a {@link Command},{@link ActionGroup} or {@link Action}, to a {@link ActionGroup} or {@link Action}
 * @class Arguments
 * @param   {object} config Configuration of the action
 * @param   {string} config.actionName Name of the action, IE the name of the module inside the "actions" directory
 */
function Arguments(config, sourceObj){
    this.arguments = Arguments.parseRec(config,this);
    if(typeof sourceObj != "undefined")
        this.ancestor = sourceObj;
    else
        this.ancestor = null;
}
/**
 * Generates plain string or {@link ComputedArgument} with given args object
 * @author Gerkin
 * @param   {object} args Arguments description
 * @returns {object} Parsed with {@link ComputedArgument ComputedArguments instances}
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
 * Do all operations to convert variable arguments to plain object. Initialize call of recursive function {@link Arguments._brewArguments}
 * @author Gerkin
 * @param {Function} callback Function to call afterwards
 */
Arguments.prototype.brewArguments = function(callback){
    Arguments._brewArguments.call(this, this.arguments, ()=>{
        /*function copyRec(main, complement){
            for(var i in complement){
                if(is_na(main[i])){
                    main[i] = complement[i];
                } else {
                    if(typeof complement[i] == "object"){
                        main[i] = copyRec(main[i], complement[i]);
                    } else {
                        main[i] = complement[i];
                    }
                }
            }
            return main;
        }*/
        if(this.ancestor)
            this.arguments = merge.recursive(this.arguments, this.ancestor);
        return callback(this.arguments)
    });
}
/**
 * Recurse over given object to trigger {@link ComputedArgument} and execute {@link Argument.replacePlaceHolder}. Must be called in an {@link Arguments Arguments instance} context (usually via Function.prototype.call or Function.prototype.apply)
 * @private
 * @author Gerkin
 * @param {object} obj      Arguments to convert
 * @param {Function} callback Function to trigger afterwards
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
 * Replace given string placeholders with instance vars.
 * @todo Demo
 * @author Gerkin
 * @param   {string}   string String to replace placeholders
 * @returns {string} Replaced string
 */
Arguments.prototype.replacePlaceHolder = function(string){
    return string.replace(/\$\{\s*([\w\.]+)\s*\}/g, (matched, identifier)=>{
        let identifiers = identifier.split(".");
        let value = this.arguments;
        let valueAncestor = this.ancestor || "";
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
 * Special arguments requiring specific handling. It usually have describing data
 * @author Gerkin
 * @class ComputedArgument
 * @param {object}   config  Description of this ComputedArgument object
 * @param {string} argName Name of this argument
 */
function ComputedArgument(config, argName, parent){
    this.type = config._type;
    this.argName = argName;
    delete config["_type"];
    this.data = config;
    this.parent = parent;
}
/**
 * Execute special handling.
 * @author Gerkin
 * @param   {Function} callback Function to call afterwards. The computed value is given to this function as only argument
 * @returns {undefined} Async
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
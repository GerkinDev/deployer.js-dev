var Action = require("./action.js");
var Breadcrumb = require("./breadcrumb.js");

/**
 * Creates a new ActionGroup
 * @class ActionGroup
 * @param   {object}   config Configuration of the action group
 * @param   {ActionGroup.Mode} config.mode Type of async execution of the command group
 * @param   {ActionGroupChild[]} config.actions Sub action groups or child actions
 */

/**
 * @typedef ActionGroupChild
 * @type   {Action|ActionGroup}
 */

function ActionGroup(config){
    if(is_na(config))
        throw "Can't create ActionGroup with null or undefined config.";

    console.log("Creating ACTIONGROUP with", config);

    var mode,
        actions;

    Object.defineProperties(this, {
        /**
         * @member {ActionGroup.Mode} mode
         * @memberof ActionGroup
         * @public
         * @instance
         */
        mode: {
            get: function(){
                return type;
            },
            set: function(val){
                if(Object.keys(ActionGroup.Mode).indexOf(val) != -1){
                    type = ActionGroup.Mode[val];
                    return type;
                } else if(Object.values(ActionGroup.Mode).indexOf(val) != -1){
                    type = val;
                    return type;
                } else {
                    return undefined;
                }
            }
        },
        /**
         * @member {ActionGroupChild[]} actions
         * @memberof ActionGroup
         * @public
         * @instance
         */
        actions: {
            get: function(){
                return actions;
            },
            set: function(val){
                if(is_na(val))
                    return undefined;
                if(val.constructor.name != "Array")
                    return undefined;

                var ok = true;
                for(var i = 0, j = val.length; i < j; i++){
                    ok &= (val[i].constructor.name == "ActionGroup") || (val[i].constructor.name == "Action");
                }
                if(!ok)
                    return undefined;

                actions = val;
                return val;
            }
        }
    });

    if(config.mode === "parallel"){
        type = ActionGroup.Mode.PARALLEL;
    } else if(config.mode === "serie"){
        type = ActionGroup.Mode.SERIE;
    } else {
        throw "Could not resolve command type: listener or command_group";
    }

    var actionsGroupChild = [];
    for(var i = 0, j = config.actions.length; i < j; i++){
        var actionGroupChildConfig = config.actions[i];
        var actionGroupChild = null;

        if(actionGroupChild === null && ActionGroup.test(actionGroupChildConfig)){
            try{
                actionGroupChild = new ActionGroup(actionGroupChildConfig);
            } catch(e){
                deployer.log.warn("ActionGroup said it can parse an object it failed on:", JSON.stringify(actionGroupChildConfig))
            }
        }
        if(actionGroupChild === null && Action.test(actionGroupChildConfig)){
            try{
                actionGroupChild = new Action(actionGroupChildConfig);
            } catch(e){
                deployer.log.warn("Action said it can parse an object it failed on:", JSON.stringify(actionGroupChildConfig));
            }
        }
        if(actionGroupChild === null){
            throw "Could not parse ActionGroup child: " + JSON.stringify(actionGroupChildConfig);
        }
        console.log(actionGroupChild);
        actionsGroupChild.push(actionGroupChild);
    }
    this.actions = actionsGroupChild;

    if(is_na(this.mode) || is_na(this.actions) || this.actions.length < 1){
        throw "Properties not correctly initialized";
    }
}

/**
 * @readonly
 * @enum {number}
 */
ActionGroup.Mode = {
    PARALLEL: 1,
    SERIE: 2
}

ActionGroup.test = function(config){
    return (!is_na(config.mode)) && (typeof config.mode == "string") && (!is_na(config.actions)) && (config.actions.constructor.name == "Array");
}

ActionGroup.prototype.execute = function(breadcrumb, next){
    deployer.log.info("Starting ActionGroup " + breadcrumb.toString());
    var timer = (new Date()).getTime();
    var mode;
    switch(this.mode){
        case 1:{
            mode = "forEachOf";
        } break;

        case 2:{
            mode = "forEachOfSeries";
        } break;
    }

    async[mode](this.actions, function(action, index, callback){
        action.execute(breadcrumb.clone().push(index), callback);
    }, function(){
        var time = ((new Date()).getTime() - timer);
        deployer.log.info("Ended ActionGroup " + breadcrumb.toString() + " after " + time + "ms");
        next();
    });
}

module.exports = ActionGroup;
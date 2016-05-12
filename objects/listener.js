'use strict';

const Action = require('./action.js');
const Arguments = require('./arguments.js');
const Breadcrumb = require('./breadcrumb.js');
const chokidar = require('chokidar');

/**
 * @class Listener
 * @description Initialize an event listener
 * @param   {object}   config Configuration of the listener
 */
class Listener{
    constructor({action, data = {}, args = {}, next = null, events = null}){
        if(is_na(arguments[0]))
            throw new Error("Can't create Listener with null or undefined config.");

        console.log("Creating listener:", arguments, action, data, args, next,events);
        this.actionHandler = new Action({action,data}, true);
        
        this.linkingTable = {};
        
        for(var event in events){
            switch(event){
                case "onchange":{
                    var files = filesFromSelectors(events[event].selection);
                    console.log({event,files});
                    
                    this.linkingTable[event] = files;
                    let watcher = chokidar.watch(files, {
                        persistent: false
                    });
                    watcher.on("change", path => {
                        console.log(`${ path } has changed on ${ new Date().toString() }`);
                        this.actionHandler.trigger(new Breadcrumb, path, function(){console.log("Ended")});
                    });
                } break;
            }
        }

    }
}

module.exports = Listener;
/**
 * @file Class file for event handlers
 *
 * @author Gerkin
 * @copyright 2016 %company.name%
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPLv3
 * @package deployer.js
 *
 * @version %version%
 */

'use strict';

const ListenerAction = require('./listeneraction.js');
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
        this.actionHandler = new ListenerAction({action,data,next});

        this.linkingTable = {};
        this.events = events;

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
                        this.actionHandler.trigger(new Breadcrumb().push(event), path, function(){
                            console.log("Ended")
                        });
                    });
                } break;
            }
        }
    }
    warmup(next){
        async.forEachOfSeries(this.events, (event, key, cb) => {
            if(!is_na(event.warmup) && event.warmup === true){
                let table = this.linkingTable[key];
                console.log(table);
                async.each(table, (file,partialCb) => {
                    console.log("Go file", file);
                    this.actionHandler.trigger(new Breadcrumb().push(key ), file, partialCb);
                },cb);
            } else {
                cb();
            }
        }, next);
    }
}

module.exports = Listener;
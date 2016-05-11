'use strict';

const Arguments = require('./arguments.js');

/**
 * @class Listener
 * @description Initialize an event listener
 * @param   {object}   config Configuration of the listener
 */
class Listener{
    constructor({action, data = {}, args, next = null}){
        if(is_na(arguments[0]))
            throw new Error("Can't create Listener with null or undefined config.");

        console.log("Creating listener:", arguments, action, data, args, next);
    }
}
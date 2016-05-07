'use strict';

/**
 * Cosmetic breadcrumb & monitoring
 * @class Breadcrumb
 * @author Gerkin
 * @param   {object} options Configuration options
 */
function Breadcrumb(options){
    var elements = [];
    Object.defineProperties(this, {
        elements: {
            get: function(){
                return elements.slice(0);
            },
            set: function(val){
                // TODO: check if array
                elements = val;
            }
        }
    });
    this.elements = [];
}

/**
 * Returns a copy of this instance
 * @author Gerkin
 * @returns {Breadcrumb} Copy of this
 */
Breadcrumb.prototype.clone = function(){
    var newBreadcrumb = new Breadcrumb();
    for (var prop in this) { 
        newBreadcrumb[prop] = this[prop];
    }
    return newBreadcrumb;
}

/**
 * Add an element at the end of the breadcrumb
 * @author Gerkin
 * @param   {string} elem New element name
 * @returns {this} This
 */
Breadcrumb.prototype.push = function(elem){
    var elems = this.elements;
    elems.push(elem);
    this.elements = elems;
    return this;
}

/**
 * Remove a single element from the end of the breadcrumb 
 * @author Gerkin
 * @returns {this} This
 */
Breadcrumb.prototype.pop = function(){
    var elements = this.elements;
    elements.pop();
    this.elements = elements;
    return this;
}

/**
 * Format the breadcrumb
 * @author Gerkin
 * @returns {string} Text breadcrumb
 */
Breadcrumb.prototype.toString = function(){
    var elems = this.elements;
    if(elems.length == 0)
        return "root";
    return elems.join(" > ");
}
/**
 * Starts the breadcrumb timer
 * @author Gerkin
 * @returns {this} This
 */
Breadcrumb.prototype.startTimer = function(){
    this.timer = new Date().getTime();
    return this;
}
/**
 * Get the time elapsed since last {@link Breadcrumb.startTimer}
 * @author Gerkin
 * @returns {number} Time elapsed in ms
 */
Breadcrumb.prototype.getTimer = function(){
    return ((new Date()).getTime() - this.timer)
}

module.exports = Breadcrumb;
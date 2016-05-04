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

Breadcrumb.prototype.clone = function(){
    var newBreadcrumb = new Breadcrumb();
    for (var prop in this) { 
        newBreadcrumb[prop] = this[prop];
    }
    return newBreadcrumb;
}

Breadcrumb.prototype.push = function(elem){
    var elems = this.elements;
    elems.push(elem);
    this.elements = elems;
    return this;
}

Breadcrumb.prototype.pop = function(){
    var elements = this.elements;
    elements.pop();
    this.elements = elements;
    return this;
}

Breadcrumb.prototype.toString = function(){
    var elems = this.elements;
    if(elems.length == 0)
        return "root";
    return elems.join(" > ");
}

module.exports = Breadcrumb;
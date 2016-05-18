/**
 * @file A generic action to inherit from. Pure virtual
 *
 * @author Gerkin
 * @copyright 2016 %company.name%
 * @license http://www.gnu.org/licenses/gpl-3.0.en.html GPLv3
 * @package deployer.js
 *
 * @version %version%
 */

class Action{
    constructor(){}
}


class ActionError extends Error{
    constructor(message = "Error with an action!"){
        super(); 
        this.name = "ActionError";
        this.message = message;
    }
}

module.exports = {Action,ActionError};
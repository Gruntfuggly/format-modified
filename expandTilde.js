var os = require( 'os' );

module.exports.expandTilde = function( path )
{
    var expanded = path;
    expanded = expanded.replace( /^\~([\\/])/, os.homedir() + '$1' );
    expanded = expanded.replace( /\$\{homeDir}/i, os.homedir() );
    return expanded;
}
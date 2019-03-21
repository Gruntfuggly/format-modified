var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );
var path = require( 'path' );
var formatter = require( './formatter.js' );
var parse = require( 'parse-diff' );

function DiffsError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.fetch = function run( document, options )
{
    function debug( text )
    {
        if( options && options.outputChannel )
        {
            options.outputChannel.appendLine( text );
        }
    }

    return new Promise( function( resolve, reject )
    {
        var filePath = vscode.Uri.parse( document.uri.path ).fsPath;
        var folder = path.dirname( filePath );
        var name = path.basename( filePath );

        var differences = "";
        debug( "Fetching diffs for " + name );
        var fetchDiffsProcess = childProcess.spawn( "git", [ "diff", "--no-color", "--", name, "-" ], { cwd: folder } );
        fetchDiffsProcess.stdout.on( 'data', function( data )
        {
            differences += data;
        } );
        fetchDiffsProcess.stderr.on( 'data', function( data )
        {
            debug( "Fetch diffs error:" + data );
            reject( new DiffsError( data, "" ) );
        } );
        fetchDiffsProcess.on( 'close', function( code )
        {
            var parsedDiffs = parse( differences );
            var rangeArguments = [];
            if( parsedDiffs && parsedDiffs.length > 0 )
            {
                parsedDiffs[ 0 ].chunks.map( function( chunk )
                {
                    rangeArguments.push( "-lines=" + ( chunk.newStart + ":" + ( chunk.newStart + chunk.newLines ) ) );
                } );
            }

            debug( "Ranges: " + rangeArguments );

            resolve( formatter.format( document, rangeArguments, options ) );
        } );

        fetchDiffsProcess.stdin.write( document.getText() );
        fetchDiffsProcess.stdin.end();
    } );
};

var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );
var fs = require( 'fs' );
var path = require( 'path' );
var formatter = require( './formatter.js' );
var parse = require( 'parse-diff' );

function DiffsError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.fetch = function run( document, options, tempFolder )
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

        var relativePath = childProcess.execSync( "git ls-files --full-name " + filePath, { cwd: folder } ).toString().trim();
        debug( "Relative path: " + relativePath );

        var tempFileName = path.join( tempFolder, name );

        fs.writeFileSync( tempFileName, document.getText() );

        var differences = "";
        debug( "Fetching diffs for " + name + " in " + folder );
        var command = "git show :" + relativePath + " | git diff -U0 --no-index --exit-code --no-color -- - " + tempFileName;
        var fetchDiffsProcess = childProcess.exec( command, { cwd: folder } );
        fetchDiffsProcess.stdout.on( 'data', function( data )
        {
            differences += data;
        } );
        fetchDiffsProcess.stderr.on( 'data', function( data )
        {
            debug( "Fetch diffs error: " + data );
            reject( new DiffsError( data, "" ) );
        } );
        fetchDiffsProcess.on( 'close', function( code )
        {
            fs.unlinkSync( tempFileName );

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

            if( rangeArguments.length > 0 )
            {
                resolve( formatter.format( document, rangeArguments, options ) );
            }
            else
            {
                reject( new DiffsError( "No differences found?", "" ) );
            }
        } );
    } );
};

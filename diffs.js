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

module.exports.fetch = function run( options, document, tempFolder )
{
    return new Promise( function( resolve, reject )
    {
        if( options.wholeDocument === true || vscode.workspace.getConfiguration( 'format-modified' ).get( 'formatWholeDocument' ) )
        {
            options.debug( "Formatting the whole document", options );
            resolve( formatter.format( options, document, [] ) );
        }
        else if( options.selections === true )
        {
            var rangeArguments = [];
            options.editor.selections.map( function( selection )
            {
                var firstLine = selection.start.line + 1;
                var lastLine = selection.end.line + 1;
                if( selection.end.character === 0 )
                {
                    lastLine--;
                }
                options.debug( "Lines " + firstLine + " to " + lastLine, options );
                rangeArguments.push( "-lines=" + ( firstLine + ":" + lastLine ) );
            } );

            options.debug( "Formatting the current selection", options );
            resolve( formatter.format( options, document, rangeArguments ) );
        }
        else
        {
            var filePath = document.fileName;
            var folder = path.dirname( filePath );
            var name = path.basename( filePath );

            try
            {
                var relativePath = childProcess.execSync( "git ls-files --full-name " + filePath, { cwd: folder } ).toString().trim();
                options.debug( "Relative path: " + relativePath, options );

                if( relativePath !== "" )
                {
                    var tempFileName = path.join( tempFolder, name );

                    fs.writeFileSync( tempFileName, document.getText() );

                    if( process.platform !== 'win32' )
                    {
                        tempFileName = tempFileName.replace( /(\s+)/g, '\\$1' );
                    }

                    var differences = "";
                    var command = "git show :" + relativePath + " | git diff -U0 --no-index --exit-code --no-color -- - " + tempFileName;

                    options.debug( "Fetching diffs for " + name + " in " + folder + " using:", options );
                    options.debug( " " + command, options );

                    var fetchDiffsProcess = childProcess.exec( command, { cwd: folder } );
                    fetchDiffsProcess.stdout.on( 'data', function( data )
                    {
                        differences += data;
                    } );
                    fetchDiffsProcess.stderr.on( 'data', function( data )
                    {
                        reject( new DiffsError( "Failed to fetch diffs", data ) );
                    } );
                    fetchDiffsProcess.on( 'close', function( code )
                    {
                        if( fs.existsSync( tempFileName ) )
                        {
                            fs.unlinkSync( tempFileName );
                        }

                        var parsedDiffs = parse( differences );
                        var rangeArguments = [];
                        if( parsedDiffs && parsedDiffs.length > 0 )
                        {
                            parsedDiffs[ 0 ].chunks.map( function( chunk )
                            {
                                var hasChanges = chunk.changes.filter( function( change )
                                {
                                    return change.type != 'del';
                                } ).length > 0;
                                if( hasChanges )
                                {
                                    var endLine = chunk.newStart + chunk.newLines - ( chunk.newLines > 0 ? 1 : 0 );
                                    rangeArguments.push( "-lines=" + ( chunk.newStart + ":" + endLine ) );
                                }
                            } );
                        }

                        if( rangeArguments.length > 0 )
                        {
                            options.debug( "Ranges:" + JSON.stringify( rangeArguments ), options );
                            resolve( formatter.format( options, document, rangeArguments ) );
                        }
                        else
                        {
                            reject( new DiffsError( "", "No differences found?" ) );
                        }
                    } );
                }
                else
                {
                    options.debug( "File not in git, so formatting the whole document", options );
                    resolve( formatter.format( options, document, [] ) );
                }
            }
            catch( e )
            {
                options.debug( e, options );
                options.debug( "Formatting the whole document", options );
                resolve( formatter.format( options, document, [] ) );
            }
        }
    } );
};


var vscode = require( 'vscode' );
var path = require( 'path' );
var exec = require( 'child_process' ).execSync;
var minimatch = require( 'minimatch' );

function getRanges( array )
{
    var numbers = array.map( Number );
    for( var ranges = [], rend, i = 0; i < numbers.length; )
    {
        ranges.push( ( rend = array[ i ] ) + ( ( function( rstart )
        {
            while( ++rend === numbers[ ++i ] );
            return --rend === rstart;
        } )( rend ) ? '' : ':' + rend ) );
    }
    return ranges;
}

function activate( context )
{
    var outputChannel;

    function resetOutputChannel()
    {
        if( outputChannel )
        {
            outputChannel.dispose();
            outputChannel = undefined;
        }
        if( vscode.workspace.getConfiguration( 'format-modified' ).debug === true )
        {
            outputChannel = vscode.window.createOutputChannel( "Format Modified" );
            context.subscriptions.push( outputChannel );
        }
    }

    function debug( text )
    {
        if( outputChannel )
        {
            outputChannel.appendLine( text );
        }
    }

    resetOutputChannel();

    function format()
    {
        var clangFormatConfig = vscode.workspace.getConfiguration( 'clang-format' );
        var clangFormat = clangFormatConfig && clangFormatConfig.executable;
        if( !clangFormat || clangFormat === "clang-format" )
        {
            var cppConfig = vscode.workspace.getConfiguration( 'C_Cpp' );
            clangFormat = cppConfig && cppConfig.clang_format_path;
        }
        if( !clangFormat )
        {
            clangFormat = "clang-format";
        }

        var editor = vscode.window.activeTextEditor;
        var filePath = vscode.Uri.parse( editor.document.uri.path ).fsPath;
        var folder = path.dirname( filePath );
        var name = path.basename( filePath );

        var blameCommand = "git blame " + name;
        var blame;
        var ranges = [];
        try
        {
            blame = exec( blameCommand, { cwd: folder } );

            var lines = blame.toString().split( "\n" );
            var modified = lines.reduce( function( filtered, line, index )
            {
                if( line.indexOf( "00000000" ) === 0 )
                {
                    filtered.push( index + 1 );
                }
                return filtered;
            }, [] );

            ranges = getRanges( modified );

            if( ranges && ranges.length > 0 )
            {
                var args = "";
                ranges.map( function( range )
                {
                    if( range !== ":0" )
                    {
                        if( range.indexOf( ":" ) === -1 )
                        {
                            range += ( ":" + range );
                        }
                        args += " -lines=" + range;
                    }
                } );

                var formatCommand = clangFormat + " -i " + args + " " + name;
                debug( formatCommand );
                exec( formatCommand, { cwd: folder } );
            }
            else
            {
                debug( "No changes found in " + name );
            }
        }
        catch( e )
        {
            // format the whole file...
            var formatCommand = clangFormat + " -i " + name;
            debug( formatCommand );
            exec( formatCommand, { cwd: folder } );
        }
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.format', format ) );

    context.subscriptions.push( vscode.workspace.onDidSaveTextDocument( e =>
    {
        if( e.uri.scheme === "file" )
        {
            var globs = vscode.workspace.getConfiguration( 'format-modified' ).globs;
            var shouldFormat = !globs || globs.length === 0;
            if( !shouldFormat )
            {
                globs.forEach( glob =>
                {
                    if( minimatch( e.fileName, glob ) )
                    {
                        shouldFormat = true;
                    }
                } );
            }

            if( shouldFormat === true )
            {
                format();
            }
        }
    } ) );

    context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
    {
        if( e.affectsConfiguration( "format-modified" ) )
        {
            if( e.affectsConfiguration( "format-modified.debug" ) )
            {
                resetOutputChannel();
            }
        }
    } ) );
}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;

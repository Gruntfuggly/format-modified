
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
    function format()
    {
        var editor = vscode.window.activeTextEditor;
        var filePath = vscode.Uri.parse( editor.document.uri.path ).fsPath;
        var folder = path.dirname( filePath );
        var name = path.basename( filePath );

        var blameCommand = "git blame " + name + " | grep -n '^0* ' | cut -f1 -d: ";
        var status = exec( blameCommand, { cwd: folder } )
        var ranges = getRanges( ( status + "" ).split( "\n" ) );

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

        ranges.map( function( range )
        {
            if( range !== ":0" )
            {
                var positions = range.split( ":" );
                if( positions.length === 2 )
                {
                    var formatCommand = clangFormat + " -i -lines=" + range + " " + name;
                    exec( formatCommand, { cwd: folder } );
                }
            }
        } );
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

}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;

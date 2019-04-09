var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );

function FormatError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.format = function run( document, rangeArguments, options )
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

    function debug( text )
    {
        if( options && options.outputChannel )
        {
            options.outputChannel.appendLine( text );
        }
    }

    return new Promise( function( resolve, reject )
    {
        debug( "Formatting using " + clangFormat );
        var formattedFile = "";
        var formatFileProcess = childProcess.spawn( clangFormat, rangeArguments );
        formatFileProcess.stdout.on( 'data', function( data )
        {
            formattedFile += data;
        } );
        formatFileProcess.stderr.on( 'data', function( data )
        {
            debug( "Format File error:" + data );
            reject( new FormatError( data, "" ) );
        } );
        formatFileProcess.on( 'close', function( code )
        {
            var edits = [];
            let start = document.positionAt( 0 );
            let end = document.positionAt( document.getText().length );
            let editRange = new vscode.Range( start, end );
            edits.push( new vscode.TextEdit( editRange, formattedFile ) );
            debug( "Created edits" );
            resolve( edits );
        } );
        formatFileProcess.stdin.write( document.getText() );
        formatFileProcess.stdin.end();
    } );
};

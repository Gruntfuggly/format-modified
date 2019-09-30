var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );
var path = require( 'path' );

function FormatError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.format = function run( document, rangeArguments, options, tidy )
{
    function debug( text )
    {
        if( options && options.outputChannel )
        {
            options.outputChannel.appendLine( text );
        }
    }

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

    var cwd = path.dirname( document.fileName );

    var formatArguments = [];
    formatArguments.push( "-style=file" );
    formatArguments = formatArguments.concat( rangeArguments );

    debug( "Formatting using " + clangFormat + " " + formatArguments.join( " " ) + " in folder " + cwd );

    return new Promise( function( resolve, reject )
    {
        var formattedFile = "";
        var formatFileProcess = childProcess.spawn( clangFormat, formatArguments, { cwd: cwd } );
        formatFileProcess.stdout.on( 'data', function( data )
        {
            formattedFile += data;
        } );
        formatFileProcess.stderr.on( 'data', function( data )
        {
            debug( "Format File error:" + data );
            tidy();
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
            tidy();
            resolve( edits );
        } );
        formatFileProcess.stdin.write( document.getText() );
        formatFileProcess.stdin.end();
    } );
};

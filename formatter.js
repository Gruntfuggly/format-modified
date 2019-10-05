var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );
var fs = require( 'fs' );
var path = require( 'path' );
var yamljs = require( 'yamljs' );

function FormatError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.format = function run( options, document, rangeArguments )
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

    var cwd = path.dirname( document.fileName );

    var formatArguments = [];

    if( options.configurationFile )
    {
        var style = yamljs.parse( fs.readFileSync( options.configurationFile, 'utf8' ) );
        formatArguments.push( "-style=" + yamljs.stringify( style, 0 ) );
    }
    else
    {
        formatArguments.push( "-style=file" );
    }
    formatArguments = formatArguments.concat( rangeArguments );

    options.debug( "Formatting using:", options );
    options.debug( " " + clangFormat + " " + formatArguments.join( " " ), options );
    options.debug( "in folder " + cwd, options );

    return new Promise( function( resolve, reject )
    {
        var formattedFile = "";
        var formatFileProcess = childProcess.spawn( clangFormat, formatArguments, { cwd: cwd } );

        if( formatFileProcess.pid === undefined )
        {
            reject( new FormatError( "Failed to execute clang format", "" ) );
        }

        formatFileProcess.stdout.on( 'data', function( data )
        {
            formattedFile += data;
        } );
        formatFileProcess.stderr.on( 'data', function( data )
        {
            reject( new FormatError( "Failed to format file", data ) );
        } );
        formatFileProcess.on( 'close', function( code )
        {
            var edits = [];
            var start = document.positionAt( 0 );
            var end = document.positionAt( document.getText().length );
            var editRange = new vscode.Range( start, end );
            edits.push( new vscode.TextEdit( editRange, formattedFile ) );
            options.debug( "Format complete", options );
            resolve( edits );
        } );
        formatFileProcess.stdin.write( document.getText() );
        formatFileProcess.stdin.end();
    } );
};

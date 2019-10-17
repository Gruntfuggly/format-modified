var childProcess = require( 'child_process' );
var vscode = require( 'vscode' );
var fs = require( 'fs' );
var path = require( 'path' );
var yamljs = require( 'yamljs' );
var expandTilde = require( './expandTilde.js' ).expandTilde;

function FormatError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

module.exports.format = function run( options, document, rangeArguments )
{
    return new Promise( function( resolve, reject )
    {
        function findExecutable( clangFormat, module, setting )
        {
            if( !clangFormat )
            {
                var clangFormat = vscode.workspace.getConfiguration( module ).get( setting );
                if( clangFormat && fs.existsSync( clangFormat ) )
                {
                    options.debug( "Using clang-format executable defined by '" + module + "." + setting + "': " + clangFormat, options );
                }
            }
            return clangFormat;
        }

        var clangFormat;
        clangFormat = findExecutable( clangFormat, 'format-modified', 'executable' );
        clangFormat = findExecutable( clangFormat, 'clang-format', 'executable' );
        clangFormat = findExecutable( clangFormat, 'C_Cpp', 'clang_format_path' );

        if( !clangFormat )
        {
            clangFormat = "clang-format";
            options.debug( "Using clang-format in user path", options );
        }

        var cwd = path.dirname( document.fileName );

        var formatArguments = [];

        if( options.configurationFile )
        {
            var configurationFile = expandTilde( options.configurationFile );
            if( fs.existsSync( configurationFile ) )
            {
                var style = yamljs.parse( fs.readFileSync( configurationFile, 'utf8' ) );
                formatArguments.push( "-style=" + yamljs.stringify( style, 0 ) );
            }
            else
            {
                reject( new FormatError( "Configuration file not found: " + options.configurationFile, "" ) );
            }
        }
        else
        {
            formatArguments.push( "-style=file" );
        }

        formatArguments = formatArguments.concat( rangeArguments );

        options.debug( "Formatting using:", options );
        options.debug( " " + clangFormat + " " + formatArguments.join( " " ), options );
        options.debug( "in folder " + cwd, options );

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

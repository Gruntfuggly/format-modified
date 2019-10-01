
var fs = require( 'fs' );
var path = require( 'path' );
var crypto = require( 'crypto' );
var vscode = require( 'vscode' );
var micromatch = require( 'micromatch' );
var diffs = require( './diffs.js' );

var USE_LOCAL_CONFIGURATION_FILE = 'none (find .clang-format)';

function activate( context )
{
    var outputChannel;
    var provider;

    var formatContext = {};

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

    function updateContext( document )
    {
        formatContext = {};

        formatContext.formatFilePath = path.join( path.dirname( document.fileName ), '.clang-format' );
        formatContext.backupFormatFilePath = undefined;
        formatContext.alternativeFormatFilePath = undefined;

        var config = vscode.workspace.getConfiguration( 'format-modified' ).get( 'configurationFileMapping' );
        if( document && document.uri.scheme === 'file' )
        {
            Object.keys( config ).map( function( glob )
            {
                if( config.hasOwnProperty( glob ) )
                {
                    if( micromatch.isMatch( document.fileName, glob ) )
                    {
                        formatContext.alternativeFormatFilePath = config[ glob ];

                        debug( "Using alternative configuration file: " + formatContext.alternativeFormatFilePath );

                        if( fs.existsSync( formatContext.formatFilePath ) )
                        {
                            debug( "Preserving current .clang-format" );
                            formatContext.backupFormatFilePath = formatFilePath + '.' + crypto.randomBytes( 4 ).readUInt32LE();
                            fs.renameSync( formatContext.formatFilePath, formatContext.backupFormatFilePath );
                        }

                        fs.copyFileSync( formatContext.alternativeFormatFilePath, formatContext.formatFilePath );
                    }
                }
            } );
        }
    }

    function format( document )
    {
        function tidy()
        {
            if( formatContext.backupFormatFilePath )
            {
                debug( "Restoring original .clang-format" );
                fs.rename( formatContext.backupFormatFilePath, formatContext.formatFilePath, function()
                {
                    fs.unlinkSync( formatContext.backupFormatFilePath );
                } );
            }
            else if( formatContext.alternativeFormatFilePath )
            {
                debug( "Removing alternative .clang-format" );
                fs.unlinkSync( formatContext.formatFilePath );
            }

            debug( "Finished" );
        }

        var options = { outputChannel: outputChannel };
        try
        {
            if( !fs.existsSync( context.globalStoragePath ) )
            {
                fs.mkdirSync( context.globalStoragePath );
            }

            if( document )
            {
                return new Promise( function( resolve, reject )
                {
                    updateContext( document );
                    diffs.fetch( document, options, context.globalStoragePath ).then( function( edits )
                    {
                        tidy();
                        resolve( edits );
                    } ).catch( function( error )
                    {
                        debug( error.message );
                        debug( error.stderr );
                        vscode.window.showErrorMessage( error.message );
                        tidy();
                    } );
                } );
            }
            else
            {
                updateContext( vscode.window.activeTextEditor.document );
                var previousPosition = vscode.window.activeTextEditor.selection.active;

                diffs.fetch( vscode.window.activeTextEditor.document, options, context.globalStoragePath ).then( function( edits )
                {
                    var workspaceEdit = new vscode.WorkspaceEdit();
                    workspaceEdit.set(
                        vscode.window.activeTextEditor.document.uri,
                        edits );

                    vscode.workspace.applyEdit( workspaceEdit ).then( function()
                    {
                        debug( "Restoring previous cursor position" );
                        vscode.window.activeTextEditor.selection = new vscode.Selection( previousPosition, previousPosition );
                        debug( "OK" );
                    } );

                    tidy();
                } ).catch( function( error )
                {
                    debug( error.message );
                    debug( error.stderr );
                    vscode.window.showErrorMessage( error.message );
                    tidy();
                } );
            }
        }
        catch( e )
        {
            console.log( e );
            debug( e );
            tidy();
            return [];
        }
    }

    function register()
    {
        if( provider )
        {
            provider.dispose();
        }

        var documentSelector = [];

        vscode.workspace.getConfiguration( 'format-modified' ).languages.map( function( language )
        {
            documentSelector.push( { scheme: "file", language: language } );
        } );

        debug( "Supported languages: " + JSON.stringify( documentSelector ) );

        provider = vscode.languages.registerDocumentFormattingEditProvider( documentSelector, {
            provideDocumentFormattingEdits( document )
            {
                debug( "Formatter triggered..." );

                return new Promise( function( resolve, reject )
                {
                    format( document ).then( function( edits )
                    {
                        resolve( edits );
                    } );
                } );
            }
        } );

        context.subscriptions.push( provider );
    }

    resetOutputChannel();
    register();

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.format', format ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.setConfigurationFile', function()
    {
        if( vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).get( 'configurationFileMapping' );
            var filename = vscode.window.activeTextEditor.document.fileName;
            var files = vscode.workspace.getConfiguration( 'format-modified' ).get( 'alternativeConfigurationFiles' );
            var current = config[ filename ];
            files = files.map( function( file )
            {
                if( file === current )
                {
                    return file + " (current)";
                }
                return file;
            } );
            files.unshift( USE_LOCAL_CONFIGURATION_FILE );
            vscode.window.showQuickPick( files, { placeHolder: "Select a format file for use with this file" } ).then( function( formatFile )
            {
                if( formatFile === USE_LOCAL_CONFIGURATION_FILE )
                {
                    delete config[ filename ];
                }
                else
                {
                    config[ filename ] = formatFile;
                }
                vscode.workspace.getConfiguration( 'format-modified' ).update( 'configurationFileMapping', config );
                if( fs.existsSync( formatFile ) !== true )
                {
                    vscode.window.showErrorMessage( "Format file not found: " + formatFile );
                }
            } );
        }
        else
        {
            vscode.window.showInformationMessage( "Please open a file first" );
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
            else if( e.affectsConfiguration( "format-modified.languages" ) )
            {
                register();
            }
        }
    } ) );
}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;

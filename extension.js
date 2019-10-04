
var fs = require( 'fs' );
var vscode = require( 'vscode' );
var micromatch = require( 'micromatch' );
var diffs = require( './diffs.js' );

var USE_LOCAL_CONFIGURATION_FILE = 'none (find .clang-format)';

function activate( context )
{
    var outputChannel;
    var provider;

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

    function getConfigurationFile( document )
    {
        var configurationFile;

        if( document && document.uri.scheme === 'file' )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).get( 'configurationFileMapping' );

            Object.keys( config ).map( function( glob )
            {
                if( config.hasOwnProperty( glob ) )
                {
                    if( micromatch.isMatch( document.fileName, glob ) )
                    {
                        configurationFile = config[ glob ];

                        debug( "Using alternative configuration file: " + configurationFile );
                    }
                }
            } );
        }

        return configurationFile;
    }

    function format( document )
    {
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
                    options.configurationFile = getConfigurationFile( document );

                    diffs.fetch( document, options, context.globalStoragePath ).then( function( edits )
                    {
                        resolve( edits );
                    } ).catch( function( error )
                    {
                        debug( error.message );
                        debug( error.stderr );
                        vscode.window.showErrorMessage( error.message );
                    } );
                } );
            }
            else
            {
                options.configurationFile = getConfigurationFile( vscode.window.activeTextEditor.document );

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

                } ).catch( function( error )
                {
                    debug( error.message );
                    debug( error.stderr );
                    vscode.window.showErrorMessage( error.message );
                } );
            }
        }
        catch( e )
        {
            debug( e );
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
                debug( "\nFormatter triggered..." );

                var started = new Date();

                return new Promise( function( resolve, reject )
                {
                    format( document ).then( function( edits )
                    {
                        var elapsedTime = new Date() - started;

                        debug( "Elapsed time:" + elapsedTime + "ms" );
                        if( elapsedTime > vscode.workspace.getConfiguration( 'editor' ).get( 'formatOnSaveTimeout' ) )
                        {
                            var message = "Formatting took too long (" + elapsedTime + "ms).";
                            vscode.window.showInformationMessage( message, "Open Settings", "Ignore" ).then( function( button )
                            {
                                if( button === "Open Settings" )
                                {
                                    vscode.commands.executeCommand( 'workbench.action.openSettings', 'editor.formatOnSaveTimeout' );
                                }
                            } );
                        }

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
            var options = files.map( function( file )
            {
                if( file === current )
                {
                    return file + " (current)";
                }
                return file;
            } );
            options.unshift( USE_LOCAL_CONFIGURATION_FILE );
            vscode.window.showQuickPick( options, { placeHolder: "Select a format file for use with this file" } ).then( function( formatFile )
            {
                if( formatFile === USE_LOCAL_CONFIGURATION_FILE )
                {
                    delete config[ filename ];
                }
                else
                {
                    config[ filename ] = files[ options.indexOf( formatFile ) - 1 ];
                    if( fs.existsSync( formatFile ) !== true )
                    {
                        vscode.window.showErrorMessage( "Format file not found: " + formatFile );
                    }
                }
                vscode.workspace.getConfiguration( 'format-modified' ).update( 'configurationFileMapping', config );
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

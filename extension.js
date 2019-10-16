var fs = require( 'fs' );
var vscode = require( 'vscode' );
var micromatch = require( 'micromatch' );
var diffs = require( './diffs.js' );
var expandTilde = require( './expandTilde.js' ).expandTilde;

var jobNumber = 1;
var USE_LOCAL_CONFIGURATION_FILE = "None (find .clang-format)";
var DO_NOT_FORMAT = "Don't format this file";
var RETRY = "Retry";
var OPEN_SETTINGS = "Open Settings";

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

    function debug( text, options )
    {
        if( outputChannel )
        {
            outputChannel.appendLine( options && options.jobNumber ? ( options.jobNumber + "> " + text ) : text );
        }
    }

    function getConfigurationFile( options, document )
    {
        function findExactMatch()
        {
            for( var i = 0; i < globs.length; ++i )
            {
                var glob = globs[ i ];

                if( config.hasOwnProperty( glob ) && document.fileName === glob )
                {
                    debug( "Matched glob: " + glob, options );
                    configurationFile = config[ glob ];

                    debug( "Using alternative configuration file: " + configurationFile, options );
                }
            }
        }

        function findAnyMatch()
        {
            for( var i = 0; i < globs.length; ++i )
            {
                var glob = globs[ i ];

                if( config.hasOwnProperty( glob ) )
                {
                    if( micromatch.isMatch( document.fileName, glob ) )
                    {
                        debug( "Matched glob: " + glob, options );
                        configurationFile = config[ glob ];

                        debug( "Using alternative configuration file: " + configurationFile, options );
                        break;
                    }
                }
            }
        }

        var configurationFile;

        if( document && document.uri.scheme === 'file' )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).get( 'configurationFileMapping' );
            var globs = Object.keys( config );

            findExactMatch();
            if( !configurationFile )
            {
                findAnyMatch();
            }
        }

        return configurationFile;
    }

    function format( options, document )
    {
        if( !options )
        {
            options = { debug: debug, jobNumber: jobNumber++ };
            debug( "Manual format, starting job " + options.jobNumber );
        }

        try
        {
            if( !fs.existsSync( context.globalStoragePath ) )
            {
                fs.mkdirSync( context.globalStoragePath );
            }

            if( document )
            {
                debug( "Formatting " + document.fileName, options );
                return new Promise( function( resolve, reject )
                {
                    options.configurationFile = getConfigurationFile( options, document );
                    if( options.configurationFile === DO_NOT_FORMAT )
                    {
                        debug( "Formatting inhibited for " + document.fileName );
                    }
                    else
                    {
                        diffs.fetch( options, document, context.globalStoragePath ).then( function( edits )
                        {
                            resolve( edits );
                        } ).catch( function( error )
                        {
                            debug( error.message, options );
                            debug( error.stderr, options );
                            vscode.window.showErrorMessage( error.message );
                        } );
                    }
                } );
            }
            else
            {
                debug( "Formatting " + vscode.window.activeTextEditor.document.fileName, options );
                options.configurationFile = getConfigurationFile( options, vscode.window.activeTextEditor.document );

                if( options.configurationFile === DO_NOT_FORMAT )
                {
                    debug( "Formatting inhibited for " + document.fileName );
                }
                else
                {
                    var previousPosition = vscode.window.activeTextEditor.selection.active;

                    diffs.fetch( options, vscode.window.activeTextEditor.document, context.globalStoragePath ).then( function( edits )
                    {
                        var workspaceEdit = new vscode.WorkspaceEdit();
                        workspaceEdit.set(
                            vscode.window.activeTextEditor.document.uri,
                            edits );

                        vscode.workspace.applyEdit( workspaceEdit ).then( function()
                        {
                            debug( "Restoring previous cursor position", options );
                            vscode.window.activeTextEditor.selection = new vscode.Selection( previousPosition, previousPosition );
                        } );

                    } ).catch( function( error )
                    {
                        if( error.stderr )
                        {
                            debug( error.stderr, options );
                        }
                        if( error.message )
                        {
                            debug( error.message, options );
                            vscode.window.showErrorMessage( error.message );
                        }
                    } );
                }
            }
        }
        catch( e )
        {
            debug( e, options );
            return [];
        }
    }

    function formatWholeDocument()
    {
        var options = { wholeDocument: true, debug: debug, jobNumber: jobNumber++ };
        debug( "Manual format whole document, starting job " + options.jobNumber );
        format( options );
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
            provideDocumentFormattingEdits: function( document )
            {
                var options = { debug: debug, jobNumber: jobNumber++ };

                debug( "Formatter triggered for " + document.fileName, options );

                var started = new Date();

                return new Promise( function( resolve, reject )
                {
                    format( options, document ).then( function( edits )
                    {
                        var elapsedTime = new Date() - started;

                        debug( "Elapsed time:" + elapsedTime + "ms", options );
                        if( elapsedTime > vscode.workspace.getConfiguration( 'editor' ).get( 'formatOnSaveTimeout' ) )
                        {
                            var message = "Formatting took too long (" + elapsedTime + "ms).";
                            vscode.window.showInformationMessage( message, RETRY, OPEN_SETTINGS ).then( function( button )
                            {
                                if( button === RETRY )
                                {
                                    options.debug( "Retry", options );
                                    format();
                                }
                                if( button === OPEN_SETTINGS )
                                {
                                    vscode.commands.executeCommand( 'workbench.action.openSettings', 'editor.formatOnSaveTimeout' );
                                }
                            } );
                            reject();
                        }
                        else
                        {
                            resolve( edits );
                        }
                    } );
                } );
            }
        } );

        context.subscriptions.push( provider );
    }

    resetOutputChannel();
    register();

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.format', format ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.formatWholeDocument', formatWholeDocument ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.setConfigurationFile', function()
    {
        if( vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' )
        {
            function updateConfigurationFileSetting( filename, setting, originalConfig, updatedConfig )
            {
                if( !originalConfig[ filename ] )
                {
                    debug( "Adding configuration for " + filename + ": " + setting );
                    updatedConfig[ filename ] = setting;
                }
                else
                {
                    debug( "Updating configuration for " + filename + ": " + setting );
                }
                Object.keys( originalConfig ).map( function( key )
                {
                    updatedConfig[ key ] = key === filename ? setting : config[ key ];
                } );
            }

            var config = vscode.workspace.getConfiguration( 'format-modified' ).inspect( 'configurationFileMapping' ).workspaceValue;
            if( config === undefined )
            {
                config = {};
            }
            var filename = vscode.window.activeTextEditor.document.fileName;
            var files = vscode.workspace.getConfiguration( 'format-modified' ).get( 'alternativeConfigurationFiles' );
            if( files.length > 0 )
            {
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
                options.push( DO_NOT_FORMAT );
                vscode.window.showQuickPick( options, { placeHolder: "Select a configuration file for formatting this file" } ).then( function( formatFile )
                {
                    if( formatFile )
                    {
                        var configurationFilename = files[ options.indexOf( formatFile ) - 1 ];
                        var updatedConfig = config;
                        if( formatFile === USE_LOCAL_CONFIGURATION_FILE )
                        {
                            debug( "Removing configuration for " + filename );
                            delete updatedConfig[ filename ];
                        }
                        else if( formatFile === DO_NOT_FORMAT )
                        {
                            updateConfigurationFileSetting( filename, DO_NOT_FORMAT, config, updatedConfig );
                        }
                        else
                        {
                            updateConfigurationFileSetting( filename, configurationFilename, config, updatedConfig );

                            if( fs.existsSync( expandTilde( configurationFilename ) ) !== true )
                            {
                                vscode.window.showErrorMessage( "Configuration file not found: " + configurationFilename );
                            }
                        }
                        vscode.workspace.getConfiguration( 'format-modified' ).update( 'configurationFileMapping', updatedConfig );
                    }
                } );
            }
            else
            {
                vscode.window.showInformationMessage( "Please define some alternative configuration files first.", OPEN_SETTINGS ).then( function( button )
                {
                    if( button === OPEN_SETTINGS )
                    {
                        vscode.commands.executeCommand( 'workbench.action.openSettings', 'format-modified.alternativeConfigurationFiles' );
                    }
                } );

            }
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

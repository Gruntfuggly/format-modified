var fs = require( 'fs' );
var vscode = require( 'vscode' );
var micromatch = require( 'micromatch' );
var path = require( 'path' );
var diffs = require( './diffs.js' );
var expandTilde = require( './expandTilde.js' ).expandTilde;

var jobNumber = 1;
var USE_LOCAL_CONFIGURATION_FILE = "None (find .clang-format)";
var USE_INHERITED = "None (use workspace setting or find .clang-format)";
var DO_NOT_FORMAT = "Don't format this file";
var RETRY = "Retry";
var OPEN_SETTINGS = "Open Settings";

function activate( context )
{
    var outputChannel;
    var provider;
    var statusBar = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Right, 0 );

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
                    debug( "Matched exact glob: " + glob, options );
                    configurationForFile = {
                        path: config[ glob ],
                        type: "exact"
                    };

                    debug( "Using alternative configuration file: " + configurationForFile.path, options );
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
                        configurationForFile = {
                            path: config[ glob ],
                            type: "glob"
                        };

                        debug( "Using alternative configuration file: " + configurationForFile.path, options );
                        break;
                    }
                }
            }
        }

        var configurationForFile = { path: "", type: "none" };

        if( document && document.uri.scheme === 'file' )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).get( 'configurationFileMapping' );
            var globs = Object.keys( config );

            findExactMatch();

            if( configurationForFile.type === "none" )
            {
                findAnyMatch();
            }

        }


        return configurationForFile;
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
                    options.configurationFile = getConfigurationFile( options, document ).path;
                    if( options.configurationFile === DO_NOT_FORMAT )
                    {
                        debug( "Formatting inhibited for " + document.fileName, options );
                        reject( [] );
                    }
                    else
                    {
                        diffs.fetch( options, document, context.globalStoragePath ).then( function( edits )
                        {
                            resolve( edits );
                        } ).catch( function( error )
                        {
                            debug( "Error message: " + error.message, options );
                            debug( "Error stderr: " + error.stderr, options );
                            vscode.window.showErrorMessage( error.message );
                            reject( error );
                        } );
                    }
                } );
            }
            else
            {
                debug( "Formatting " + vscode.window.activeTextEditor.document.fileName, options );
                options.configurationFile = getConfigurationFile( options, vscode.window.activeTextEditor.document ).path;

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
                            debug( "Error.stderr: " + error.stderr, options );
                        }
                        if( error.message )
                        {
                            debug( "Error.message: " + error.message, options );
                            vscode.window.showErrorMessage( error.message );
                        }
                        reject( error );
                    } );
                }
            }
        }
        catch( e )
        {
            debug( "Error:" + e, options );
            return [];
        }
    }

    function formatWholeDocument()
    {
        var options = { wholeDocument: true, debug: debug, jobNumber: jobNumber++, editor: vscode.window.activeTextEditor };
        debug( "Manual format whole document, starting job " + options.jobNumber );
        format( options );
    }

    function formatSelection()
    {
        if( vscode.window.activeTextEditor )
        {
            var options = { selections: true, debug: debug, jobNumber: jobNumber++, editor: vscode.window.activeTextEditor };
            debug( "Manual format selection, starting job " + options.jobNumber );
            format( options );
        }
        else
        {
            debug( "No active text editor" );
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
                    } ).catch( function()
                    {
                        resolve();
                    } );
                } );
            }
        } );

        context.subscriptions.push( provider );
    }

    function setConfigurationFile( prompt, pattern, config, configTarget )
    {
        function addHighlight( text )
        {
            return "▶ " + text + " ◀";
        }

        function removeHighlight( text )
        {
            text.replace( "▶ ", "" );
            text.replace( " ◀", "" );
            return text;
        }

        function updateConfigurationFileSetting( workspace, setting, originalConfig, updatedConfig )
        {
            if( !originalConfig[ workspace ] )
            {
                debug( "Adding configuration for " + workspace + ": " + setting );
                updatedConfig[ workspace ] = setting;
            }
            else
            {
                debug( "Updating configuration for " + workspace + ": " + setting );
            }
            Object.keys( originalConfig ).map( function( key )
            {
                updatedConfig[ key ] = key === workspace ? setting : config[ key ];
            } );
        }

        if( config === undefined )
        {
            config = {};
        }
        var files = vscode.workspace.getConfiguration( 'format-modified' ).get( 'alternativeConfigurationFiles' );
        if( files.length > 0 )
        {
            var current = config[ pattern ];
            var options = files.map( function( file )
            {
                if( file === current )
                {
                    return addHighlight( file );
                }
                return file;
            } );
            var defaultSelection = prompt === "workspace" ? USE_LOCAL_CONFIGURATION_FILE : USE_INHERITED;
            if( current === undefined )
            {
                defaultSelection = addHighlight( defaultSelection );
            }
            options.unshift( defaultSelection );
            options.push( DO_NOT_FORMAT );
            vscode.window.showQuickPick( options, { placeHolder: "Select a configuration file for formatting this " + prompt } ).then( function( formatFile )
            {
                if( formatFile )
                {
                    formatFile = removeHighlight( formatFile );

                    var configurationFilename = files[ options.indexOf( formatFile ) - 1 ];
                    var updatedConfig = config;
                    if( formatFile === USE_LOCAL_CONFIGURATION_FILE || formatFile === USE_INHERITED )
                    {
                        debug( "Removing configuration for " + pattern );
                        delete updatedConfig[ pattern ];
                    }
                    else if( formatFile === DO_NOT_FORMAT )
                    {
                        updateConfigurationFileSetting( pattern, DO_NOT_FORMAT, config, updatedConfig );
                    }
                    else
                    {
                        updateConfigurationFileSetting( pattern, configurationFilename, config, updatedConfig );

                        if( fs.existsSync( expandTilde( configurationFilename ) ) !== true )
                        {
                            vscode.window.showErrorMessage( "Configuration file not found: " + configurationFilename );
                        }
                    }
                    vscode.workspace.getConfiguration( 'format-modified' ).update( 'configurationFileMapping', updatedConfig, configTarget );
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

    function updateStatusBar()
    {
        if( vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' )
        {
            var configurationFile = getConfigurationFile( { debug: debug }, vscode.window.activeTextEditor.document );

            if( configurationFile.path )
            {
                statusBar.text = "$(json) " + path.basename( configurationFile.path );
                if( configurationFile.type === "glob" )
                {
                    statusBar.text += " $(regex)";
                }

                statusBar.command = 'format-modified.setConfigurationFileForThisFile';

                if( vscode.workspace.getConfiguration( 'format-modified' ).get( 'showCurrentConfigurationFileInStatusBar' ) )
                {
                    statusBar.show();
                    return;
                }
            }
        }

        statusBar.hide();
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.format', format ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.formatWholeDocument', formatWholeDocument ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.formatSelection', formatSelection ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.setConfigurationFileForThisFile', function()
    {
        if( vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).inspect( 'configurationFileMapping' ).workspaceValue;

            setConfigurationFile( "file", vscode.window.activeTextEditor.document.fileName, config, vscode.ConfigurationTarget.Workspace );
        }
        else
        {
            vscode.window.showInformationMessage( "Please open a file first" );
        }
    } ) );


    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.setConfigurationFileForWorkspace', function()
    {
        if( vscode.workspace.workspaceFolders )
        {
            var config = vscode.workspace.getConfiguration( 'format-modified' ).inspect( 'configurationFileMapping' ).globalValue;

            if( vscode.workspace.workspaceFolders.length > 1 )
            {
                vscode.window.showWorkspaceFolderPick().then( function( workspace )
                {
                    setConfigurationFile( "workspace", workspace.uri.fsPath + "/**/*", config, vscode.ConfigurationTarget.Global );
                } );
            }
            else
            {
                setConfigurationFile( "workspace", vscode.workspace.workspaceFolders[ 0 ].uri.fsPath + "/**/*", config, vscode.ConfigurationTarget.Global );
            }
        }
        else
        {
            vscode.window.showInformationMessage( "Please open a workspace first" );
        }
    } ) );

    context.subscriptions.push( vscode.window.onDidChangeActiveTextEditor( updateStatusBar ) );

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
            else if(
                e.affectsConfiguration( "format-modified.showCurrentConfigurationFileInStatusBar" ) ||
                e.affectsConfiguration( "format-modified.languages" ) ||
                e.affectsConfiguration( "format-modified.configurationFileMapping" ) ||
                e.affectsConfiguration( "format-modified.alternativeConfigurationFiles" )
            )
            {
                updateStatusBar();
            }
        }
    } ) );

    resetOutputChannel();
    register();
    updateStatusBar();
}

exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;

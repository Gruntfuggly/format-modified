
var fs = require( 'fs' );
var path = require( 'path' );
var crypto = require( 'crypto' );
var vscode = require( 'vscode' );
var micromatch = require( 'micromatch' );
var diffs = require( './diffs.js' );

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
        formatContext.customFormatFilePath = undefined;

        var config = vscode.workspace.getConfiguration( 'format-modified' ).customConfiguration;
        if( document && document.uri && document.uri.scheme === 'file' )
        {
            Object.keys( config ).map( function( glob )
            {
                if( config.hasOwnProperty( glob ) )
                {
                    if( micromatch.isMatch( document.fileName, glob ) )
                    {
                        formatContext.customFormatFilePath = config[ glob ];

                        debug( "Using custom configuration " + formatContext.customFormatFilePath );

                        if( fs.existsSync( formatContext.formatFilePath ) )
                        {
                            debug( "Preserving current .clang-format" );
                            formatContext.backupFormatFilePath = formatFilePath + '.' + crypto.randomBytes( 4 ).readUInt32LE();
                            fs.renameSync( formatContext.formatFilePath, formatContext.backupFormatFilePath );
                        }

                        fs.copyFileSync( formatContext.customFormatFilePath, formatContext.formatFilePath );
                    }
                }
            } );
        };
    }

    function format( document, tidy )
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
            else if( formatContext.customFormatFilePath )
            {
                debug( "Removing custom .clang-format" );
                fs.unlinkSync( formatContext.formatFilePath );
            }
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
                updateContext( document );
                var result = diffs.fetch( document, options, context.globalStoragePath, tidy );
                return result;
            }
            else
            {
                updateContext( vscode.window.activeTextEditor.document );
                var previousPosition = vscode.window.activeTextEditor.selection.active;

                diffs.fetch( vscode.window.activeTextEditor.document, options, context.globalStoragePath, tidy ).then( function( edits )
                {
                    var workspaceEdit = new vscode.WorkspaceEdit();
                    workspaceEdit.set( vscode.window.activeTextEditor.document.uri, edits );

                    vscode.workspace.applyEdit( workspaceEdit ).then( function()
                    {
                        debug( "Restoring previous cursor position" );
                        vscode.window.activeTextEditor.selection = new vscode.Selection( previousPosition, previousPosition );
                        debug( "OK" );
                    } );
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

                var edits = format( document );
                return edits;
            }
        } );

        context.subscriptions.push( provider );
    }

    resetOutputChannel();
    register();

    context.subscriptions.push( vscode.commands.registerCommand( 'format-modified.format', format ) );

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

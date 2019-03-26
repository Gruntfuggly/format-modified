
var fs = require( 'fs' );
var vscode = require( 'vscode' );
var diffs = require( './diffs.js' );
var formatter = require( './formatter.js' );

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

    function format( document )
    {
        var options = { outputChannel: outputChannel };
        try
        {
            if( !fs.existsSync( context.globalStoragePath ) )
            {
                fs.mkdirSync( context.globalStoragePath );
            }

            return diffs.fetch( document, options, context.globalStoragePath );
        }
        catch( e )
        {
            console.log( e );
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

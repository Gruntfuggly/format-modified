# Format Modified

Formats modified sections of code on save. This is useful where you have a legacy codebase where you want to only format code changes and new code.

Requires git and clang-format. The location of the clang-format executable will be determined from `format-modified.executable`, `clang-format.executable` or `C_Cpp.clang_format_path`. If none of these is defined, it will assume clang-format is available in your normal path. Alternatively, you can specify the location of the executable in the settings.

Glob patterns can also be used to specify alternative clang-format configuration files. This allows you got further tailor the formatting of legacy code, where some files may need to adhere to different standards, for example. This works by temporarily copying an alternative configuration file into the folder containing the file to format, and renaming it to `.clang-format`. If there is already a `.clang-format` in the folder, it will be moved out of the way while the alternative file is used.

*Note: Determining the modified sections may take longer than a simple format, so you may mind that no formatting appears to happen. If this is the case, you should try increasing your `editor.formatOnSaveTimeout` setting. The extension will try to detect this automatically and prompt if required. You can also enable the debug log (see* `format-modified.debug` *below) to see how long the format is taking.*

## Commands

Normally the extension will work as a standard formatter for the file types configured in `format-modified.languages`. Formatting can also be applied manually by using the command **Format Modified Sections**.

The command **Set Configuration File For Workspace** can be used to set an alternative configuration file for the current workspace. This will show a list of configurations files (which can be set in the settings).

Similarly, the command **Set Configuration File For This File** can be used to set an alternative configuration file for the current file in the editor.

The command **Format Whole Document** can be used to force the whole document to be formatted with the appropriate configuration file. Likewise, **Format Selection** will format the current selection.

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.format-modified).

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/format-modified).

## Configuration

`format-modified.debug`

Enable this to create an output channel showing information for debugging purposes. To open the output channel, select **Output** from the **View** menu and then choose **Format Modified** from the drop down.

`format-modified.executable`

The extension will try and find the `clang-format` executable on it's own. Use this to specify it's location if you need to.

`format-modified.languages`

Use this to control which files are formatted. It is set to `["cpp"]` by default, so .cpp and .h files are formatted. Use *F1* -> *Change Language Mode* to show a list of language identifiers. Java, Javascript, Objective-C, Proto are supported by clang-format, but I have not tested them.

`format-modified.configurationFileMapping`

By default, clang-format will look for a configuration file (`.clang-format`) in the folder containing the file to be formatted. If no configuration file is found, it will look in the parent folder, and so forth. This can be overridden and specific configuration files can be used by defining glob patterns. For example, to set different configurations to format C++ header and body files, use something like:

```json
"format-modified.configurationFileMapping":
{
    "**/*.h": "/home/user/clang-configuration-files/.clang-format.cpp-headers"
    "**/*.cpp": "/home/user/clang-configuration-files/.clang-format.cpp-body"
}
```

`format-modified.alternativeConfigurationFiles`

To make it quicker to associate individual files with specific clang-format configuration files, you can add then to this list. You can then use the command **Format Modified: Set Configuration File** to select a configuration file from the list which will be used for the current file (*see Notes below*).

`format-modified.formatWholeDocument`

Override the default behaviour of only formatting modified parts of the file. This allows the extension to be used as a standard formatter using clang format, but allows the alternative configuration files to be used.

`format-modified.showCurrentConfigurationFileInStatusBar`

Normally the configuration file that will be used for the current file is shown in the status bar. If you want to hide it, set this to false. *Note: You can also right click on it to hide it, but you'll have to do it in every window.*

`format-modified.formatWholeDocumentOnFailure`

When the diffs for the file can't be generated (if the file is not tracked in git, for example) the default behaviour is to format the whole file (if possible). Set this to false if you want the file to remain unchanged.

### Notes

Using the **Format Modified: Set Configuration File** will update `format-modified.configurationFileMapping` in your *Workspace settings*. Globs which match multiple files should be defined in your *User settings*.

When looking for alternative configurations, the combined settings are searched for an exact filename match first. If no exact match is found, the filename is matched against the globs.

You can organise the settings as you wish, but the **Format Modified: Set Configuration File** will always attempt to update the *Workspace Settings*.

## Known issues

clang-format sometimes insists on formatting the line after any specified ranges of lines, even if only a single line is specified.

## Credits

Icons made by [Vaadin](https://www.flaticon.com/authors/vaadin) from [www.flaticon.com](https://www.flaticon.com/), licensed by [CC 3.0BY](http://creativecommons.org/licenses/by/3.0/).

Icons made by [Dave Gandy](https://www.flaticon.com/authors/dave-gandy) from [www.flaticon.com](https://www.flaticon.com/), licensed by [CC 3.0BY](http://creativecommons.org/licenses/by/3.0/).

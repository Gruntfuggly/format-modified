# Format Modified

Formats modified sections of code on save. This is useful where you have a legacy codebase where you want to only format code changes and new code.

Requires git and clang-format. The location of the clang-format executable will be determined from `clang-format.executable` or `C_Cpp.clang_format_path`. If neither of these is defined, it will assume clang-format is available in your normal path.

*TODO: Register as a proper formatter.*

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.format-modified).

Alternatively, open Visual Studio code, press `Ctrl+P` or `Cmd+P` and type:

    > ext install format-modified

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/format-modified).

## Configuration

`format-modified.debug`

Enable this to create an output channel showing information for debugging purposes.

`format-modified.executable`

The extension will try and find the `clang-format` executable on it's own. Use this to specify it's location if you need to.

`format-modified.globs`

Use this to control which files are formatted. By default, .cpp and .h files are formatted. If no globs are defined, all files will be formatted.

# Known issues

clang-format insists on formatting the line after any specified ranges of lines, even if only a single line is specified.

# Credits

<div>Icons made by <a href="https://www.flaticon.com/authors/vaadin" title="Vaadin">Vaadin</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>

<div>Icons made by <a href="https://www.flaticon.com/authors/dave-gandy" title="Dave Gandy">Dave Gandy</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
# v0.0.17 - 2019-10-07
- Fix configuration file check
- Improve handling of alternative configuration files

# v0.0.16 - 2019-10-07
- Stop searching for alternative configuration files when first glob matched

# v0.0.15 - 2019-10-05
- Use alternative configuration files in a much more sensible way
- Add job number to debug output

# v0.0.14 - 2019-10-04
- Don't check configuration file exists when user selects 'none'

# v0.0.13 - 2019-10-03
- Improve tidying up after formatting
- Prompt user to increase save abort timeout if formatting takes too long

# v0.0.12 - 2019-10-01
- Add option for format whole file
- Allow use of local .clang-format files
- Allow use of alternative .clang-format files by matching glob patterns

# v0.0.11 - 2019-04-26
- Fix format from command prompt

# v0.0.10 - 2019-04-11
- Inhibit exception generated if file is not in a git repo

# v0.0.9 - 2019-04-11
- Inhibit exception generated if temp file does not exist

# v0.0.8 - 2019-04-09
- Simplify file name handling
- Extend debug logging

# v0.0.7 - 2019-03-27
- Reinstate formatting for the whole document if it is not in git

# v0.0.6 - 2019-03-26
- Ensure that the correct version is compared with the latest committed file
- Write the document to a temporary file first
- No longer formats the whole document if there are no changes

# v0.0.5 - 2019-03-21
- Rewrite as a document formatter

# v0.0.4 - 2019-03-07
- Handle files which are not in git (formats the whole file)
- Add support for debug output channel

# v0.0.3 - 2018-06-28
- Add Formatters category to package.json

# v0.0.2 - 2018-06-27
- Make it work for Windows

# v0.0.1 - 2018-06-27
- Initial version

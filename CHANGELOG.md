# Format Modified Change Log

## v0.0.30 - 2020-05-20

- Improve check for files with conflicts

## v0.0.29 - 2020-05-17

- Add option to disable formatting whole document on failure

## v0.0.28 - 2020-05-11

- Force diffs to be generated without external diff tool

## v0.0.27 - 2020-04-29

- Handle files with merge conflicts in a more friendly way

## v0.0.26 - 2020-03-26

- Fix README.md
- Fix logging
- Fix menu handling

## v0.0.25 - 2020-02-21

- Add current configuration file indicator to status bar

## v0.0.24 - 2020-02-21

- Handle 'format inhibited' better

## v0.0.23 - 2020-02-20

- Fix markdown lint errors in CHANGELOG.md and README.md
- Add option to format selecion(s)
- Handle errors better

## v0.0.22 - 2019-11-22

- Add support for adding alternative configurations for workspaces via the GUI

## v0.0.21 - 2019-10-17

- Add support for tilde(~) and '${homedir}' in alternative configuration filenames
- Improve error handling when setting alternative configuration files
- Improve finding of clang-format executable

## v0.0.20 - 2019-10-16

- Warn if configuration file is not found when formatting
- Tweak setting of range ends

## v0.0.19 - 2019-10-10

- Add support for inhibiting formatting for specific files
- Add command to force formatting of whole document
- Fix whole document formatting

## v0.0.18 - 2019-10-09

- Remove redundant 'Ignore' button from timeout popup

## v0.0.17 - 2019-10-07

- Fix configuration file check
- Improve handling of alternative configuration files

## v0.0.16 - 2019-10-07

- Stop searching for alternative configuration files when first glob matched

## v0.0.15 - 2019-10-05

- Use alternative configuration files in a much more sensible way
- Add job number to debug output

## v0.0.14 - 2019-10-04

- Don't check configuration file exists when user selects 'none'

## v0.0.13 - 2019-10-03

- Improve tidying up after formatting
- Prompt user to increase save abort timeout if formatting takes too long

## v0.0.12 - 2019-10-01

- Add option for format whole file
- Allow use of local .clang-format files
- Allow use of alternative .clang-format files by matching glob patterns

## v0.0.11 - 2019-04-26

- Fix format from command prompt

## v0.0.10 - 2019-04-11

- Inhibit exception generated if file is not in a git repo

## v0.0.9 - 2019-04-11

- Inhibit exception generated if temp file does not exist

## v0.0.8 - 2019-04-09

- Simplify file name handling
- Extend debug logging

## v0.0.7 - 2019-03-27

- Reinstate formatting for the whole document if it is not in git

## v0.0.6 - 2019-03-26

- Ensure that the correct version is compared with the latest committed file
- Write the document to a temporary file first
- No longer formats the whole document if there are no changes

## v0.0.5 - 2019-03-21

- Rewrite as a document formatter

## v0.0.4 - 2019-03-07

- Handle files which are not in git (formats the whole file)
- Add support for debug output channel

## v0.0.3 - 2018-06-28

- Add Formatters category to package.json

## v0.0.2 - 2018-06-27

- Make it work for Windows

## v0.0.1 - 2018-06-27

- Initial version

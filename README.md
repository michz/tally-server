# Tally Server

This is a small Node JS application that:

* connects to a
[Blackmagic ATEM Mini](https://www.blackmagicdesign.com/de/products/atemmini)
video switcher.

* Runs an MQTT broker
* Emits MQTT messages for each channel/effects change of the video mixer
* Serves a very simple status webpage


## Running executables

For all operating systems:

* Download the binary for your system from the GitHub releases page.
* Create a config file in the same directory, called `config.yml`.
  For an example, see `config.yml` in this repository.

### Windows

Simply execute the exe file.

### Linux

* Open terminal, go to (`cd`) the directory where you put the executable.
* `chmod +x tally-server-linux`
* Execute via `./tally-server-linux`

### MacOS

* Open terminal, go to (`cd`) the directory where you put the executable.
* `chmod +x tally-server-macos`
* Execute via `./tally-server-macos`
* Confirm all warnings about unverified source/developer


## Development

For easier module development, start with:

```
rm -rf core/node_modules cli/node_modules native-ui/node_modules
cd core
yarn link
cd ../cli
yarn link tally-server-core
cd ../native-ui
yarn link tally-server-core
```

## Node

Node Version: see `.nvmrc`

Type `nvm use` to initialize `nvm` correctly.


## Packing Executables

```
./node_modules/.bin/pkg .
```

Remember to also ship `config.yml` configuration file!


## License

MIT

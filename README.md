# Tally Server

This is a small Node JS application that:

* connects to a
[Blackmagic ATEM Mini](https://www.blackmagicdesign.com/de/products/atemmini)
video switcher.

* Runs an MQTT broker
* Emits MQTT messages for each channel/effects change of the video mixer
* Serves a very simple status webpage

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

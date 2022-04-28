'use strict';

const fs = require('fs')
const os = require('os')
const path = require("path")
const YAML = require('yaml')

const AtemClient = require("./AtemClient")
const ControlServer = require("./ControlServer")
const MdnsClient = require("./MdnsClient")
const MqttBroker = require("./MqttBroker")
const MqttClient = require("./MqttClient")
const X32Client = require("./X32Client")
const Log = require("./Log")
const LogToCallbackTransport = require('./LogToCallbackTransport')
const ObjectMerger = require('./ObjectMerger')

const configFilePath = './config.yml'

module.exports = class App {
    constructor() {
        this.logToCallbackTransport = new LogToCallbackTransport();
        const log = new Log(this.logToCallbackTransport)

        this.logger = log.getLogger()
        this.config = {}
    }

    getLogger() {
        return this.logger
    }

    static getVersion() {
        const packageJson = require('./package.json')
        return packageJson["version"]
    }

    getControlUiUrls() {
        // List other local IP addresses on console
        const nets = os.networkInterfaces()
        const results = []

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4') {
                    results.push("http://" + net.address + ":" + this.config['control']['httpPort'] + "/")
                } else if (net.family === 'IPv6') {
                    results.push("http://[" + net.address + "]:" + this.config['control']['httpPort'] + "/")
                }
            }
        }

        return results;

    }

    openControlUiWithXdgOpen() {
        const urls = this.getControlUiUrls();

        const open = require('open');
        const { apps } = require('open');
        open(urls[0])
    }

    readConfiguration(path) {
        const configFileContents = fs.readFileSync(path, 'utf8')
        const config = YAML.parse(configFileContents)
        return config
    }

    saveConfiguration(config, path) {
        fs.writeFileSync(path, YAML.stringify(config), { encoding: "utf8" });
    }


    run() {
        // Save configuration method
        this.config = this.readConfiguration(configFilePath)
        this.logger.info('Config: ' + JSON.stringify(this.config, null, 2));

        // mDNS Client/Server
        const mdnsClient = new MdnsClient(this.logger)

        // MQTT Broker
        const mqttBroker = new MqttBroker(
            this.logger,
            parseInt(this.config['mqtt']['broker']['port'], 10)
        )
        mqttBroker.run()

        // X32 Client
        if (!("host" in this.config['x32']) || !("tally_mapping" in this.config['x32'])) {
            console.log("X32 config is missing `host` or `tally_mapping` parameter")
            process.exit(2)
        }
        const x32Client = new X32Client(this.logger, this.config['x32']['host'])
        x32Client.run()

        // Control Web Server
        const controlServer = new ControlServer(
            this.logger,
            parseInt(this.config['control']['httpPort'], 10),
            parseInt(this.config['control']['websocketPort'], 10)
        )

        // MQTT client
        const mqttClient = new MqttClient(
            this.logger,
            this.config['mqtt']['broker']['port'],
            this.config['mqtt']['clientOptions'],
            (topic, payload) => {
                const onlineRE = /tally\/(\d+)\/online/
                const talkbackRE = /tally\/(\d+)\/talkback/
                const hostnameRE = /tally\/(\d+)\/hostname/
                const onlineMatches = topic.match(onlineRE)
                const talkbackMatches = topic.match(talkbackRE)
                const hostnameMatches = topic.match(hostnameRE)
                if (onlineMatches !== null && onlineMatches.length > 0) {
                    controlServer.sendToWebsocketClients({
                        type: 'online',
                        data: {
                            channel: onlineMatches[1],
                            state: (payload === "0") ? "offline" : "online",
                        },
                    })
                } else if (talkbackMatches !== null && talkbackMatches.length > 0) {
                    const tally = talkbackMatches[1]
                    const muteState = (payload === "0")

                    // First inform X32
                    if (tally in this.config['x32']['tally_mapping']) {
                        x32Client.setChannelMute(
                            this.config['x32']['tally_mapping'][tally],
                            muteState
                        )
                    } else {
                        this.logger.error(`Got Talkback command from Tally (${tally}) that is not in config (see x32.tally_mapping)`)
                    }

                    // Then inform Websocket clients (Control UI)
                    controlServer.sendToWebsocketClients({
                        type: 'talkback',
                        data: {
                            channel: tally,
                            state: !muteState,
                        },
                    })
                } else if (hostnameMatches !== null && hostnameMatches.length > 0) {
                    const tally = hostnameMatches[1]
                    const hostname = String(payload)

                    // Then inform Websocket clients (Control UI)
                    controlServer.sendToWebsocketClients({
                        type: 'tallyHostname',
                        data: {
                            channel: tally,
                            hostname: hostname,
                        },
                    })
                }
            }
        )

        // ATEM
        const atemClient = new AtemClient(
            this.logger,
            this.config['atem']['host'] || '',
            (channel, state) => {
                mqttClient.publish(
                    this.config['mqtt']['topics']['tally']['state'].format(channel),
                    state,
                    true
                )
                controlServer.sendToWebsocketClients({
                    type: 'channel',
                    data: {
                        channel: channel,
                        state: state,
                    },
                })
            },
            this.config['atem']['debug'],
            this.config['atem']['use_mdns'],
            this.config['atem']['mdns_name'],
            mdnsClient
        )
        atemClient.run()


        this.logToCallbackTransport.addCallback((info) => {
            controlServer.sendToWebsocketClients({
                type: "log",
                data: {
                    msg: info["timestamp"] + " [" + info["level"] + "] " + info["message"],
                },
            })
        })

        const sendSettingsToWebsocketClients = () => {
            controlServer.sendToWebsocketClients({
                type: "settings",
                data: this.config,
            })
        }

        const sendUrlsToWebsocketClients = () => {
            controlServer.sendToWebsocketClients({
                type: "remoteUrls",
                data: { urls: this.getControlUiUrls() },
            })
        }

        // Additional Wiring
        // On initial connection, send current state to client
        controlServer.setWebsocketClientConnectedCallback((connection) => {
            for (const message of mqttBroker.getBroker().persistence._retained) {
                const reOnline = /tally\/(\d+)\/online/
                let matches = message["topic"].match(reOnline)
                if (matches !== null && matches.length > 0) {
                    const payload = message.payload.toString('utf-8')
                    controlServer.sendToWebsocketClients({
                        type: 'online',
                        data: {
                            channel: matches[1],
                            state: (payload === "0") ? "offline" : "online",
                        },
                    })
                }

                const reState = /tally\/(\d+)\/state/
                matches = message["topic"].match(reState)
                if (matches !== null && matches.length > 0) {
                    const payload = message.payload.toString('utf-8')
                    controlServer.sendToWebsocketClients({
                        type: 'channel',
                        data: {
                            channel: matches[1],
                            state: payload,
                        },
                    })
                }

                const reHostname = /tally\/(\d+)\/hostname/
                matches = message["topic"].match(reHostname)
                if (matches !== null && matches.length > 0) {
                    const payload = message.payload.toString('utf-8')
                    controlServer.sendToWebsocketClients({
                        type: 'tallyHostname',
                        data: {
                            channel: matches[1],
                            hostname: payload,
                        },
                    })
                }
            }

            for (const tally of Object.keys(this.config['x32']['tally_mapping'])) {
                controlServer.sendToWebsocketClients({
                    type: 'talkbackChannel',
                    data: {
                        channel: tally,
                        talkbackChannel: this.config['x32']['tally_mapping'][tally],
                    },
                })
            }
        })
        // Websocket client (aka browser) sent a message (command, config change, ...)
        controlServer.setWebsocketClientSentMessageCallback((message) => {
            if (message.type === 'changeIntercomChannel') {
                const tally = message.data.channel
                const intercomChannel = parseInt(message.data.intercomChannel)
                if (!tally) {
                    this.logger.error('Malformed changeIntercomChannel command received: ' + JSON.stringify(message))
                    return
                }

                // Backup config
                this.saveConfiguration(this.config, configFilePath + '.bak')

                if (intercomChannel) {
                    this.config['x32']['tally_mapping'][tally] = intercomChannel
                } else {
                    delete(this.config['x32']['tally_mapping'][tally])
                }

                // Save changed config
                this.saveConfiguration(this.config, configFilePath)

                // Send change to websocket clients
                controlServer.sendToWebsocketClients({
                    type: 'talkbackChannel',
                    data: {
                        channel: tally,
                        talkbackChannel: intercomChannel,
                    },
                })
            } else if (message.type === 'changeSettings') {
                // Backup config
                this.saveConfiguration(this.config, configFilePath + '.bak')

                // Merge existing config and new config
                ObjectMerger(this.config, message.data)

                // Save changed config
                this.saveConfiguration(this.config, configFilePath)

                // Inform clients about new config
                sendSettingsToWebsocketClients();
            } else if (message.type === 'getSettings') {
                // Inform clients about config
                sendSettingsToWebsocketClients();
            } else if (message.type === 'getRemoteUrls') {
                // Inform clients about config
                sendUrlsToWebsocketClients();
            }
        })

        // Run Control Webserver
        controlServer.run()
    }
}

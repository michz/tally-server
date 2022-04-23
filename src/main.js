'use strict';

const fs = require('fs')
const os = require('os')
const path = require("path")
const YAML = require('yaml')

const configFilePath = './config.yml'

if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log("No command line parameters available.")
    console.log("Please provide a config file at current working directory.")
    console.log("")
    console.log("Parameters:")
    console.log("-e\tOutput an example config file")
    console.log("-h\tOutput this help/usage text")
    console.log("-v\tOutput version")
    process.exit(0)
} else if (process.argv.includes("-v") || process.argv.includes("--version")) {
    fs.readFile(path.join(__dirname, "../package.json"), "binary", (err, file) => {
        if (err) {
            console.log("Could not read package.json file.")
            process.exit(1)
        }

        const packageJson = JSON.parse(file)
        console.log(packageJson["version"])
        process.exit(0)
    });
} else if (process.argv.includes("-e")) {
    fs.readFile(path.join(__dirname, "../config.yml"), "binary", (err, file) => {
        if (err) {
            console.log("Could not read example config file.")
            process.exit(1)
        }

        console.log(file)
        process.exit(0)
    });
} else {
    const AtemClient = require("./AtemClient.js")
    const ControlServer = require("./ControlServer.js")
    const MdnsClient = require("./MdnsClient.js")
    const MqttBroker = require("./MqttBroker.js")
    const MqttClient = require("./MqttClient.js")
    const X32Client = require("./X32Client.js")
    const Log = require("./Log.js")
    const LogToCallbackTransport = require('./LogToCallbackTransport.js')

    const logToCallbackTransport = new LogToCallbackTransport();
    const log = new Log(logToCallbackTransport)
    const logger = log.getLogger()

    // Load configuration
    const file = fs.readFileSync(configFilePath, 'utf8')
    const config = YAML.parse(file)
    logger.info('Config: ' + JSON.stringify(config, null, 2));

    // Save configuration method
    const saveConfiguration = function (config, path) {
        fs.writeFileSync(path, YAML.stringify(config), { encoding: "utf8" });
    }

    // mDNS Client/Server
    const mdnsClient = new MdnsClient(logger)

    // MQTT Broker
    const mqttBroker = new MqttBroker(
        logger,
        parseInt(config['mqtt']['broker']['port'], 10)
    )
    mqttBroker.run()

    // X32 Client
    if (!("host" in config['x32']) || !("tally_mapping" in config['x32'])) {
        console.log("X32 config is missing `host` or `tally_mapping` parameter")
        process.exit(2)
    }
    const x32Client = new X32Client(logger, config['x32']['host'])
    x32Client.run()

    // Control Web Server
    const controlServer = new ControlServer(
        logger,
        parseInt(config['control']['httpPort'], 10),
        parseInt(config['control']['websocketPort'], 10)
    )

    // MQTT client
    const mqttClient = new MqttClient(
        logger,
        config['mqtt']['broker']['port'],
        config['mqtt']['clientOptions'],
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
                if (tally in config['x32']['tally_mapping']) {
                    x32Client.setChannelMute(
                        config['x32']['tally_mapping'][tally],
                        muteState
                    )
                } else {
                    logger.error(`Got Talkback command from Tally (${tally}) that is not in config (see x32.tally_mapping)`)
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
        logger,
        config['atem']['host'] || '',
        (channel, state) => {
            mqttClient.publish(
                config['mqtt']['topics']['tally']['state'].format(channel),
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
        config['atem']['debug'],
        config['atem']['use_mdns'],
        config['atem']['mdns_name'],
        mdnsClient
    )
    atemClient.run()


    logToCallbackTransport.addCallback((info) => {
        controlServer.sendToWebsocketClients({
            type: "log",
            data: {
                msg: info["timestamp"] + " [" + info["level"] + "] " + info["message"],
            },
        })
    })

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

        for (const tally of Object.keys(config['x32']['tally_mapping'])) {
            controlServer.sendToWebsocketClients({
                type: 'talkbackChannel',
                data: {
                    channel: tally,
                    talkbackChannel: config['x32']['tally_mapping'][tally],
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
                logger.error('Malformed changeIntercomChannel command received: ' + JSON.stringify(message))
                return
            }

            // Backup config
            saveConfiguration(config, configFilePath + '.bak')

            if (intercomChannel) {
                config['x32']['tally_mapping'][tally] = intercomChannel
            } else {
                delete(config['x32']['tally_mapping'][tally])
            }

            // Save changed config
            saveConfiguration(config, configFilePath)

            // Send change to websocket clients
            controlServer.sendToWebsocketClients({
                type: 'talkbackChannel',
                data: {
                    channel: tally,
                    talkbackChannel: intercomChannel,
                },
            })
        }
    })


    // Run Control Webserver
    controlServer.run()

    logger.info("Control UI available at:")

    // List other local IP addresses on console
    const nets = os.networkInterfaces();
    const results = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4') {
                logger.info("http://" + net.address + ":" + config['control']['httpPort'] + "/")
            } else if (net.family === 'IPv6') {
                logger.info("http://[" + net.address + "]:" + config['control']['httpPort'] + "/")
            }
        }
    }

    const open = require('open');
    const { apps } = require('open');
    open('http://127.0.0.1:' + config['control']['httpPort'])

}

'use strict';

const fs = require('fs')
const os = require('os')
const YAML = require('yaml')

const AtemClient = require("./AtemClient.js")
const ControlServer = require("./ControlServer.js")
const MdnsClient = require("./MdnsClient.js")
const MqttBroker = require("./MqttBroker.js")
const MqttClient = require("./MqttClient.js")
const Log = require("./Log.js")
const LogToCallbackTransport = require('./LogToCallbackTransport.js')

const logToCallbackTransport = new LogToCallbackTransport();
const log = new Log(logToCallbackTransport)
const logger = log.getLogger()

// Load configuration
const file = fs.readFileSync('./config.yml', 'utf8')
const config = YAML.parse(file)
logger.info('Config: ' + JSON.stringify(config, null, 2));


// mDNS Client/Server
const mdnsClient = new MdnsClient(logger)

// MQTT Broker
const mqttBroker = new MqttBroker(
    logger,
    parseInt(config['mqtt']['broker']['port'], 10)
)
mqttBroker.run()

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
        var re = /tally\/(\d+)\/online/
        var matches = topic.match(re)
        if (matches !== null && matches.length > 0) {
            controlServer.sendToWebsocketClients({
                type: 'online',
                data: {
                    channel: matches[1],
                    state: (payload === "0") ? "offline" : "online",
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
            state
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

// Run Control Webserver
controlServer.run()

logger.info("Control UI available at:")

// @TODO list other local IP addresses
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

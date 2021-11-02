const fs = require('fs')
const YAML = require('yaml')

const AtemClient = require("./AtemClient.js")
const ControlServer = require("./ControlServer.js")
const MqttBroker = require("./MqttBroker.js")
const MqttClient = require("./MqttClient.js")
const Log = require("./Log.js")

const log = new Log()
const logger = log.getLogger()

// Load configuration
const file = fs.readFileSync('./config.yml', 'utf8')
const config = YAML.parse(file)
logger.info('Config: ' + JSON.stringify(config, null, 2));


// @TODO mDNS

// MQTT Broker
mqttBroker = new MqttBroker(
    logger,
    parseInt(config['mqtt']['broker']['port'], 10)
)
mqttBroker.run()

// MQTT client
mqttClient = new MqttClient(
    logger,
    config['mqtt']['broker']['port'],
    config['mqtt']['clientOptions']
)

// ATEM
atemClient = new AtemClient(
    logger,
    config['atem']['host'],
    (channel, state) => {
        mqttClient.publish(
            config['mqtt']['topics']['tally']['state'].format(channel),
            state
        );
    },
    config['atem']['debug']
)
atemClient.run()

// Control Web Server
controlServer = new ControlServer(
    logger,
    parseInt(config['control']['port'], 10)
)
controlServer.run()

logger.info(`Webserver running at http://127.0.0.1:${controlServer.getPort()}`)
// @TODO list other local IP addresses

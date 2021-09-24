const fs = require('fs')
const YAML = require('yaml')
const winston = require('winston')
const mqtt = require('mqtt')
const { Atem } = require('atem-connection')

const file = fs.readFileSync('./config.yml', 'utf8')
const config = YAML.parse(file)

const mqttTopicTallyPreview = config['mqtt']['topics']['tally']['preview'];
const mqttTopicTallyProgram = config['mqtt']['topics']['tally']['program'];

let customLogFormat = winston.format.combine(
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}`,
    )
);

let customLogFormatColorized = winston.format.combine(
    customLogFormat,
    winston.format.colorize({
        all: true,
    }),
);


const logger = winston.createLogger({
    level: 'info',
    format: customLogFormat,
    transports: [
        new winston.transports.File({ filename: 'tally-server.log' }),
        new (winston.transports.Console)({
            format: customLogFormatColorized,
        })
    ],
});


// @TODO Config
const myAtem = new Atem({ debugBuffers: config['atem']['debug'] })
myAtem.on(
    'info',
    (msg) => {
        logger.log({
            level: 'info',
            message: '[ATEM] ' + msg,
        });
    }
);
myAtem.on(
    'error',
    (msg) => {
        logger.log({
            level: 'error',
            message: '[ATEM] ' + msg,
        });
    }
);

logger.info('Config: ' + JSON.stringify(config));

myAtem.connect(config['atem']['host'])

myAtem.on('connected', () => {
    /*
    myAtem.changeProgramInput(3).then(() => {
        // Fired once the atem has acknowledged the command
        // Note: the state likely hasnt updated yet, but will follow shortly
        console.log('Program input set')
    })
    */
    logger.info("[ATEM] Connected to ATEM Mixer");
    logger.info(myAtem.state);
})

myAtem.on('stateChanged', (state, pathToChange) => {
    // @TODO Check if Tally and send MQTT
    logger.info(state);
    logger.info(pathToChange);

    // Example:
    const newChannel = 1;
    mqttClient.publish(mqttTopicTallyPreview, newChannel.toString());
    mqttClient.publish(mqttTopicTallyProgram, newChannel.toString());
})

const mqttClient = mqtt.connect(
    'mqtt://' + config['mqtt']['broker']['host'] + ':' + config['mqtt']['broker']['port'],
    config['mqtt']['clientOptions']
)

mqttClient.on('connect', function () {
    logger.info("[MQTT] connected");
})
mqttClient.on('reconnect', function () {
    logger.info("[MQTT] reconnect");
})
mqttClient.on('error', function (err) {
    logger.error("[MQTT] " + err);
})

/*
mqttClient.on('message', function (topic, message) {
    // @TODO
    // message is Buffer
    console.log(message.toString())
    mqttClient.end()
})
*/

logger.info("Initialized.");

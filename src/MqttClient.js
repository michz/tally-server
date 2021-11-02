const mqtt = require('mqtt')

module.exports = class MqttClient {
    constructor(logger, port, clientOptions) {
        this.mqttClient = mqtt.connect(
            'mqtt://127.0.0.1:' + port,
            clientOptions
        )

        this.mqttClient.on('connect', function () {
            logger.info("[MQTT] connected");
        })
        this.mqttClient.on('reconnect', function () {
            logger.info("[MQTT] reconnect");
        })
        this.mqttClient.on('error', function (err) {
            logger.error("[MQTT] " + err);
        })
    }

    publish(topic, msg, retain = true) {
        this.mqttClient.publish(topic, msg, {retain: retain});
    }
}

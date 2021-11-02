const mqtt = require('mqtt')

module.exports = class MqttClient {
    constructor(logger, port, clientOptions, messageCallback) {
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
        this.mqttClient.on('message', function (topic, payload) {
            //logger.info("[MQTT] Received: " + topic + " " + payload);
            messageCallback(topic, payload.toString('utf-8'))
        })

        this.mqttClient.subscribe('tally/#')
    }

    publish(topic, msg, retain = true) {
        this.mqttClient.publish(topic, msg, {retain: retain});
    }
}

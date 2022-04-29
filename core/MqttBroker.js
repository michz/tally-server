const aedes = require('aedes')({
    heartbeatInterval: 10000,
    connectTimeout: 3000,
})

const aedes_persistence = require('aedes-persistence')


module.exports = class MqttBroker {
    constructor(logger, port) {
        this.logger = logger;
        this.port = port;
        this.server = require('net').createServer(aedes.handle)
    }

    run() {
        this.server.listen(this.port, () => {
            this.logger.info('[MQTT] server started and listening on port ' + this.port)
        })
    }

    getPort() {
        return this.port
    }

    getBroker() {
        return aedes
    }
}

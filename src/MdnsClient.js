const MulticastDNS = require('multicast-dns')
const os = require('os')

const mdns_service = '_tally_mqtt'

module.exports = class MdnsClient {
    constructor(logger) {
        this.mdns = MulticastDNS({
            reuseAddr: true
        })
        this.queryCallback = null;

        //this.mdns.on('response', function(response) {
        //    console.log('got a response packet:', response)
        //})

        const that = this;

        this.mdns.on('query', (query, rinfo) => {
            let hostname = os.hostname()

            // Strip '.local' from hostname, if it is already there.
            // (Confuses some clients...)
            if (hostname.endsWith('.local')) {
                hostname = hostname.substr(0, hostname.length - 6)
            }

            const hostnameLocal = hostname + '.local'
            const fullServiceHostname = hostname + '.' + mdns_service + '._tcp.local'
            const serviceName = 'Tally MQTT on ' + fullServiceHostname

            for (const question of query['questions']) {
                if (question['class'] === 'IN' && question['type'] === 'PTR' && question['name'] === mdns_service + '._tcp.local') {
                    logger.info('[mDNS] Answering for Tally MQTT...')
                    logger.info('[mDNS] Query was: ' + JSON.stringify(question))
                    this.mdns.respond({
                        answers: [
                            {
                                name: mdns_service + '._tcp.local',
                                type: 'PTR',
                                data: serviceName,
                                ttl: 300,
                            }, {
                                name: serviceName,
                                type: 'TXT',
                                ttl: 300,
                                data: 'info=mqtt broker',
                            }, {
                                name: serviceName,
                                type: 'SRV',
                                ttl: 120,
                                data: {
                                    protocol: mdns_service,
                                    priority: 0,
                                    weight: 0,
                                    port: 1883,
                                    target: hostnameLocal,
                                    data: 'info=mqtt broker',
                                }
                            }, {
                                name: hostnameLocal,
                                type: 'A',
                                ttl: 120,
                                data: that.getMainIpAddress(),
                            }
                        ]
                    })
                }
            }
        })


        this.mdns.on('response', (response) => {
            if (this.queryCallback) {
                this.queryCallback(response)
            }
        })

        //// Example Query:
        //this.mdns.query({
        //    questions:[{
        //        name: 'brunhilde.local',
        //        type: 'A'
        //    }]
        //})
    }

    getMainIpAddress() {
        const nets = os.networkInterfaces();
        const results = [];

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    results.push(net.address);
                }
            }
        }

        if (results.length === 0) {
            throw 'Error: No IP address found.';
        }

        return results[0];
    }

    query(query, callback) {
        this.queryCallback = callback
        this.mdns.query({questions: [query]})
    }

    deregisterQueryCallback() {
        this.queryCallback = null;
    }
}

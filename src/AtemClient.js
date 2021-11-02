const { Atem, AtemConnectionStatus } = require('atem-connection')

const codeTallyOff = 'off'
const codeTallyPreview = 'prv'
const codeTallyProgram = 'pgm'

module.exports = class AtemClient {
    constructor(logger, atemHost, mqttPublishCallback, debug, useMdns, mdnsName, mdnsClient) {
        this.logger = logger
        this.atemHost = atemHost
        this.mqttPublishCallback = mqttPublishCallback
        this.atem = new Atem({ debugBuffers: debug })
        this.useMdns = useMdns
        this.atemMdnsName = mdnsName
        this.mdnsClient = mdnsClient

        this.lastTallyChannels = {}

        this.atem.on(
            'connected',
            () => {
                this.logger.info("[ATEM] Connected to ATEM Mixer")
            }
        )
        this.atem.on(
            'info',
            (msg) => {
                this.logger.log({
                    level: 'info',
                    message: '[ATEM] ' + msg,
                })
            }
        )
        this.atem.on(
            'error',
            (msg) => {
                this.logger.log({
                    level: 'error',
                    message: '[ATEM] ' + msg,
                })
            }
        )
        this.atem.on(
            'stateChanged',
            (state, pathToChange) => {
                this.logger.debug(JSON.stringify(state.video.mixEffects))
                this.logger.info(pathToChange)

                const mixEffectsFilterRegex = new RegExp(".*video\.mixEffects.*", "g")
                if (!mixEffectsFilterRegex.test(pathToChange)) {
                    return
                }

                let currentChannels = {};

                state.video.mixEffects.forEach((effect) => {
                    // Program has highest priority, so always set.
                    if (effect.programInput) {
                        currentChannels[effect.programInput] = codeTallyProgram;
                    }

                    // Set Preview only if it is not yet set to Program
                    if (effect.previewInput && codeTallyProgram !== currentChannels[effect.previewInput]) {
                        // During a Transition, both are on Program
                        if (effect.transitionPosition && effect.transitionPosition.inTransition) {
                            currentChannels[effect.previewInput] = codeTallyProgram;
                        } else {
                            currentChannels[effect.previewInput] = codeTallyPreview;
                        }
                    }
                });

                Object.keys(this.lastTallyChannels).forEach((channel) => {
                    if (!(channel in currentChannels)) {
                        this.mqttPublishCallback(channel, codeTallyOff)
                    }
                });

                Object.keys(currentChannels).forEach((channel) => {
                    this.mqttPublishCallback(channel, currentChannels[channel])
                });

                this.lastTallyChannels = currentChannels;
            }
        )
    }

    async run() {
        /*
            CLOSED = 0,
            CONNECTING = 1,
            CONNECTED = 2
        */

        // This endless loop will continously check the connection state and try a reconnect.
        while (true) {
            if (this.atem.status == AtemConnectionStatus.CLOSED) {
                if (this.useMdns) {
                    // Try to discover Atem via mDNS
                    this.mdnsClient.query(
                        {
                            name: "_blackmagic._tcp.local",
                            type: "PTR",
                        },
                        (answer) => {
                            if ("answers" in answer && answer["answers"].length > 0 && answer["answers"][0]["type"] == "PTR" && answer["answers"][0]["data"] == this.atemMdnsName) {
                                if ("additionals" in answer == false) {
                                    return
                                }

                                for (const additional of answer["additionals"]) {
                                    if ("data" in additional && "type" in additional && additional["type"] == "A") {
                                        // Wohoo we found an ATEM!
                                        this.atemHost = additional["data"]
                                        this.mdnsClient.deregisterQueryCallback()
                                        this.logger.info("Found ATEM via mDNS: " + this.atemHost)
                                        return
                                    }
                                }
                            }
                        }
                    )
                }

                if (this.atemHost != "") {
                    this.logger.info("Try connecting to ATEM at " + this.atemHost)
                    this.atem.connect(this.atemHost)
                } else {
                    this.logger.warn("No ATEM found yet and none configured!")
                }
            };

            // This is a sleed() effectively
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // @TODO Try to fix the bug:
        //       If run, no fatal error messages are posted to console any more.
    }
}

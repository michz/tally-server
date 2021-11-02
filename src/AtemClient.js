const { Atem } = require('atem-connection')

const codeTallyOff = 'off';
const codeTallyPreview = 'prv';
const codeTallyProgram = 'pgm';

module.exports = class AtemClient {
    constructor(logger, atemHost, mqttPublishCallback, debug) {
        this.logger = logger
        this.atemHost = atemHost
        this.mqttPublishCallback = mqttPublishCallback
        this.atem = new Atem({ debugBuffers: debug })

        this.lastTallyChannels = {}

        this.atem.on(
            'connected',
            () => {
                this.logger.info("[ATEM] Connected to ATEM Mixer")
                this.logger.info(this.atem.state)
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
                state.logger.debug(JSON.stringify(state.video.mixEffects))
                state.logger.info(pathToChange)

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

    run() {
        this.atem.connect(this.atemHost)
    }
}

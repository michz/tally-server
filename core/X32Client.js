const M32Client = require('m32');

module.exports = class X32Client {
    constructor(logger, x32Host) {
        this.logger = logger
        this.x32Host = x32Host

        this.m32 = new M32Client(x32Host);
    }

    run() {
        this.m32.connect();

        // Not necessary for current use case
        //m32.startSubscription();    // Begins pulling live data from the M32
    }

    setChannelMute(channel, mute) {
        if (mute) {
            this.m32.muteChannel(channel)
        } else {
            this.m32.unmuteChannel(channel)
        }
    }
}

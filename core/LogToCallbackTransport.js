const Transport = require('winston-transport');

//
// Inherit from `winston-transport` so you can take advantage
// of the base functionality and `.exceptions.handle()`.
//
module.exports = class YourCustomTransport extends Transport {
    constructor(opts) {
        super(opts)

        this.callbacks = []
        //
        // Consume any custom options here. e.g.:
        // - Connection information for databases
        // - Authentication information for APIs (e.g. loggly, papertrail,
        //   logentries, etc.).
        //
    }

    log(info, callback) {
        for (const cb of this.callbacks) {
            cb(info)
        }

        setImmediate(() => {
            this.emit('logged', info);
        });

        // Perform the writing to the remote service
        callback();
    }

    addCallback(callback) {
        this.callbacks.push(callback)
    }
};

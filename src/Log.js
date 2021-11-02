const winston = require('winston')

module.exports = class Log {
    constructor() {
        const customLogFormat = winston.format.combine(
            winston.format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss",
            }),
            winston.format.printf(
                info => `${info.timestamp} ${info.level}: ${info.message}`,
            )
        );

        const customLogFormatColorized = winston.format.combine(
            customLogFormat,
            winston.format.colorize({
                all: true,
            }),
        );

        this.logger = winston.createLogger({
            level: 'info',
            format: customLogFormat,
            transports: [
                new winston.transports.File({ filename: 'tally-server.log' }),
                new (winston.transports.Console)({
                    format: customLogFormatColorized,
                })
            ],
        });
    }

    log(obj) {
        this.logger.log(obj)
    }

    info(msg) {
        this.logger.info(msg)
    }

    warn(msg) {
        this.logger.warn(msg)
    }

    error(msg) {
        this.logger.error(msg)
    }

    getLogger() {
        return this.logger;
    }
}

String.prototype.format = function() {
    let formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        const regexp = new RegExp('\\{'+i+'\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }

    return formatted;
};

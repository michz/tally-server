const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");

const webserverBasedir = process.cwd() + '/public';

module.exports = class ControlServer {
    constructor(logger, port) {
        this.logger = logger
        this.port = port
    }

    run() {
        http.createServer(function(request, response) {
            let uri = url.parse(request.url).pathname;
            let filename = path.join(webserverBasedir, uri);
            this.logger.info(filename);

            fs.exists(filename, function(exists) {
                if (!exists) {
                    response.writeHead(404, {"Content-Type": "text/plain"});
                    response.write("404 Not Found\n");
                    response.end();
                    return;
                }

                if (fs.statSync(filename).isDirectory()) {
                    filename += '/index.html';
                }

                fs.readFile(filename, "binary", function(err, file) {
                    if (err) {
                        response.writeHead(500, {"Content-Type": "text/plain"});
                        response.write(err + "\n");
                        response.end();
                        return;
                    }

                    response.writeHead(200);
                    response.write(file, "binary");
                    response.end();
                });
            });
        }).listen(this.port);
    }

    getPort() {
        return this.port;
    }
}

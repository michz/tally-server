const fs = require("fs")
const http = require("http")
const net = require('net')
const path = require("path")
const url = require("url")
const websocket = require("websocket")

const webserverBasedir = process.cwd() + '/public';

//path.join(__dirname, '/public/index.html')

module.exports = class ControlServer {
    constructor(logger, httpPort, websocketPort) {
        this.logger = logger
        this.httpPort = httpPort
        this.websocketPort = websocketPort
        this.websocketClients = []
    }

    run() {
        http.createServer((request, response) => {
            let uri = url.parse(request.url).pathname;
            let filename = path.join(webserverBasedir, uri);
            this.logger.info(filename);

            if (uri == '/') {
                fs.readFile(__dirname + "/public/index.html", "binary", function(err, file) {
                    response.writeHead(200, {"Content-Type": "text/html"});
                    response.write(file, "binary");
                    response.end();
                })
            } else if (uri == '/chota.css') {
                fs.readFile(__dirname + "/public/chota.css", "binary", function(err, file) {
                    response.writeHead(200, {"Content-Type": "text/css"});
                    response.write(file, "binary");
                    response.end();
                })
            } else if (uri == '/jquery-3.6.0.min.js') {
                fs.readFile(__dirname + "/public/jquery-3.6.0.min.js", "binary", function(err, file) {
                    response.writeHead(200, {"Content-Type": "text/javascript"});
                    response.write(file, "binary");
                    response.end();
                })
            }
            /*
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
            */
        }).listen(this.httpPort);
        this.logger.info(`Webserver running at http://127.0.0.1:${this.httpPort}`)


        const websocketHttpServer = http.createServer();
        const websocketServer = new websocket.server({
            httpServer: websocketHttpServer,
        });
        websocketServer.on('request', (request) => {
            const connection = request.accept(null, request.origin)
            this.websocketClients.push(connection)

            // @TODO Commands from client?
            //connection.on('message', (message) => {
            //    console.log('Received Message:', message.utf8Data);
            //    connection.sendUTF('Hi this is WebSocket server!');
            //});

            connection.on('close', (reasonCode, description) => {
                const idx = this.websocketClients.indexOf(connection)
                this.websocketClients.slice(idx, 1)
            })
        })
        websocketHttpServer.listen(this.websocketPort)
    }

    getHttpPort() {
        return this.httpPort;
    }

    getWebsocketPort() {
        return this.websocketPort;
    }

    sendToWebsocketClients(msg) {
        for (const client of this.websocketClients) {
            client.sendUTF(JSON.stringify(msg))
        }
    }
}

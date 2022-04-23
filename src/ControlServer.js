const fs = require("fs")
const http = require("http")
const net = require('net')
const path = require("path")
const url = require("url")
const websocket = require("websocket")

const webserverBasedir = __dirname + '/../public';

module.exports = class ControlServer {
    constructor(logger, httpPort, websocketPort) {
        this.logger = logger
        this.httpPort = httpPort
        this.websocketPort = websocketPort
        this.websocketClients = []
        this.websocketClientConnectedCallback = null
        this.websocketClientSentMessageCallback = null
    }

    run() {
        http.createServer((request, response) => {
            let uri = url.parse(request.url).pathname;
            if (uri.startsWith('/node_modules/')) {
                uri = '/..' + uri;
            }

            let filename = path.join(webserverBasedir, uri);

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

        }).listen(this.httpPort);
        this.logger.info(`Webserver running at http://127.0.0.1:${this.httpPort}`)

        const websocketHttpServer = http.createServer();
        const websocketServer = new websocket.server({
            httpServer: websocketHttpServer,
        });
        websocketServer.on('request', (request) => {
            const connection = request.accept(null, request.origin)
            this.websocketClients.push(connection)

            if (this.websocketClientConnectedCallback !== null) {
                this.websocketClientConnectedCallback(connection)
            }

            // @TODO Commands from client?
            //connection.on('message', (message) => {
            //    console.log('Received Message:', message.utf8Data);
            //    connection.sendUTF('Hi this is WebSocket server!');
            //});

            connection.on('close', (reasonCode, description) => {
                const idx = this.websocketClients.indexOf(connection)
                this.websocketClients.slice(idx, 1)
            })

            connection.on('message', (message) => {
                if (message.type === 'utf8') {
                    const data = JSON.parse(message.utf8Data);
                    if (!data) {
                        this.logger.error("Received unparsable message from websocket client: \n" + message.utf8Data);
                        return;
                    }

                    if (this.websocketClientSentMessageCallback !== null) {
                        this.websocketClientSentMessageCallback(data)
                    }
                }
                else if (message.type === 'binary') {
                    this.logger.error("Received binary message from websocket client. I am not able to handle this.");
                }
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

    setWebsocketClientConnectedCallback(callback) {
        this.websocketClientConnectedCallback = callback
    }

    setWebsocketClientSentMessageCallback(callback) {
        this.websocketClientSentMessageCallback = callback
    }
}

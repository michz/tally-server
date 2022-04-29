'use strict';

const fs = require('fs')
const path = require('path')

const TallyServerCore = require('tally-server-core')
const app = new TallyServerCore.App()

if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log("No command line parameters available.")
    console.log("Please provide a config file at current working directory.")
    console.log("")
    console.log("Parameters:")
    console.log("-e\tOutput an example config file")
    console.log("-h\tOutput this help/usage text")
    console.log("-v\tOutput version")
    process.exit(0)
} else if (process.argv.includes("-v") || process.argv.includes("--version")) {
    const packageJson = require('./package.json')
    console.log('CLI version:  ' + packageJson["version"])
    console.log('Core version: ' + TallyServerCore.App.getVersion())
    process.exit(0)
} else if (process.argv.includes("-e")) {
    fs.readFile(path.join(__dirname, "./config.yml"), "binary", (err, file) => {
        if (err) {
            console.log("Could not read example config file.")
            process.exit(1)
        }

        console.log(file)
        process.exit(0)
    });
} else {
    //const App = require('../core/App')
    app.run()
    const logger = app.getLogger()

    logger.info("Control UI available at:")

    // List other local IP addresses on console
    const urls = app.getControlUiUrls()
    for (const url of urls) {
        logger.info(url)
    }

    const open = require('open');
    const { apps } = require('open');
    open(urls[0])
}

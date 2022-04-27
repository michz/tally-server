// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

//const exec = require('child_process')
const mainBinary = '../dist/tally-server-linux'

let childProcess = null;

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const txtLogs = document.getElementById('txtLogs');

function setTray() {
    if(NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            {id: "START", text: "Start"},
            {id: "STOP", text: "Stop"},
            {id: "SEP", text: "-"},
            {id: "QUIT", text: "Quit"}
        ]
    };
    Neutralino.os.setTray(tray);
}

function updateUiState() {
    let state = 'UNKNOWN';

    if (childProcess !== null && childProcess.connected && childProcess.exitCode === null) {
        state = 'RUNNING';
    } else {
        state = 'STOPPED';
    }

    // @TODO Change Menu Items
    switch (state) {
        case 'STOPPED':
            btnStart.disabled = false;
            btnStop.disabled = true;
            break;
        case 'RUNNING':
            btnStart.disabled = true;
            btnStop.disabled = false;
            break;
        default:
            btnStart.disabled = false;
            btnStop.disabled = false;
            break;
    }
}

function onChildProcessExit() {

}

function btnStartClick() {
    txtLogs.innerHTML = '';

    let t = Neutralino.os.execCommand(mainBinary + ' -e', { background: true });
    console.log(t);

    return;

    childProcess = exec(mainBinary + ' -e', {}, onChildProcessExit);

    childProcess.stdout.on('data', function (data) {
        txtLogs.innerHTML += data;
    });
    updateUiState();
}

function btnStopClick() {
    // @TODO be more graceful
    if (!childProcess || childProcess.exitCode !== null) {
        return;
    }

    childProcess.kill();
}

function onTrayMenuItemClicked(event) {
    switch(event.detail.id) {
        case "START":
            btnStartClick();
            break;
        case "STOP":
            btnStopClick();
            break;
        case "QUIT":
            Neutralino.app.exit();
            break;
    }
}

function onWindowClose() {
    Neutralino.app.exit();
}

Neutralino.init();

Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

//if (NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
//}

btnStart.addEventListener('click', btnStartClick);
btnStop.addEventListener('click', btnStopClick);

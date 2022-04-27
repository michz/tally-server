document.addEventListener('DOMContentLoaded', function () {
    const { exec } = require('child_process');
    const AnsiUp = require('ansi_up');
    const treeKill = require('tree-kill');
    const ansi_up = new AnsiUp.default();

    const cwd = '..';
    const mainBinary = './tally-server';

    let childProcess = null;

    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    const txtLogs = document.getElementById('txtLogs');
    const chkAutoscroll = document.getElementById('chkAutoscroll');

    function updateUiState() {
        let state = 'UNKNOWN';

        if (childProcess !== null && childProcess.exitCode === null) {
            state = 'RUNNING';
        } else {
            state = 'STOPPED';
        }

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
        updateUiState();
    }

    function addOutput(data) {
        txtLogs.innerHTML += ansi_up.ansi_to_html(data);
        if (chkAutoscroll.checked) {
            txtLogs.scrollTop = txtLogs.scrollHeight;
        }

        updateUiState();
    }

    function btnStartClick() {
        childProcess = exec(mainBinary + '', {cwd: cwd}, onChildProcessExit);
        window.childProcess = childProcess;

        childProcess.stdout.on('data', addOutput);
        childProcess.stderr.on('data', addOutput);
        childProcess.on('spawn', function () {
            txtLogs.innerHTML = '-- Process spawned --<br>';
            txtLogs.scrollTop = 0;
            updateUiState();
        });

        updateUiState();
    }

    function btnStopClick() {
        if (!childProcess || childProcess.exitCode !== null) {
            return;
        }

        treeKill(childProcess.pid);
        childProcess = null;
        window.setTimeout(() => {
            updateUiState();
        }, 500);
    }

    btnStart.addEventListener('click', btnStartClick);
    btnStop.addEventListener('click', btnStopClick);

    window.setTimeout(() => { btnStart.click() }, 500);
});

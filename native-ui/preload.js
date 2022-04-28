
const packageJson = require('./package.json')
const TallyServerCore = require('tally-server-core')

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('versions').innerHTML = 'Versions: UI: ' + packageJson['version'] + ', Core: ' + TallyServerCore.App.getVersion() + ', Chrome: ' + process.versions['chrome'];
});

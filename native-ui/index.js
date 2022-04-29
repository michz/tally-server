const { app, BrowserWindow } = require('electron')
const exec = require('child_process')
const path = require('path')

const TallyServerCore = require('tally-server-core')
const tallyServerApp = new TallyServerCore.App()
tallyServerApp.run()
const urls = tallyServerApp.getControlUiUrls()

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(app.getAppPath(), 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  win.removeMenu()
  //win.webContents.openDevTools()
  win.loadURL(urls[0])
  //win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') app.quit()
  app.quit()
})

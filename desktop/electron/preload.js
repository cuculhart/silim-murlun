const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('silimMurlun', {
  // Native file dialogs - data crosses the bridge as base64 strings
  openDialog: () => ipcRenderer.invoke('sm:open-dialog'),
  saveDialog: (defaultName) =>
    ipcRenderer.invoke('sm:save-dialog', defaultName),
  readFile: (p) => ipcRenderer.invoke('sm:read-file', p),
  writeFile: (p, b64) => ipcRenderer.invoke('sm:write-file', p, b64),

  // Dirty flag for the main-process close guard
  setDirty: (d) => ipcRenderer.send('sm:set-dirty', d),

  // OS menu follows the app's ja/en language switch
  setMenuLang: (lang) => ipcRenderer.send('sm:set-menu-lang', lang),

  // Keyboard accelerators forwarded by the main process:
  // 'save' | 'save-as' | 'open'
  onMenu: (callback) => {
    const listener = (event, action) => callback(action)
    ipcRenderer.on('sm-menu', listener)
    return () => ipcRenderer.removeListener('sm-menu', listener)
  },

  // Close-button flow: main asks the renderer to save then quit
  onSaveForQuit: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('sm-save-for-quit', listener)
    return () => ipcRenderer.removeListener('sm-save-for-quit', listener)
  },
  quitNow: () => ipcRenderer.send('sm:quit-now'),
  quitAbort: () => ipcRenderer.send('sm:quit-abort'),

  // Document path handed to the app via CLI arg / exe drop /
  // second instance. The pull variant covers the initial mount
  // (did-finish-load can race React listener registration).
  takePendingFile: () => ipcRenderer.invoke('sm:take-pending-file'),
  onOpenPath: (callback) => {
    const listener = (event, p) => callback(p)
    ipcRenderer.on('sm-open-path', listener)
    return () => ipcRenderer.removeListener('sm-open-path', listener)
  },

  // Real path of a File dropped onto the window (File.path was removed
  // in newer Electron - webUtils is the supported API)
  pathForFile: (file) => webUtils.getPathForFile(file),

  platform: process.platform,
})

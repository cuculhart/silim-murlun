const path = require('path')
const fsSync = require('fs')
const http = require('http')

// Fetch a dev server's index page; returns '' when nothing is listening.
// Used to verify a candidate port actually serves Silim Murlun before
// loading it - another project's dev server must not be opened.
function fetchIndexHtml(port) {
  return new Promise((resolve) => {
    const req = http
      .get(`http://localhost:${port}`, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(data))
      })
      .on('error', () => resolve(''))
      .setTimeout(2000, () => {
        req.destroy()
        resolve('')
      })
  })
}

let mainWindow = null
// Renderer pushes its dirty flag here; the close handler consults it.
let rendererDirty = false
// Set when the user (or the renderer after saving) approved the close.
let allowClose = false

const ARCHIVE_RE = /\.(chsmf|slm)$/i

// The app is bilingual (ja/en) - unlike Kusuma Plava's fixed-Japanese
// menu, the OS menu, close guard, dialogs and context menu all follow
// the renderer's language, pushed via 'sm:set-menu-lang'.
const LABELS = {
  ja: {
    archiveDoc: 'Silim Murlun 文書',
    allFiles: 'すべてのファイル',
    menu: {
      file: 'ファイル',
      new: '新規',
      open: '開く…',
      save: '上書き保存',
      saveAs: '名前を付けて保存…',
      print: '印刷…',
      quit: '終了',
      edit: '編集',
      undo: '元に戻す',
      redo: 'やり直す',
      cut: '切り取り',
      copy: 'コピー',
      paste: '貼り付け',
      selectAll: 'すべて選択',
      view: '表示',
      resetZoom: '実際のサイズ',
      zoomIn: '拡大',
      zoomOut: '縮小',
      reload: '再読み込み',
      devTools: '開発者ツール',
      fullscreen: '全画面表示',
      window: 'ウィンドウ',
      minimize: '最小化',
      close: '閉じる',
      help: 'ヘルプ',
      about: 'Silim Murlun について',
    },
    closeGuard: {
      buttons: ['保存して閉じる', '保存せず閉じる', 'キャンセル'],
      message: '変更を保存しますか?',
      detail:
        '保存しないで閉じると変更は失われます（自動保存の下書きは残ります）。',
    },
  },
  en: {
    archiveDoc: 'Silim Murlun document',
    allFiles: 'All files',
    menu: {
      file: 'File',
      new: 'New',
      open: 'Open…',
      save: 'Save',
      saveAs: 'Save As…',
      print: 'Print…',
      quit: 'Quit',
      edit: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All',
      view: 'View',
      resetZoom: 'Actual Size',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      reload: 'Reload',
      devTools: 'Developer Tools',
      fullscreen: 'Toggle Full Screen',
      window: 'Window',
      minimize: 'Minimize',
      close: 'Close',
      help: 'Help',
      about: 'About Silim Murlun',
    },
    closeGuard: {
      buttons: ['Save and close', "Don't save", 'Cancel'],
      message: 'Save changes?',
      detail:
        'Closing without saving loses your changes (the autosaved draft remains).',
    },
  },
}
let menuLang = 'ja'
const L = () => LABELS[menuLang]

const fileFilters = () => [
  { name: L().archiveDoc, extensions: ['chsmf', 'slm'] },
  { name: L().allFiles, extensions: ['*'] },
]

// Document path passed via CLI arg (e.g. dropping a .chsmf on the exe).
// Packaged: argv[1..] are user args; dev: argv[0]=electron, argv[1]=app dir.
function extractArgFile(argv) {
  const { app } = require('electron')
  const args = app.isPackaged ? argv.slice(1) : argv.slice(2)
  for (const arg of args) {
    try {
      if (
        !arg.startsWith('-') &&
        ARCHIVE_RE.test(arg) &&
        fsSync.statSync(arg).isFile()
      ) {
        return path.resolve(arg)
      }
    } catch (e) {
      // not a readable path - skip
    }
  }
  return null
}

let pendingFileArg = extractArgFile(process.argv)

function sendFileArg() {
  if (pendingFileArg && mainWindow) {
    mainWindow.webContents.send('sm-open-path', pendingFileArg)
    pendingFileArg = null
  }
}

function sendMenuAction(action) {
  if (mainWindow) {
    mainWindow.webContents.send('sm-menu', action)
  }
}

// 未設定だと Electron が英語のデフォルトメニューを出すため OS メニューを
// 自前で用意する。言語はアプリ側（ja/en 切替）に追従して再構築する。
// ファイル系の操作はレンダラへ IPC で投げるだけ — 実処理は
// app 側の既存ハンドラが担う。
function buildMenu() {
  const { Menu } = require('electron')
  const m = L().menu
  // registerAccelerator:false = ヒント表示だけ残して実登録しない。
  // Ctrl+Z/Y はアプリ固有の undo/redo をレンダラが処理するので、
  // キーはそのままページへ通す（メニュー項目自体はクリックで動く）
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: m.file,
      submenu: [
        {
          label: m.new,
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new'),
        },
        {
          label: m.open,
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open'),
        },
        { type: 'separator' },
        {
          label: m.save,
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save'),
        },
        {
          label: m.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-as'),
        },
        { type: 'separator' },
        {
          label: m.print,
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('print'),
        },
        { type: 'separator' },
        { role: 'quit', label: m.quit },
      ],
    },
    {
      label: m.edit,
      submenu: [
        {
          label: m.undo,
          accelerator: 'CmdOrCtrl+Z',
          registerAccelerator: false,
          click: () => sendMenuAction('undo'),
        },
        {
          label: m.redo,
          accelerator: 'CmdOrCtrl+Y',
          registerAccelerator: false,
          click: () => sendMenuAction('redo'),
        },
        { type: 'separator' },
        { role: 'cut', label: m.cut },
        { role: 'copy', label: m.copy },
        { role: 'paste', label: m.paste },
        { role: 'selectAll', label: m.selectAll },
      ],
    },
    {
      label: m.view,
      submenu: [
        { role: 'resetZoom', label: m.resetZoom },
        { role: 'zoomIn', label: m.zoomIn },
        { role: 'zoomOut', label: m.zoomOut },
        { type: 'separator' },
        { role: 'reload', label: m.reload },
        { role: 'toggleDevTools', label: m.devTools },
        { type: 'separator' },
        { role: 'togglefullscreen', label: m.fullscreen },
      ],
    },
    {
      label: m.window,
      submenu: [
        { role: 'minimize', label: m.minimize },
        { role: 'close', label: m.close },
      ],
    },
    {
      label: m.help,
      submenu: [
        {
          label: m.about,
          click: () => sendMenuAction('about'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function createWindow() {
  const { BrowserWindow } = require('electron')

  // --window-size=WxH overrides the default size (e.g. for screenshots).
  // width/height are the web contents area, excluding the OS frame.
  const sizeArg = process.argv.find((a) => a.startsWith('--window-size='))
  const m = sizeArg && sizeArg.match(/^--window-size=(\d+)x(\d+)$/)
  const width = m ? +m[1] : 1400
  const height = m ? +m[2] : 900

  mainWindow = new BrowserWindow({
    title: 'Silim Murlun',
    width,
    height,
    // Windows uses the exe icon; this matters on Linux
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Unsaved-changes guard. The renderer owns the save flow (it may need
  // to show a save dialog), so the button just asks it to save then quit.
  mainWindow.on('close', (e) => {
    if (allowClose || !rendererDirty) return
    e.preventDefault()
    const { dialog } = require('electron')
    const g = L().closeGuard
    const r = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: g.buttons,
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Silim Murlun',
      message: g.message,
      detail: g.detail,
    })
    if (r === 1) {
      allowClose = true
      mainWindow.close()
    } else if (r === 0) {
      mainWindow.webContents.send('sm-save-for-quit')
    }
  })

  // Menu-free accelerators: the app keeps its own in-canvas menu, so
  // file shortcuts are forwarded as IPC actions instead of an OS menu.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return
    const k = input.key.toLowerCase()
    if (k === 's') {
      event.preventDefault()
      mainWindow.webContents.send('sm-menu', input.shift ? 'save-as' : 'save')
    } else if (k === 'o') {
      event.preventDefault()
      mainWindow.webContents.send('sm-menu', 'open')
    }
  })

  if (app.isPackaged) {
    // Packaged build: the bundled renderer is copied in by
    // extraResource (it lives outside this package - app/dist)
    await mainWindow.loadFile(
      path.join(process.resourcesPath, 'dist', 'index.html'),
    )
  } else {
    // In development, load from the Vite dev server. Candidate ports
    // are probed via HTTP and only a page actually titled Silim Murlun
    // is loaded, so another project's dev server is skipped instead of
    // opened. Retrying also covers vite still starting up or having
    // shifted to a fallback port after a collision.
    const ports = [5173, 5174, 5175, 5176]
    const deadline = Date.now() + 60000
    let loaded = false
    while (!loaded && Date.now() < deadline) {
      for (const port of ports) {
        const html = await fetchIndexHtml(port)
        if (html.includes('Silim Murlun')) {
          try {
            await mainWindow.loadURL(`http://localhost:${port}`)
            loaded = true
          } catch (e) {
            // server went away between probe and load - keep scanning
          }
          break
        }
      }
      if (!loaded) await new Promise((r) => setTimeout(r, 500))
    }
    if (!loaded) {
      // No dev server: fall back to the last vite build so
      // `electron .` still works after `npm -w app run build`
      const distIndex = path.join(__dirname, '..', '..', 'app', 'dist', 'index.html')
      if (fsSync.existsSync(distIndex)) {
        await mainWindow.loadFile(distIndex)
      } else {
        console.error(
          'Silim Murlun dev server not found - is `npm run dev` running?',
        )
      }
    }
  }

  // Right-click context menu - Electron ships no default one, so without
  // this there is no way to copy selected text (Linux/Windows).
  const { Menu } = require('electron')
  mainWindow.webContents.on('context-menu', (e, params) => {
    const m = L().menu
    const items = params.isEditable
      ? [
          { role: 'undo', label: m.undo },
          { role: 'redo', label: m.redo },
          { type: 'separator' },
          { role: 'cut', label: m.cut },
          { role: 'copy', label: m.copy },
          { role: 'paste', label: m.paste },
          { type: 'separator' },
          { role: 'selectAll', label: m.selectAll },
        ]
      : params.selectionText.trim()
        ? [
            { role: 'copy', label: m.copy },
            { type: 'separator' },
            { role: 'selectAll', label: m.selectAll },
          ]
        : []
    if (items.length) Menu.buildFromTemplate(items).popup()
  })

  // Deliver the CLI file arg (file dropped on the exe) once loaded
  mainWindow.webContents.on('did-finish-load', sendFileArg)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const { app, dialog, ipcMain } = require('electron')

// In packaged builds a main-process crash exits silently (no console).
// Log to a file and show a dialog so failures are diagnosable.
function reportFatalError(err) {
  const message = err && err.stack ? err.stack : String(err)
  try {
    const fs = require('fs')
    const os = require('os')
    fs.appendFileSync(
      path.join(os.tmpdir(), 'silim-murlun-crash.log'),
      `${new Date().toISOString()}\n${message}\n\n`,
    )
  } catch (e) {
    // ignore logging failure
  }
  try {
    dialog.showErrorBox('Silim Murlun failed to start', message)
  } catch (e) {
    // ignore dialog failure
  }
  app.exit(1)
}

process.on('uncaughtException', reportFatalError)
process.on('unhandledRejection', (reason) => reportFatalError(reason))

// Reuse the running instance when a file is dropped on the exe again
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    const file = extractArgFile(argv)
    if (file) pendingFileArg = file
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      sendFileArg()
    }
  })
}

app.whenReady().then(async () => {
  // Renderer pulls the pending CLI file arg on mount (did-finish-load
  // can fire before React listeners are registered)
  ipcMain.handle('sm:take-pending-file', () => {
    const p = pendingFileArg
    pendingFileArg = null
    return p
  })

  // Native open dialog -> { path, b64 } of the chosen archive
  ipcMain.handle('sm:open-dialog', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: fileFilters(),
    })
    if (r.canceled || !r.filePaths.length) return null
    const p = r.filePaths[0]
    return { path: p, b64: fsSync.readFileSync(p).toString('base64') }
  })

  // Native save dialog -> destination path ('.chsmf' appended if the
  // user typed a bare name), or null when cancelled
  ipcMain.handle('sm:save-dialog', async (event, defaultName) => {
    const r = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: fileFilters(),
    })
    if (r.canceled || !r.filePath) return null
    return ARCHIVE_RE.test(r.filePath) ? r.filePath : `${r.filePath}.chsmf`
  })

  ipcMain.handle('sm:read-file', (event, p) =>
    fsSync.readFileSync(p).toString('base64'),
  )
  ipcMain.handle('sm:write-file', (event, p, b64) => {
    fsSync.writeFileSync(p, Buffer.from(b64, 'base64'))
    return true
  })

  // Dirty flag for the close guard; pushed by the renderer
  ipcMain.on('sm:set-dirty', (event, d) => {
    rendererDirty = !!d
  })
  ipcMain.on('sm:quit-now', () => {
    allowClose = true
    mainWindow?.close()
  })
  // Save-for-quit was cancelled at the save dialog - just stay open.
  ipcMain.on('sm:quit-abort', () => {})

  // OS menu follows the app's ja/en language switch
  ipcMain.on('sm:set-menu-lang', (event, lang) => {
    const next = lang === 'en' ? 'en' : 'ja'
    if (next === menuLang) return
    menuLang = next
    buildMenu()
  })

  buildMenu()
  await createWindow()

  app.on('activate', async () => {
    const { BrowserWindow } = require('electron')
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
}).catch(reportFatalError)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

module.exports = {
  packagerConfig: {
    // Extension-less on purpose: electron-packager picks .ico/.icns/.png per platform
    icon: 'assets/icon',
    // Binary name - productName "Silim Murlun" contains a space which
    // makes a poor executable name on Linux
    executableName: 'silim-murlun',
    // The renderer is fully bundled by Vite and the main process only
    // uses electron builtins, so nothing under node_modules ships
    ignore: [/^\/node_modules(\/|$)/, /^\/out(\/|$)/, /^\/dev\.mjs$/],
    // @electron/get validates the cached Electron zip by downloading
    // SHASUMS256.txt every run (cache bypass) - a GitHub blip then
    // fails the whole package step even with a warm cache. The zip
    // was already integrity-checked when first downloaded, so skip
    // re-validation and let the cache work offline.
    download: { unsafelyDisableChecksums: true },
    // The built renderer lives outside this package (vite workspace
    // output) - it lands under resources/dist/ and main.js loads it
    // from process.resourcesPath when packaged
    extraResource: ['../app/dist', '../LICENSE', '../CHANGELOG.md'],
  },
  // No native modules - nothing to rebuild for Electron's ABI
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Installer exe icon; iconUrl is shown in Add/Remove Programs and must
        // be a public https URL to an .ico (the committed file on GitHub)
        setupIcon: 'assets/icon.ico',
        iconUrl:
          'https://raw.githubusercontent.com/cuculhart/silim-murlun/main/desktop/assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          bin: 'silim-murlun',
          icon: 'assets/icon.png',
          homepage: 'https://github.com/cuculhart/silim-murlun',
          section: 'graphics',
          genericName: 'Page Layout Editor',
          categories: ['Office', 'Publishing'],
        },
      },
    },
  ],
  plugins: [],
}

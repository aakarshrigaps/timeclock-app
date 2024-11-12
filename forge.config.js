const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
   publishers: [
      {
         name: "@electron-forge/publisher-github",
         config: {
            repository: {
               owner: "aakarshrigaps",
               name: "timeclock-app",
            },
            prerelease: false,
            draft: true,
         },
      },
   ],
   packagerConfig: {
      name: "AutoTimeClock",
      asar: true,
      icon: "assets/images/logo",
   },
   rebuildConfig: {},
   makers: [
      {
         //for windows
         name: "@electron-forge/maker-wix",
         config: {
            icon: "assets/images/logo.ico",
         },
      },
      {
         //for multi-platforms
         name: "@electron-forge/maker-zip",
         platforms:["darwin", "win32"],
         config: {
            icon: "assets/images/logo",
         },
      },
      // {
      //    //for linux
      //    name: "@electron-forge/maker-deb",
      //    config: {
      //       options: {
      //          icon: "assets/images/logo.png",
      //       },
      //    },
      // },
   ],
   plugins: [
      {
         name: "@electron-forge/plugin-auto-unpack-natives",
         config: {},
      },
      // Fuses are used to enable/disable various Electron functionality
      // at package time, before code signing the application
      new FusesPlugin({
         version: FuseVersion.V1,
         [FuseV1Options.RunAsNode]: false,
         [FuseV1Options.EnableCookieEncryption]: true,
         [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
         [FuseV1Options.EnableNodeCliInspectArguments]: false,
         [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
         [FuseV1Options.OnlyLoadAppFromAsar]: true,
      }),
   ],
};

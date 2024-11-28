const { exec } = require("child_process");
const os = require("os");
const moment = require("moment-timezone");
const dns = require("dns");
const log = require("electron-log");

function calculateDuration(breakStartTime, breakEndTime) {
   const durationMs = new Date(breakEndTime) - new Date(breakStartTime);
   const durationHrs = Math.floor(durationMs / 3600000);
   const durationMins = Math.floor((durationMs % 3600000) / 60000);
   const durationSecs = Math.floor((durationMs % 60000) / 1000);
   const durationString = [
      durationHrs > 0 ? `${durationHrs} hrs` : "",
      durationMins > 0 ? `${durationMins} mins` : "",
      durationSecs > 0 ? `${durationSecs} secs` : "",
   ]
      .filter(Boolean)
      .join(" ");
   return durationString.trim();
}

function calculateBreakMins(breakStartTime, breakEndTime) {
   const breakDurationMs = new Date(breakEndTime) - new Date(breakStartTime);
   const breakDurationMins = Math.floor(breakDurationMs / 60000);
   return breakDurationMins;
}

async function isTeamsRunning() {
   return new Promise((resolve, reject) => {
      const platform = os.platform();

      // Construct the command based on the platform
      let command;
      if (platform === "win32") {
         command = "tasklist"; // Windows command
      } else if (platform === "darwin") {
         command = "ps -ax"; // macOS command
      } else if (platform === "linux") {
         command = "ps -A"; // Linux command
      } else {
         return reject(new Error("Unsupported platform"));
      }

      exec(command, (err, stdout, stderr) => {
         if (err) {
            return reject(err);
         }

         // Check for the Teams process name based on the platform
         const processName =
            platform === "win32" ? "teams.exe" : "Microsoft Teams";

         // Check if the Teams process is listed in the output
         resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
      });
   });
}

function calculateActiveDuration(clockIn, clockOut, breakDurationMs) {
   const activeDurationMs =
      new Date(clockOut) - new Date(clockIn) - breakDurationMs;
   const activeDurationHrs = Math.floor(activeDurationMs / 3600000);
   const activeDurationMins = Math.floor((activeDurationMs % 3600000) / 60000);
   const activeDurationSecs = Math.floor((activeDurationMs % 60000) / 1000);
   const activeDuration = `${
      activeDurationHrs > 0 ? `${activeDurationHrs} hrs ` : ""
   }${activeDurationMins > 0 ? `${activeDurationMins} mins ` : ""}${
      activeDurationSecs > 0 ? `${activeDurationSecs} secs` : ""
   }`.trim();
   return activeDuration;
}

function convertMsToHrsMinsSecs(ms) {
   const hours = Math.floor(ms / 3600000);
   const minutes = Math.floor((ms % 3600000) / 60000);
   const seconds = Math.floor((ms % 60000) / 1000);

   return `${hours > 0 ? `${hours} hrs ` : ""}${
      minutes > 0 ? `${minutes} mins ` : ""
   }${seconds > 0 ? `${seconds} secs` : ""}`.trim();
}

function getTimezoneAbbreviation() {
   const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   return moment.tz(timeZone).format("z");
}

async function waitForInternetConnection() {
   while (true) {
      const isConnected = await checkInternetConnection();
      if (isConnected) {
         log.info("Internet connection available. Proceeding with update...");
         break; // Exit the loop when internet connection is available
      }
      log.info("No internet connection. Retrying in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Retry after 5 seconds
   }
}

async function checkInternetConnection() {
   return new Promise((resolve) => {
      dns.lookup("google.com", (err) => resolve(!err)); // Resolves to true if DNS lookup succeeds
   });
}

module.exports = {
   calculateDuration,
   calculateBreakMins,
   isTeamsRunning,
   calculateActiveDuration,
   convertMsToHrsMinsSecs,
   getTimezoneAbbreviation,
   waitForInternetConnection,
};

const { exec } = require("child_process");
const os = require("os");

function calculateBreakDuration(breakStartTime, breakEndTime) {
   const breakDurationMs = new Date(breakEndTime) - new Date(breakStartTime);
   const breakDurationHrs = Math.floor(breakDurationMs / 3600000);
   const breakDurationMins = Math.floor((breakDurationMs % 3600000) / 60000);
   const breakDurationSecs = Math.floor((breakDurationMs % 60000) / 1000);
   const durationString = [
      breakDurationHrs > 0 ? `${breakDurationHrs} hrs` : "",
      breakDurationMins > 0 ? `${breakDurationMins} mins` : "",
      breakDurationSecs > 0 ? `${breakDurationSecs} secs` : "",
   ]
      .filter(Boolean)
      .join(" ");
   return durationString.trim();
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

module.exports = { calculateBreakDuration, isTeamsRunning };
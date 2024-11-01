const { exec } = require("child_process");

function calculateBreakDuration(breakStartTime, breakEndTime) {
    const breakDurationMs = new Date(breakEndTime) - new Date(breakStartTime);
    const breakDurationHrs = Math.floor(breakDurationMs / 3600000);
    const breakDurationMins = Math.floor((breakDurationMs % 3600000) / 60000);
    const breakDurationSecs = Math.floor((breakDurationMs % 60000) / 1000);
    const durationString = [
       breakDurationHrs > 0 ? `${breakDurationHrs} hrs` : "",
       breakDurationMins > 0 ? `${breakDurationMins} mins` : "",
       breakDurationSecs > 0 ? `${breakDurationSecs} secs` : ""
    ].filter(Boolean).join(" ");
    return durationString.trim();
 }

 // Placeholder function to check if Teams is running
 async function isTeamsRunning() {
    return new Promise((resolve, reject) => {
       exec("tasklist", (err, stdout, stderr) => {
          if (err) {
             return reject(err);
          }
          // Check if Teams process is listed in the tasklist output
          resolve(stdout.toLowerCase().includes("teams.exe"));
       });
    });
 }

 module.exports = { calculateBreakDuration, isTeamsRunning };
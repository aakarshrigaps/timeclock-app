const { app, BrowserWindow, ipcMain, contextBridge } = require("electron");
const {
   getUserId,
   getTeamId,
   getOwners,
   notifyUserAndTeam,
} = require("./scripts/user-team-api");
const {
   getLatestSession,
   clockIn,
   clockOut,
   startBreak,
   endBreak,
   getPresence,
} = require("./scripts/timecard-api");
const { calculateBreakDuration, isTeamsRunning } = require("./scripts/utils");
const { autoUpdater } = require("electron-updater");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");

let isPromptOpen = false;
let isReminderOpen = false;
let isReminderLoopActive = false;
let mainWindow;
let reminderWindow;
let store; // Declare store variable

// Check for single instance lock
const gotTheLock = app.requestSingleInstanceLock();

app.on("window-all-closed", (event) => {
   event.preventDefault(); // Prevent the default behavior of quitting the app
});

if (!gotTheLock) {
   // If the lock is not acquired, quit the app
   app.quit();
} else {
   // If the lock is acquired, set up the event listener for second instances
   app.on("second-instance", (event, commandLine, workingDirectory) => {
      // When another instance tries to run, this event will be triggered
      if (mainWindow) {
         if (mainWindow.isMinimized()) mainWindow.restore();
         mainWindow.focus();
      }
   });

   app.on("ready", async () => {
      // Check for updates when the app is ready
      autoUpdater.checkForUpdatesAndNotify();

      // Dynamically import electron-store (ESM)
      const Store = (await import("electron-store")).default;
      store = new Store(); // Initialize the store

      // Check if user details are already stored
      let userConfig = store.get("user-config");
      let userIds = store.get("user-ids");

      if (
         !userConfig ||
         !userConfig.email ||
         !userConfig.teamName ||
         !userIds ||
         !userIds.userId ||
         !userIds.teamId
      ) {
         // If no configuration is found, prompt the user for details
         mainWindow = createWindow(450, 250); // Default size for email-input.html
         mainWindow.loadFile("./src/pages/user-config.html");

         ipcMain.on("save-user-details", async (event, userDetails) => {
            // Save user details to the store
            if (mainWindow) {
               mainWindow.close();
            }
            // console.log("Received user details from renderer:", userDetails); // Debug log
            store.set("user-config", userDetails);
            userConfig = userDetails;
            await authenticateEmail();
            let userId = await getUserId(userConfig.email);
            teamId = await getTeamId(userId, userConfig.teamName);
            store.set("user-ids", { userId, teamId });
            startMainLoop();
         });
      } else {
         startMainLoop();
      }
   });

   async function authenticateEmail() {
      return new Promise((resolve, reject) => {
         // Generate a random OTP
         const otp = crypto.randomInt(100000, 999999).toString();

         // Save the OTP to the store
         store.set("otp", otp);
         const userConfig = store.get("user-config");

         const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
               user: "appautotimeclock@gmail.com", // Your Outlook email address
               pass: "qyav mlvh omoy ueqo", // The app password you created
            },
         });

         const mailOptions = {
            from: "appautotimeclock@gmail.com",
            to: userConfig.email,
            subject: "AutoTimeClock: Verification Code",
            text: `Your OTP for verification is: ${otp}`,
         };

         transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
               // console.error("Error sending OTP email:", error);
               return reject(error);
            }
            // console.log("OTP email sent:", info.response);
         });

         // Show the verify-otp.html page
         mainWindow = createWindow(450, 250);
         mainWindow.loadFile("./src/pages/verify-otp.html");

         ipcMain.on("verify-otp", (event, enteredOtp) => {
            const storedOtp = store.get("otp");
            if (enteredOtp === storedOtp) {
               // console.log("OTP verified successfully.");
               store.delete("otp"); // Clear the OTP from the store
               if (mainWindow) mainWindow.close();
               resolve(); // Resolve the promise when OTP is verified and window is closed
            } else {
               console.error("Invalid OTP entered.");
               mainWindow.webContents.send(
                  "otp-error",
                  "Invalid OTP. Please try again."
               );
            }
         });
      });
   }

   // Function to start the main loop
   async function startMainLoop() {
      const { email, teamName } = store.get("user-config") || {};
      let { userId, teamId } = store.get("user-ids") || {};
      let { owners } = store.get("owners") || {};

      // if (!userId || !teamId) {
      //    // console.log("Fetching user and team IDs...");
      //    userId = await getUserId(email);
      //    teamId = await getTeamId(userId, teamName);
      //    store.set("user-ids", { userId, teamId });
      // }

      if (!owners) {
         // console.log("Fetching team owners...");
         owners = await getOwners(teamId);
         store.set("owners", { owners });
      }

      const latestTimeCard = await getLatestSession(userId, teamId);
      let timeCardId = latestTimeCard?.id;
      let state = latestTimeCard?.state;
      store.set("latest-time-card", { latestTimeCard });

      let userStatus = await getPresence(userId);
      store.set("user-status", userStatus);

      if (await isTeamsRunning()) {
         if (
            !state ||
            state === "clockedOut" ||
            state === "unknownFutureValue"
         ) {
            if (!isPromptOpen && !isReminderOpen && !isReminderLoopActive) {
               isPromptOpen = true;
               mainWindow = createWindow(450, 250);
               mainWindow.loadFile("./src/pages/clock-in-prompt.html");
               ipcMain.once(
                  "clock-in-confirmation",
                  async (_, shouldClockIn) => {
                     if (shouldClockIn) {
                        let timeCard = await clockInSequence(
                           userId,
                           teamId,
                           email,
                           teamName
                        );
                        store.set("latest-time-card", timeCard);
                     } else {
                        if (!isReminderOpen && !isReminderLoopActive) {
                           // Check reminder flag again
                           isReminderOpen = true;
                           isReminderLoopActive = true;
                           if (mainWindow) mainWindow.close();
                           reminderWindow = createWindow(450, 250);
                           reminderWindow.loadFile(
                              "./src/pages/clock-in-reminder.html"
                           );

                           ipcMain.once(
                              "set-reminder",
                              async (_, reminderTime) => {
                                 await startReminderLoop(reminderTime);
                                 isReminderOpen = false;
                              }
                           );
                        }
                     }
                     if (mainWindow) mainWindow.close();
                     isPromptOpen = false;
                  }
               );
            }
         }

         if (
            (userStatus.availability === "Away" ||
               userStatus.availability === "BeRightBack") &&
            state === "clockedIn"
         ) {
            let clockInData = store.get("latest-time-card");
            await startBreak(userId, teamId, timeCardId);
            const localBreakStartTime = new Date().toLocaleString();
            await notifyUserAndTeam(
               userId,
               "Break Update",
               `User ${email} has started a break at ${localBreakStartTime} in team ${teamName}`,
               owners,
               [email]
            );
         } else if (
            userStatus.availability !== "Away" &&
            userStatus.availability !== "BeRightBack" &&
            state === "onBreak"
         ) {
            let clockInData = store.get("latest-time-card");
            await endBreak(userId, teamId, timeCardId);
            const breakEndTime = new Date().toISOString();
            const localBreakEndTime = new Date().toLocaleString();
            const breakStartTime =
               clockInData.latestTimeCard.breaks[
                  clockInData.latestTimeCard.breaks.length - 1
               ].start.dateTime;
            const breakDuration = calculateBreakDuration(
               breakStartTime,
               breakEndTime
            );
            await notifyUserAndTeam(
               userId,
               "Break Update",
               `User ${email} has ended a break at ${localBreakEndTime} in team ${teamName}. Break Duration: ${breakDuration}`,
               owners,
               [email]
            );
         }
      } else {
         if (state === "clockedIn") {
            if (!isPromptOpen && !isReminderOpen) {
               isPromptOpen = true;
               mainWindow = createWindow(450, 250);
               mainWindow.loadFile("./src/pages/clock-out-prompt.html");
               ipcMain.once(
                  "clock-out-confirmation",
                  async (_, shouldClockOut) => {
                     if (shouldClockOut) {
                        await clockOutSequence();
                     }
                     if (mainWindow) mainWindow.close();
                     isPromptOpen = false;
                  }
               );
            }
         }
      }
      setTimeout(startMainLoop, 60000); // Repeat the check after a minute
   }

   async function startReminderLoop(reminderTime) {
      let scheduleClockInPrompt = async () => {
         if (reminderWindow) reminderWindow.close();
         isReminderLoopActive = true; // Set the flag to indicate the reminder loop is active
         await new Promise((resolve) =>
            setTimeout(resolve, reminderTime * 60000)
         );
         setTimeout(async () => {
            mainWindow = createWindow(450, 250);
            mainWindow.loadFile("./src/pages/clock-in-prompt.html");

            ipcMain.once(
               "clock-in-confirmation",
               async (event, shouldClockIn) => {
                  if (shouldClockIn) {
                     let timeCard = await clockInSequence();
                     store.set("latest-time-card", timeCard);
                     if (mainWindow) mainWindow.close();
                     isReminderLoopActive = false;
                  } else {
                     // User chose not to clock in, reschedule the reminder loop
                     if (mainWindow) mainWindow.close();
                     reminderWindow = createWindow(450, 250);
                     reminderWindow.loadFile(
                        "./src/pages/clock-in-reminder.html"
                     );

                     ipcMain.once(
                        "set-reminder",
                        async (event, newReminderTime) => {
                           // Update reminderTime if new value is provided
                           reminderTime = newReminderTime || reminderTime;
                           await scheduleClockInPrompt(); // Reschedule the prompt
                        }
                     );
                  }
               }
            );
         }, reminderTime * 1000); // Change from minutes to seconds
      };

      await scheduleClockInPrompt();
   }

   async function clockInSequence() {
      try {
         // console.log("Clocking In");
         let { email, teamName } = store.get("user-config");
         let { userId, teamId } = store.get("user-ids");
         let owners = store.get("owners");
         let timeCard = await clockIn(userId, teamId);
         let timeCardId = timeCard.id;
         let clockedInTime = timeCard.clockInEvent.dateTime;
         const localClockedInTime = new Date(clockedInTime).toLocaleString();
         store.set("latest-time-card", { clockedInTime, timeCardId });
         await notifyUserAndTeam(
            userId,
            "Clock in Update",
            `User ${email} has clocked in at ${localClockedInTime} to team ${teamName}`,
            owners,
            [email]
         );
         return timeCard;
      } catch (error) {
         console.error("Error while clocking in", error);
      }
   }

   async function clockOutSequence() {
      // console.log("Clocking Out");
      let { email, teamName } = store.get("user-config");
      let { userId, teamId } = store.get("user-ids");
      let { latestTimeCard } = store.get("latest-time-card");
      let owners = store.get("owners");
      await clockOut(userId, teamId, latestTimeCard.id);
      let clockedOutTime = new Date().toLocaleString();
      const localClockedInTime = new Date(
         latestTimeCard.clockInEvent.dateTime
      ).toLocaleString();
      await notifyUserAndTeam(
         userId,
         "Clock out Update",
         `User ${email} has clocked out at ${clockedOutTime} from team ${teamName}. Clocked in at ${localClockedInTime}`,
         owners,
         [email]
      );
   }

   // Auto-Updater Event Listeners
   autoUpdater.on("update-available", () => {
      // console.log("Update available. Downloading...");
   });

   autoUpdater.on("update-downloaded", () => {
      // console.log("Update downloaded. Will install now.");
      autoUpdater.quitAndInstall(); // Automatically quit and install the update
   });

   autoUpdater.on("error", (error) => {
      console.error("Error during update:", error);
   });

   // Function to create a BrowserWindow with specific width and height
   function createWindow(width, height) {
      return new BrowserWindow({
         width: width,
         height: height,
         roundedCorners: true,
         webPreferences: {
            preload: path.join(__dirname, "scripts", "preload.js"),
            contextIsolation: true,
            nodeIntegration: true,
         },
         alwaysOnTop: true,
         autoHideMenuBar: true,
         maximizable: false,
         minimizable: false,
      });
   }
}

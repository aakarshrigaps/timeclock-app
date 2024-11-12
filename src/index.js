const {
   app,
   BrowserWindow,
   ipcMain,
   contextBridge,
   powerMonitor,
   powerSaveBlocker,
} = require("electron");
const { updateElectronApp } = require("update-electron-app");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const log = require("electron-log");
const {
   getUserId,
   getTeamId,
   getOwners,
   notifyUserAndTeam,
   getUsername,
} = require("./scripts/user-team-api");
const {
   getLatestSession,
   clockIn,
   clockOut,
   startBreak,
   endBreak,
   getPresence,
   generateClockInEmail,
   generateSummaryEmail,
} = require("./scripts/timecard-api");
const {
   calculateBreakDuration,
   calculateBreakMins,
   isTeamsRunning,
} = require("./scripts/utils");

let isPromptOpen = false;
let isReminderOpen = false;
let isReminderLoopActive = false;
let mainWindow;
let reminderWindow;
let store; // Declare store variable
let powerSaveId = null;

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
   app.on("second-instance", () => {
      // When another instance tries to run, this event will be triggered
      if (mainWindow && !mainWindow.isDestroyed()) {
         if (mainWindow.isMinimized()) mainWindow.restore();
         mainWindow.focus();
      }
   });

   app.on("ready", async () => {
      // Check for updates using update-electron-app
      updateElectronApp({
         updateInterval: "1 hour",
         logger: require("electron-log"),
      });

      powerSaveId = powerSaveBlocker.start("prevent-app-suspension");

      // Dynamically import electron-store (ESM)
      const Store = (await import("electron-store")).default;
      store = new Store(); // Initialize the store

      // Check if user details are already stored
      let userConfig = store.get("user-config");
      let userIds = store.get("user-ids");

      powerMonitor.on("suspend", () => {
         log.info(
            "System is going to sleep. Starting a break and keeping the app running in the background..."
         );
         (async () => {
            let timecard = await getLatestSession(
               userIds.userId,
               userIds.teamId
            ).catch(async (error) => {
               if (error.code === "ECONNRESET") {
                  log.error(
                     "Connection reset error occurred. Relaunching the app..."
                  );
                  relaunchApp();
               } else {
                  log.error(
                     "Error while fetching latest timecard state:",
                     error
                  );
                  throw error;
               }
            });
            log.info("Latest timecard state:", timecard);
            //TODO: fix this break issue later
            if (timecard.state === "clockedIn") {
               await startBreak(
                  userIds.userId,
                  userIds.teamId,
                  timecard.id
               ).catch(async (error) => {
                  if (error.code === "ECONNRESET") {
                     log.error(
                        "Connection reset error occurred. Relaunching the app..."
                     );
                     relaunchApp();
                  } else {
                     log.error("Error while starting break:", error);
                     throw error;
                  }
               });
               log.info("Break started successfully.");
            }
         })();
         // powerSaveBlocker.stop(powerSaveId);
      });

      powerMonitor.on("resume", () => {
         log.info("System resumed from sleep. Relaunching the app...");
         relaunchApp();
      });

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
            let userId = await getUserId(userConfig.email).catch(
               async (error) => {
                  if (error.code === "ECONNRESET") {
                     log.error(
                        "Connection reset error occurred. Relaunching the app..."
                     );
                     relaunchApp();
                  } else {
                     throw error;
                  }
               }
            );
            let teamId = await getTeamId(userId, userConfig.teamName).catch(
               async (error) => {
                  if (error.code === "ECONNRESET") {
                     log.error(
                        "Connection reset error occurred. Relaunching the app..."
                     );
                     relaunchApp();
                  } else {
                     throw error;
                  }
               }
            );
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
               log.error("Invalid OTP entered.");
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
      let username = store.get("username") || (await getUsername(email));
      store.set("username", username);

      // if (!userId || !teamId) {
      //    // console.log("Fetching user and team IDs...");
      //    userId = await getUserId(email);
      //    teamId = await getTeamId(userId, teamName);
      //    store.set("user-ids", { userId, teamId });
      // }

      if (!owners) {
         // console.log("Fetching team owners...");
         owners = await getOwners(teamId).catch(async (error) => {
            if (error.code === "ECONNRESET") {
               log.error(
                  "Connection reset error occurred. Relaunching the app..."
               );
               relaunchApp();
            } else {
               throw error;
            }
         });
         store.set("owners", { owners });
      }

      const latestTimeCard = await getLatestSession(userId, teamId).catch(
         async (error) => {
            if (error.code === "ECONNRESET") {
               log.error(
                  "Connection reset error occurred. Relaunching the app..."
               );
               relaunchApp();
            } else {
               throw error;
            }
         }
      );
      let timeCardId = latestTimeCard?.id;
      let state = latestTimeCard?.state;
      store.set("latest-time-card", { latestTimeCard });

      let userStatus = await getPresence(userId).catch(async (error) => {
         if (error.code === "ECONNRESET") {
            log.error(
               "Connection reset error occurred. Relaunching the app..."
            );
            relaunchApp();
         } else {
            throw error;
         }
      });
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
            await startBreak(userId, teamId, timeCardId).catch(
               async (error) => {
                  if (error.code === "ECONNRESET") {
                     log.error(
                        "Connection reset error occurred. Relaunching the app..."
                     );
                     relaunchApp();
                  } else {
                     throw error;
                  }
               }
            );
            // commenting out break start notification mail
            // const localBreakStartTime = new Date().toLocaleString();
            // await notifyUserAndTeam(
            //    userId,
            //    "Break Update",
            //    `User ${email} has started a break at ${localBreakStartTime} in team ${teamName}`,
            //    owners,
            //    [email]
            // );
         } else if (
            userStatus.availability !== "Away" &&
            userStatus.availability !== "BeRightBack" &&
            state === "onBreak"
         ) {
            let clockInData = store.get("latest-time-card");
            await endBreak(userId, teamId, timeCardId).catch(async (error) => {
               if (error.code === "ECONNRESET") {
                  log.error(
                     "Connection reset error occurred. Relaunching the app..."
                  );
                  relaunchApp();
               } else {
                  throw error;
               }
            });
            // commenting out break end notification mail
            // const breakEndTime = new Date().toISOString();
            // const localBreakEndTime = new Date().toLocaleString();
            // const breakStartTime =
            //    clockInData.latestTimeCard.breaks[
            //       clockInData.latestTimeCard.breaks.length - 1
            //    ].start.dateTime;
            // const breakDuration = calculateBreakDuration(
            //    breakStartTime,
            //    breakEndTime
            // );
            // const breakDurationMins = calculateBreakMins(breakStartTime, breakEndTime);
            // if (breakDurationMins > 5) {
            //    await notifyUserAndTeam(
            //       userId,
            //       "Break Update",
            //       `User ${email} has ended a break at ${localBreakEndTime} in team ${teamName}. Break Duration: ${breakDuration}`,
            //       owners,
            //       [email]
            //    );
            // }
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
      let lastUpdated = new Date().toLocaleString();
      store.set("last-updated", lastUpdated);
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
         let username = store.get("username");
         let { email, teamName } = store.get("user-config");
         let { userId, teamId } = store.get("user-ids");
         let { owners } = store.get("owners");
         let timeCard = await clockIn(userId, teamId).catch(async (error) => {
            if (error.code === "ECONNRESET") {
               log.error(
                  "Connection reset error occurred. Relaunching the app..."
               );
               relaunchApp();
            }
            throw error;
         });
         let timeCardId = timeCard.id;
         let clockedInTime = timeCard.clockInEvent.dateTime;
         const localClockedInTime = new Date(clockedInTime).toLocaleString();
         store.set("latest-time-card", { clockedInTime, timeCardId });
         let htmlMessage = generateClockInEmail(
            username,
            email,
            teamName,
            localClockedInTime
         );
         await notifyUserAndTeam(
            userId,
            "Clock in Update",
            htmlMessage,
            "html",
            owners,
            [email]
         );
         return timeCard;
      } catch (error) {
         log.error("Error while clocking in", error);
      }
   }

   async function clockOutSequence() {
      // console.log("Clocking Out");
      let username = store.get("username");
      let { email, teamName } = store.get("user-config");
      let { userId, teamId } = store.get("user-ids");
      let { latestTimeCard } = store.get("latest-time-card");
      let { owners } = store.get("owners");
      await clockOut(userId, teamId, latestTimeCard.id).catch(async (error) => {
         if (error.code === "ECONNRESET") {
            log.error(
               "Connection reset error occurred. Relaunching the app..."
            );
            relaunchApp();
         } else {
            throw error;
         }
      });
      let clockedOutTime = new Date().toLocaleString();
      const localClockedInTime = new Date(
         latestTimeCard.clockInEvent.dateTime
      ).toLocaleString();
      latestTimeCard = await getLatestSession(userId, teamId).catch(
         async (error) => {
            if (error.code === "ECONNRESET") {
               log.error(
                  "Connection reset error occurred. Relaunching the app..."
               );
               relaunchApp();
            } else {
               throw error;
            }
         }
      );
      store.set("latest-time-card", { latestTimeCard });
      let htmlMessage = generateSummaryEmail(
         username,
         email,
         teamName,
         latestTimeCard
      );
      await notifyUserAndTeam(
         userId,
         "Clock out Update",
         htmlMessage,
         "html",
         owners,
         [email]
      );
   }

   function relaunchApp() {
      app.relaunch();
      app.exit();
   }

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

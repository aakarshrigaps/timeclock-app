const {
   app,
   BrowserWindow,
   ipcMain,
   powerMonitor,
   powerSaveBlocker,
} = require("electron");
const { mail_id, mail_pass } = require("./scripts/decrypt-secrets");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const log = require("electron-log");
const {
   getUserId,
   getTeams,
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
   updateTimeCard,
   generateClockInEmail,
   generateSummaryEmail,
} = require("./scripts/timecard-api");
const {
   isTeamsRunning,
   waitForInternetConnection,
   updateActivity,
} = require("./scripts/utils");
const { autoUpdater } = require("electron-updater");
const {
   getDefaultSiteId,
   getListId,
   updateSharePointList,
   getSharePointListItemId,
   sendDataToSharePointList,
   updateDataSharePointList,
} = require("./scripts/sharepoint-api");

let isPromptOpen = false;
let isReminderOpen = false;
let isReminderLoopActive = false;
let isMainLoopActive = false;
let mainWindow;
let reminderWindow;
let store; // Declare store variable
let powerSaveId = null;

// Check for single instance lock
const gotTheLock = app.requestSingleInstanceLock();

app.on("window-all-closed", (event) => {
   event.preventDefault(); // Prevent the default behavior of quitting the app
});

//#region AutoUpdater
autoUpdater.on("update-downloaded", () => {
   log.info("Update downloaded, restarting the app...");
   autoUpdater.quitAndInstall();
});

autoUpdater.on("checking-for-update", () => {
   log.info("Checking for updates...");
});

autoUpdater.on("update-available", () => {
   log.info("Update available, downloading...");
});

autoUpdater.on("update-not-available", () => {
   log.info("No updates available.");
});

autoUpdater.on("download-progress", (progress) => {
   log.info("Download progress:", progress.percent.toFixed(2) + "%");
});
//#endregion

function relaunchApp() {
   app.relaunch();
   app.exit();
}

if (!gotTheLock) {
   // If the lock is not acquired, quit the app
   app.quit();
} else {
   // If the lock is acquired, set up the event listener for second instances
   //#region Second Instance
   app.on("second-instance", () => {
      log.info("An instance of the app is already running.");
      // When another instance tries to run, this event will be triggered
      if (mainWindow && !mainWindow.isDestroyed()) {
         if (mainWindow.isMinimized()) mainWindow.restore();
         mainWindow.focus();
      }
   });
   //#endregion

   //#region App Ready
   app.on("ready", async () => {
      log.info("App started. Version:", app.getVersion());
      await waitForInternetConnection();

      autoUpdater.checkForUpdatesAndNotify();
      setInterval(() => {
         autoUpdater.checkForUpdatesAndNotify();
      }, 2 * 60 * 60 * 1000); // Check for updates every 2 hours

      process.on("unhandledRejection", (error) => {
         log.error("Unhandled promise rejection:", error);
         relaunchApp();
      });

      process.on("uncaughtException", (error) => {
         log.error("Uncaught exception:", error);
         relaunchApp();
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
            "System is going to sleep. Stopping the app to prevent data loss..."
         );
         store.set("break-start-time", new Date().toISOString());
         if (powerSaveId) {
            powerSaveBlocker.stop(powerSaveId);
            powerSaveId = null;
         }
      });

      powerMonitor.on("resume", async () => {
         log.info(
            "System resumed from sleep. Updating timecard with break if clockedIn..."
         );
         powerSaveId = powerSaveBlocker.start("prevent-app-suspension");
         //break addition when system resumes
         let breakStartTime = store.get("break-start-time");

         await waitForInternetConnection();

         // Capture the break end time after reconnection
         let breakEndTime = new Date().toISOString();
         let { userId, teamId } = store.get("user-ids");
         let timeCard = store.get("latest-time-card").latestTimeCard;
         let breakBody = {
            start: {
               dateTime: breakStartTime,
            },
            end: {
               dateTime: breakEndTime,
            },
         };
         if (
            timeCard.state === "clockedIn" &&
            !timeCard.breaks.some(
               (b) =>
                  b.start.dateTime === breakBody.start.dateTime &&
                  b.end.dateTime === breakBody.end.dateTime
            )
         ) {
            timeCard.breaks.push(breakBody);
            await updateTimeCard(userId, teamId, timeCard.id, timeCard)
               .catch(async (error) => {
                  log.error("Error updating timecard", {
                     statusCode: error.response?.status,
                     method: error.config.method,
                     url: error.config.url,
                     errorMessage: error.message,
                     requestData: error.config.data,
                     requestHeaders: error.config.headers,
                     responseData: error.response?.data,
                     callstack: error.stack,
                  });
               })
               .finally(() => {
                  relaunchApp();
                  store.delete("break-start-time");
               });
         } else {
            store.delete("break-start-time");
         }
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
         mainWindow = createWindow(450, 300); // Default size for email-input
         log.info("Displaying user configuration page...");
         mainWindow.loadFile("./src/pages/user-config.html");
         let userId;

         ipcMain.on("validate-user-details", async (event, userDetails) => {
            userId = await getUserId(userDetails.email);
            let teams = store.get("teams");
            teams = teams && teams.userId === userId ? teams.teams : null;
            if (!teams) {
               teams = await getTeams(userId);
               store.set("teams", { userId, teams });
            }
            if (
               teams.some((team) => team.displayName === userDetails.teamName)
            ) {
               event.sender.send("validationMessage", "Team name is valid.");
            } else {
               event.sender.send(
                  "validationMessage",
                  "Invalid team name. Please try again."
               );
            }
         });

         ipcMain.on("save-user-details", async (event, userDetails) => {
            // Save user details to the store
            if (mainWindow) {
               mainWindow.close();
            }
            // console.log("Received user details from renderer:", userDetails); // Debug log
            store.delete("teams");
            store.set("user-config", userDetails);
            userConfig = userDetails;
            await authenticateEmail();
            let teamId = await getTeamId(userId, userConfig.teamName).catch(
               async (error) => {
                  log.error("An error has occurred, relaunching the app...");
                  relaunchApp();
               }
            );
            store.set("user-ids", { userId, teamId });
            updateActivity();
            startMainLoop();
         });
      } else {
         updateActivity();
         startMainLoop();
      }
   });
   //#endregion

   //#region OTP Verification
   async function authenticateEmail() {
      return new Promise((resolve, reject) => {
         // Generate a random OTP
         const otp = crypto.randomInt(100000, 999999).toString();

         const userConfig = store.get("user-config");

         const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
               user: mail_id,
               pass: mail_pass,
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
         mainWindow = createWindow(450, 280);
         log.info("Displaying OTP verification page...");
         mainWindow.loadFile("./src/pages/verify-otp.html");

         ipcMain.on("verify-otp", (event, enteredOtp) => {
            if (enteredOtp === otp) {
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
   //#endregion

   // #region Main Loop
   async function startMainLoop() {
      if (isMainLoopActive) return;
      isMainLoopActive = true;
      //#region Store data
      const { email, teamName } = store.get("user-config") || {};
      let { userId, teamId } = store.get("user-ids") || {};
      let { owners } = store.get("owners") || {};
      let username = store.get("username") || (await getUsername(email));
      store.set("username", username);
      let userActive = store.get("user-active");
      let sharepointSiteId =
         store.get("sharepoint-data")?.siteId ||
         (await getDefaultSiteId().catch(async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         }));
      let sharepointListId =
         store.get("sharepoint-data")?.listId ||
         (await getListId(sharepointSiteId, "TimeCardLibrary"));
      let sharePointListItemId = await getSharePointListItemId(
         sharepointSiteId,
         sharepointListId,
         username
      ).catch(async (error) => {
         log.error("An error has occurred, relaunching the app...");
         relaunchApp();
      });

      store.set("sharepoint-data", {
         siteId: sharepointSiteId,
         listId: sharepointListId,
         listItemId: sharePointListItemId,
      });

      if (!owners) {
         // console.log("Fetching team owners...");
         owners = await getOwners(teamId).catch(async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         });
         store.set("owners", { owners });
      }
      //#endregion
      const latestTimeCard = await getLatestSession(userId, teamId).catch(
         async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         }
      );
      let timeCardId = latestTimeCard?.id;
      let state = latestTimeCard?.state;
      store.set("latest-time-card", { latestTimeCard });

      //#region Main Loop Logic
      if (await isTeamsRunning()) {
         if (state === "clockedOut" || state === "unknownFutureValue") {
            if (!isPromptOpen && !isReminderOpen && !isReminderLoopActive) {
               isPromptOpen = true;
               mainWindow = createWindow(450, 250);
               log.info("Displaying clock-in prompt...");
               mainWindow.loadFile("./src/pages/clock-in-prompt.html");
               mainWindow.webContents.on("did-finish-load", () => {
                  mainWindow.webContents.send(
                     "team-name",
                     store.get("user-config").teamName
                  );
               });
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
                        store.set("latest-time-card", {
                           latestTimeCard: timeCard,
                        });
                     } else {
                        if (!isReminderOpen && !isReminderLoopActive) {
                           // Check reminder flag again
                           isReminderOpen = true;
                           isReminderLoopActive = true;
                           if (mainWindow) mainWindow.close();
                           reminderWindow = createWindow(450, 250);
                           log.info("Displaying clock-in reminder...");
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

         if (userActive == false && state === "clockedIn") {
            let presence = await getPresence(userId).catch(async (error) => {
               log.error("An error has occurred, relaunching the app...");
               relaunchApp();
            });
            if (
               presence.activity !== "InACall" &&
               presence.activity !== "InAConferenceCall" &&
               presence.activity !== "InAMeeting" &&
               presence.activity !== "Presenting"
            ) {
               await startBreak(userId, teamId, timeCardId).catch(
                  async (error) => {
                     log.error("An error occurred, relaunching the app...");
                     relaunchApp();
                  }
               );
            }
         } else if (userActive && state === "onBreak") {
            await endBreak(userId, teamId, timeCardId).catch(async (error) => {
               log.error("An error has occurred, relaunching the app...");
               relaunchApp();
            });
         }
      } else {
         if (state === "clockedIn") {
            if (!isPromptOpen && !isReminderOpen) {
               isPromptOpen = true;
               mainWindow = createWindow(450, 250);
               log.info("Displaying clock-out prompt...");
               mainWindow.loadFile("./src/pages/clock-out-prompt.html");
               mainWindow.webContents.on("did-finish-load", () => {
                  mainWindow.webContents.send(
                     "team-name",
                     store.get("user-config").teamName
                  );
               });
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
         } else if (state === "onBreak") {
            await endBreak(userId, teamId, timeCardId).catch(async (error) => {
               log.error("An error has occurred, relaunching the app...");
               relaunchApp();
            });
         }
      }
      let lastUpdated = new Date().toLocaleString("en-US", {
         timeZone: "Asia/Kolkata",
      });
      store.set("last-updated", lastUpdated);
      if (!sharePointListItemId) {
         await sendDataToSharePointList(
            sharepointSiteId,
            sharepointListId,
            username,
            teamName,
            latestTimeCard,
            lastUpdated
         ).catch(async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         });
      } else {
         await updateDataSharePointList(
            sharepointSiteId,
            sharepointListId,
            sharePointListItemId,
            username,
            teamName,
            latestTimeCard,
            lastUpdated
         ).catch(async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         });
      }
      isMainLoopActive = false;
      setTimeout(startMainLoop, 8000); // Repeat every 8 seconds
      //#endregion
   }
   //#endregion

   //#region reminder loop
   async function startReminderLoop(reminderTime) {
      let scheduleClockInPrompt = async () => {
         if (reminderWindow) reminderWindow.close();
         isReminderLoopActive = true; // Set the flag to indicate the reminder loop is active
         await new Promise((resolve) =>
            setTimeout(resolve, reminderTime * 60000)
         );
         setTimeout(async () => {
            mainWindow = createWindow(450, 250);
            log.info("Displaying clock-in prompt...");
            mainWindow.loadFile("./src/pages/clock-in-prompt.html");
            mainWindow.webContents.on("did-finish-load", () => {
               mainWindow.webContents.send(
                  "team-name",
                  store.get("user-config").teamName
               );
            });
            ipcMain.once(
               "clock-in-confirmation",
               async (event, shouldClockIn) => {
                  if (shouldClockIn) {
                     let timeCard = await clockInSequence();
                     store.set("latest-time-card", {
                        latestTimeCard: timeCard,
                     });
                     if (mainWindow) mainWindow.close();
                     isReminderLoopActive = false;
                  } else {
                     // User chose not to clock in, reschedule the reminder loop
                     if (mainWindow) mainWindow.close();
                     reminderWindow = createWindow(450, 250);
                     log.info("Displaying clock-in reminder...");
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
   //#endregion

   //#region Clock In/Out Functions
   async function clockInSequence() {
      try {
         // console.log("Clocking In");
         let username = store.get("username");
         let { email, teamName } = store.get("user-config");
         let { userId, teamId } = store.get("user-ids");
         let { owners } = store.get("owners");
         let timeCard = await clockIn(userId, teamId).catch(async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
         });
         let clockedInTime = timeCard.clockInEvent.dateTime;
         const localClockedInTime = new Date(clockedInTime).toLocaleString();
         store.set("latest-time-card", { latestTimeCard: timeCard });
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
         log.error("Error while clocking in", {
            statusCode: error.response?.status,
            method: error.config.method,
            url: error.config.url,
            errorMessage: error.message,
            requestData: error.config.data,
            requestHeaders: error.config.headers,
            responseData: error.response?.data,
            callstack: error.stack,
         });
         relaunchApp();
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
         log.error("An error has occurred, relaunching the app...");
         relaunchApp();
      });
      latestTimeCard = await getLatestSession(userId, teamId).catch(
         async (error) => {
            log.error("An error has occurred, relaunching the app...");
            relaunchApp();
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
   //#endregion

   // Function to create a BrowserWindow with specific width and height
   function createWindow(width, height) {
      return new BrowserWindow({
         width: width,
         height: height,
         title: "AutoTimeClock",
         roundedCorners: true,
         webPreferences: {
            preload: path.join(__dirname, "scripts", "preload.js"),
            contextIsolation: true,
            nodeIntegration: true,
            devTools: app.isPackaged ? false : true,
         },
         alwaysOnTop: true,
         autoHideMenuBar: true,
         maximizable: false,
         minimizable: false,
      });
   }
}

const axios = require("axios");
const getAccessToken = require("./ms-auth").getAccessToken;
const log = require("electron-log");
const { calculateDuration, calculateActiveDuration } = require("./utils");

async function getLatestSession(userId, teamId) {
   const accessToken = await getAccessToken();
   try {
      const response = await axios.get(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards?$filter=userId eq '${userId}'`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );

      let timeCards = response.data.value;
      let nextLink = response.data["@odata.nextLink"];

      while (nextLink) {
         const nextResponse = await axios.get(nextLink, {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         });
         timeCards = timeCards.concat(nextResponse.data.value);
         nextLink = nextResponse.data["@odata.nextLink"];
      }

      const latestSession = timeCards
         .reverse()
         .find((timeCard) => timeCard.userId === userId);
      return latestSession;
   } catch (error) {
      log.error("Error fetching the latest session:", error);
      throw error;
   }
}

async function getTimeCardById(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards/${timeCardId}`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );
      return response.data;
   } catch (error) {
      log.error("Error fetching time card by ID:", error);
      throw error;
   }
}

async function clockIn(userId, teamId) {
   const accessToken = await getAccessToken();
   try {
      log.info("Attempting to clock in...");
      const response = await axios.post(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards/clockIn`,
         {}, // empty body
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );
      log.info("Successfully clocked in.");
      return response.data;
   } catch (error) {
      log.error("Error clocking in:", error);
      throw error;
   }
}

async function clockOut(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
      log.info("Attempting to clock out...");
      await axios.post(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards/${timeCardId}/clockOut`,
         {}, // empty body
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );
      log.info("Successfully clocked out.");
   } catch (error) {
      log.error("Error clocking out:", error);
      throw error;
   }
}

async function startBreak(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
      log.info("Attempting to start break...");
      const response = await axios.post(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards/${timeCardId}/startBreak`,
         {}, // empty body
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );
      log.info("Successfully started break.");
      return response.data;
   } catch (error) {
      log.error("Error starting break:", error);
      throw error;
   }
}

async function endBreak(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
      log.info("Attempting to end break...");
      const response = await axios.post(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards/${timeCardId}/endBreak`,
         {}, // empty body
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );
      log.info("Successfully ended break.");
      return response.data;
   } catch (error) {
      log.error("Error ending break:", error);
      throw error;
   }
}

async function getPresence(userId) {
   const accessToken = await getAccessToken();
   try {
      const response = await axios.get(
         `https://graph.microsoft.com/beta/users/${userId}/presence`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );
      return response.data;
   } catch (error) {
      log.error("Error fetching presence:", error);
      throw error;
   }
}

function generateClockInEmail(name, email, teamName, clockInTime) {
   return `
   <!DOCTYPE html>
   <html lang="en">
   <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
         body {
               font-family: Arial, sans-serif;
               color: #333;
               display: flex;
               justify-content: flex-start;
               align-items: center;
               margin: 0;
               background-color: var(--background-color);
         }
         .message-container {
               background-color: var(--background-color);
               border: 2px solid #4CAF50;
               border-radius: 10px;
               padding: 20px;
               width: auto;
               max-width: 500px;
               box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
               text-align: left;
         }
         .message-title {
               font-size: 1.2em;
               font-weight: bold;
               color: #4CAF50;
               margin-bottom: 15px;
         }
         .user-email, .team-name, .clock-in-time {
               font-size: 1em;
               color: #333;
               margin-bottom: 10px;
         }
         span {
               font-weight: bold;
         }
         .clock-in-time {
               font-size: 1.1em;
               color: #333;
         }
         @media (prefers-color-scheme: dark) {
            body {
               --background-color: rgb(46,46,46);
               color: #f5f5f5;
            }
         }
         @media (prefers-color-scheme: light) {
            body {
               --background-color: #f5f5f5;
               color: #333;
            }
         }
      </style>
   </head>
   <body>
      <div class="message-container">
         <div class="message-title">Clock-in Notification</div>
         <div class="user-email">User: <span>${name} (${email})</span></div>
         <div class="team-name">Team: <span>${teamName}</span></div>
         <div class="clock-in-time">Clocked in at: <span>${clockInTime}</span></div>
      </div>
   </body>
   </html>
 `;
}

function generateSummaryEmail(name, email, teamName, timeCard) {
   const clockInTime = new Date(
      timeCard.clockInEvent.dateTime
   ).toLocaleString();
   const clockOutTime = new Date(
      timeCard.clockOutEvent.dateTime
   ).toLocaleString();
   const breaks = timeCard.breaks.map((breakItem) => ({
      start: new Date(breakItem.start.dateTime).toLocaleString(),
      end: new Date(breakItem.end.dateTime).toLocaleString(),
      duration: calculateDuration(
         breakItem.start.dateTime,
         breakItem.end.dateTime
      ),
   }));
   const totalDuration = calculateDuration(
      timeCard.clockInEvent.dateTime,
      timeCard.clockOutEvent.dateTime
   );

   const breakDurationMs = timeCard.breaks.reduce((total, current) => {
      return (
         total +
         (new Date(current.end.dateTime) - new Date(current.start.dateTime))
      );
   }, 0);

   // Calculate active duration and total time in milliseconds
   const activeDuration = calculateActiveDuration(
      timeCard.clockInEvent.dateTime,
      timeCard.clockOutEvent.dateTime,
      breakDurationMs
   );

   // Format breaks as a table rows
   const breaksRows = breaks
      .map(
         (breakItem, index) => `
       <tr>
         <td>Break ${index + 1}</td>
         <td>${breakItem.start}</td>
         <td>${breakItem.end}</td>
         <td>${breakItem.duration}</td>
       </tr>
     `
      )
      .join("");

   // Conditionally add the breaks table
   const breaksTable =
      breaks.length > 0
         ? `
     <h3>Break Details</h3>
     <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 650px;">
       <tr style="background-color: #f2f2f2;">
         <th>Break</th>
         <th>Start Time</th>
         <th>End Time</th>
         <th>Duration</th>
       </tr>
       ${breaksRows}
     </table>
   `
         : ""; // If no breaks, leave this as an empty string

   return `
   <html>
     <body style="font-family: Arial, sans-serif; color: #333;">
       <h2>Timecard Summary for ${name}</h2>
       <p><strong>User:</strong> ${name} (${email})</p>
       <p><strong>Team:</strong> ${teamName}</p>
       <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 650px;">
         <tr style="background-color: #f2f2f2;">
           <th>Clock-In Time</th>
           <th>Clock-Out Time</th>
           <th>Active Duration</th>
           <th>Total Duration</th>
         </tr>
         <tr>
           <td>${clockInTime}</td>
           <td>${clockOutTime}</td>
           <td>${activeDuration}</td>
           <td>${totalDuration}</td>
         </tr>
       </table>
       ${breaksTable} <!-- Only shows the breaks table if there are breaks -->
       <i style="font-size: 12px; color: #777;">This is an automated email from the AutoTimeClock app.</i>
     </body>
   </html>
 `;
}

module.exports = {
   getLatestSession,
   getTimeCardById,
   clockIn,
   clockOut,
   startBreak,
   endBreak,
   getPresence,
   generateClockInEmail,
   generateSummaryEmail,
};

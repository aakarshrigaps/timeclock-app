const axios = require("axios");
const getAccessToken = require("./ms-auth").getAccessToken;
const log = require('electron-log');

async function getLatestSession(userId, teamId) {
   const accessToken = await getAccessToken();
   try {
      const response = await axios.get(
         `https://graph.microsoft.com/beta/teams/${teamId}/schedule/timeCards`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "MS-APP-ACTS-AS": userId,
            },
         }
      );

      const timeCards = response.data.value;
      const latestSession = timeCards
         .reverse()
         .find((timeCard) => timeCard.userId === userId);
      return latestSession;
   } catch (error) {
      log.error("Error fetching the latest session:", error);
      throw error;
   }
}

async function clockIn(userId, teamId) {
   const accessToken = await getAccessToken();
   try {
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
      return response.data;
   } catch (error) {
      log.error("Error clocking in:", error);
      throw error;
   }
}

async function clockOut(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
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
   } catch (error) {
      log.error("Error clocking out:", error);
      throw error;
   }
}

async function startBreak(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
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
      return response.data;
   } catch (error) {
      log.error("Error starting break:", error);
      throw error;
   }
}

async function endBreak(userId, teamId, timeCardId) {
   const accessToken = await getAccessToken();
   try {
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

module.exports = {
   getLatestSession,
   clockIn,
   clockOut,
   startBreak,
   endBreak,
   getPresence,
};

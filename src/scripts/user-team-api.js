const axios = require("axios");
const getAccessToken = require("./ms-auth").getAccessToken;
const log = require("electron-log");

async function getUserId(email) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/users/${email}?$select=id`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );

      return response.data.id;
   } catch (error) {
      log.error(
         "Error fetching user ID:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function getUsername(userId) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/users/${userId}?$select=displayName`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );

      return response.data.displayName;
   } catch (error) {
      console.log(
         "Error fetching username:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function getTeams(userId) {
   const accessToken = await getAccessToken();

   try {
      let teams = [];
      let url = `https://graph.microsoft.com/v1.0/users/${userId}/joinedTeams?$select=id,displayName`;

      while (url) {
         const response = await axios.get(url, {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         });

         teams = teams.concat(response.data.value);
         url = response.data["@odata.nextLink"];
      }

      return teams;
   } catch (error) {
      log.error(
         "Error fetching teams:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function getTeamId(userId, teamName) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/users/${userId}/joinedTeams?$select=id,displayName`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );

      const teams = response.data.value;
      const team = teams.find((team) => team.displayName === teamName);
      return team ? team.id : null;
   } catch (error) {
      log.error(
         "Error fetching team ID:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function getOwners(teamId) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/groups/${teamId}/owners?$select=mail`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );

      if (response.data.value && response.data.value.length >= 1) {
         const mails = response.data.value.map((item) => item.mail);
         return mails;
      } else {
         return [];
      }
   } catch (error) {
      log.error(
         "Error fetching owners:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function notifyUserAndTeam(
   userId,
   subject,
   message,
   messageType = "text",
   to = [],
   cc = []
) {
   const accessToken = await getAccessToken();

   // Ensure 'to' and 'cc' are arrays
   if (!Array.isArray(to)) {
      log.info("Expected 'to' to be an array.");
      to = [];
   }
   if (!Array.isArray(cc)) {
      log.info("Expected 'cc' to be an array.");
      cc = [];
   }

   // Prepare the mail options
   const mailOptions = {
      message: {
         subject: subject,
         body: {
            contentType: messageType,
            content: message,
         },
         toRecipients: to.map((email) => ({
            emailAddress: { address: email },
         })),
         ccRecipients: cc.map((email) => ({
            emailAddress: { address: email },
         })),
      },
   };

   // Log the request body for debugging
   // console.log( "Request body for sending mail:", JSON.stringify(mailOptions, null, 2));

   try {
      log.info("Attempting to send email notification to user and team.");
      await axios.post(
         `https://graph.microsoft.com/v1.0/users/${userId}/sendMail`,
         mailOptions,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "Content-Type": "application/json",
            },
         }
      );
      log.info("Email sent successfully.");
   } catch (error) {
      log.error("Error sending email:", error.response.data);
      throw error; // Optionally re-throw the error if you want to handle it further up the call stack
   }
}

module.exports = {
   getUserId,
   getTeams,
   getUsername,
   getTeamId,
   getOwners,
   notifyUserAndTeam,
};

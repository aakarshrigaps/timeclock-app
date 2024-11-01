const axios = require("axios");
const getAccessToken = require("./ms-auth").getAccessToken;

async function getUserId(email) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/users/${email}`,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
         }
      );

      return response.data.id;
   } catch (error) {
      console.error(
         "Error fetching user ID:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function getTeamId(userId, teamName) {
   const accessToken = await getAccessToken();

   try {
      const response = await axios.get(
         `https://graph.microsoft.com/v1.0/users/${userId}/joinedTeams`,
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
      console.error(
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
         `https://graph.microsoft.com/v1.0/groups/${teamId}/owners`,
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
      console.error(
         "Error fetching owners:",
         error.response ? error.response.data : error.message
      );
      throw error;
   }
}

async function notifyUserAndTeam(userId, subject, message, to = [], cc = []) {
   const accessToken = await getAccessToken();

   // Ensure 'to' and 'cc' are arrays
   if (!Array.isArray(to)) {
      console.error("Expected 'to' to be an array.");
      to = [];
   }
   if (!Array.isArray(cc)) {
      console.error("Expected 'cc' to be an array.");
      cc = [];
   }

   // Prepare the mail options
   const mailOptions = {
      message: {
         subject: subject,
         body: {
            contentType: "Text",
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
      // console.log("Email sent successfully.");
   } catch (error) {
      console.error("Error sending email:", error.response.data);
      throw error; // Optionally re-throw the error if you want to handle it further up the call stack
   }
}

async function sendHtmlReport(userId, subject, htmlMessage, to = [], cc = []) {
   const accessToken = await getAccessToken();

   // Ensure
   if (!Array.isArray(to)) {
      console.error("Expected 'to' to be an array.");
      to = [];
   }
   if (!Array.isArray(cc)) {
      console.error("Expected 'cc' to be an array.");
      cc = [];
   }

   // Prepare the mail options
   const mailOptions = {
      message: {
         subject: subject,
         body: {
            contentType: "html",
            content: htmlMessage,
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
      // console.log("Email sent successfully.");
   } catch (error) {
      console.error("Error sending email:", error.response.data);
      throw error; // Optionally re-throw the error if you want to handle it further up the call stack
   }
}

module.exports = {
   getUserId,
   getTeamId,
   getOwners,
   notifyUserAndTeam,
   sendHtmlReport,
};
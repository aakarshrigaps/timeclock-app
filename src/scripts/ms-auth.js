require("dotenv").config();
const msal = require("@azure/msal-node");
const { client_id, tenant_id, client_secret } = require("./decrypt-secrets");
const log = require('electron-log');

let accessToken = null;
let tokenExpiresAt = null;


// MSAL configuration
const msalConfig = {
   auth: {
      clientId: client_id,
      authority: `https://login.microsoftonline.com/${tenant_id}`,
      clientSecret: client_secret,
   },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

async function getAccessToken() {
   if (accessToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
      // console.log("Token is valid, returning cached token");
      return accessToken;
   }

   try {
      const authResponse = await cca.acquireTokenByClientCredential({
         scopes: ["https://graph.microsoft.com/.default"],
      });

      accessToken = authResponse.accessToken;
      tokenExpiresAt = authResponse.expiresOn;
      // console.log("New token acquired, returning new token");
      return accessToken;
   } catch (error) {
      log.error("Error acquiring token:", error);
      throw new Error("Failed to acquire access token");
   }
}


module.exports = { getAccessToken };

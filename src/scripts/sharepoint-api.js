const { getAccessToken } = require("./ms-auth");
const axios = require("axios");
const log = require("electron-log");

async function getDefaultSiteId() {
   const accessToken = await getAccessToken();
   const response = await axios.get(
      "https://graph.microsoft.com/v1.0/sites/root?$select=id",
      {
         headers: {
            Authorization: `Bearer ${accessToken}`,
         },
      }
   );

   if (response.status !== 200) {
      throw new Error(`Error fetching default site ID: ${response.statusText}`);
   }
   return response.data.id;
}

async function getListId(siteId, listName) {
   const accessToken = await getAccessToken();
   const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=displayName eq '${listName}'&$select=id`,
      {
         headers: {
            Authorization: `Bearer ${accessToken}`,
         },
      }
   );

   if (response.status !== 200) {
      throw new Error(`Error fetching list ID: ${response.statusText}`);
   }

   if (response.data.value.length === 0) {
      throw new Error(`List '${listName}' not found.`);
   }

   return response.data.value[0].id;
}

async function updateSharePointList(siteId, listId) {
   const accessToken = await getAccessToken();

   try {
      const columns = [
         { name: "Date", type: "DateTime" },
         { name: "EmployeeName", type: "Text" },
         { name: "ClockInTime", type: "DateTime" },
         { name: "ClockOutTime", type: "DateTime" },
         { name: "Breaks", type: "Text", allowMultipleLines: true },
         { name: "State", type: "Text" },
         { name: "Availability", type: "Text" },
      ];

      const columnPromises = columns.map(async (column) => {
         const columnPayload = {
            name: column.name,
         };

         // Add type-specific properties
         if (column.type === "Text") {
            columnPayload.text = {
               allowMultipleLines: column.allowMultipleLines || false,
               maxLength: 255,
            };
         } else if (column.type === "DateTime") {
            columnPayload.dateTime = {
               format: "dateTime",
            };
         }

         const columnResponse = await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`,
            columnPayload,
            {
               headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
               },
            }
         );

         log.info(`Column ${column.name} created successfully.`);
         return columnResponse.data;
      });

      await Promise.all(columnPromises);
      log.info("All columns added successfully.");

      return listData; // Return the created list data
   } catch (error) {
      log.error("Error creating SharePoint list:", error);
      throw error; // Rethrow error for further handling
   }
}

async function getSharePointListItemId(siteId, listId, username) {
   const accessToken = await getAccessToken();
   const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$filter=fields/EmployeeName eq '${username}' and fields/Date eq '${
         new Date()
            .toLocaleString("en-IN", {
               timeZone: "Asia/Kolkata",
               year: "numeric",
               month: "2-digit",
               day: "2-digit",
            })
            .split(",")[0]
      }'&$select=id`,
      {
         headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
         },
      }
   );

   if (response.status !== 200) {
      throw new Error(
         `Error fetching SharePoint list item ID: ${response.statusText}`
      );
   }

   if (response.data.value.length === 0) {
      return null;
   }

   return response.data.value[0].id;
}

async function sendDataToSharePointList(
   siteId,
   listId,
   username,
   teamName,
   latestTimeCard,
   userStatus,
   lastUpdated
) {
   const accessToken = await getAccessToken();
   //#region Extracting data from latestTimeCard and userStatus
   const today = new Date()
      .toLocaleString("en-IN", {
         timeZone: "Asia/Kolkata",
         year: "numeric",
         month: "2-digit",
         day: "2-digit",
      })
      .split(",")[0];
   const clockInTime = latestTimeCard.clockInEvent?.dateTime
      ? new Date(latestTimeCard.clockInEvent?.dateTime).toLocaleString(
           "en-IN",
           {
              timeZone: "Asia/Kolkata",
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
           }
        )
      : "⌛";

   if (latestTimeCard.clockInEvent?.dateTime) {
      const clockInDate = new Date(latestTimeCard.clockInEvent.dateTime)
         .toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
         })
         .split(",")[0];

      if (clockInDate !== today) {
         log.info("Clock-in date is not today. Skipping data send.");
         return;
      }
   }

   const clockOutTime = latestTimeCard.clockOutEvent?.dateTime
      ? new Date(latestTimeCard.clockOutEvent?.dateTime).toLocaleString(
           "en-IN",
           {
              timeZone: "Asia/Kolkata",
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
           }
        )
      : "⌛";

   const breakData = latestTimeCard.breaks.map(
      (b) =>
         `Start: ${
            b?.start?.dateTime
               ? new Date(b.start.dateTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                 })
               : "⌛"
         } ➜ End: ${
            b?.end?.dateTime
               ? new Date(b.end.dateTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                 })
               : "⌛"
         }`
   );
   const stateIcon =
      latestTimeCard.state === "clockedIn"
         ? "✅"
         : latestTimeCard.state === "clockedOut"
         ? "❌"
         : latestTimeCard.state === "onBreak"
         ? "⏸️"
         : "❓";

   const availabilityIcon =
      userStatus.availability === "Available"
         ? "🟢"
         : userStatus.availability === "Busy" ||
           userStatus.availability === "BusyIdle"
         ? "🔴"
         : userStatus.availability === "Away" ||
           userStatus.availability === "BeRightBack" ||
           userStatus.availability === "AvailableIdle"
         ? "🟡"
         : userStatus.availability === "DoNotDisturb"
         ? "⛔"
         : userStatus.availability === "Offline"
         ? "⚪"
         : "❓";
   //#endregion
   try {
      const payload = {
         fields: {
            Date: today,
            EmployeeName: username,
            TeamName: teamName,
            ClockIn: clockInTime,
            ClockOut: clockOutTime,
            Breaks: breakData.join("\n"),
            State: stateIcon + latestTimeCard.state,
            Availability: availabilityIcon + userStatus.availability,
            LastUpdated: lastUpdated,
         },
      };
      const response = await axios.post(
         `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
         payload,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "Content-Type": "application/json",
            },
         }
      );

      if (response.status !== 201) {
         throw new Error(
            `Error creating item in SharePoint list: ${response.statusText}`
         );
      }

      log.info("Data sent to SharePoint list successfully.");
   } catch (error) {
      log.error("Error sending data to SharePoint list:", error.response?.data);
      throw error; // Rethrow error for further handling
   }
}

async function updateDataSharePointList(
   siteId,
   listId,
   listItemId,
   username,
   teamName,
   latestTimeCard,
   userStatus,
   lastUpdated
) {
   const accessToken = await getAccessToken();

   //#region data initialization
   const today = new Date()
      .toLocaleString("en-IN", {
         timeZone: "Asia/Kolkata",
         year: "numeric",
         month: "2-digit",
         day: "2-digit",
      })
      .split(",")[0];
   const clockInTime = latestTimeCard.clockInEvent?.dateTime
      ? new Date(latestTimeCard.clockInEvent?.dateTime).toLocaleString(
           "en-IN",
           {
              timeZone: "Asia/Kolkata",
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
           }
        )
      : "⌛";

   if (latestTimeCard.clockInEvent?.dateTime) {
      const clockInDate = new Date(latestTimeCard.clockInEvent.dateTime)
         .toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
         })
         .split(",")[0];

      if (clockInDate !== today) {
         // log.info("Clock-in date is not today. Skipping data send.");
         return;
      }
   }
   const clockOutTime = latestTimeCard.clockOutEvent?.dateTime
      ? new Date(latestTimeCard.clockOutEvent?.dateTime).toLocaleString(
           "en-IN",
           {
              timeZone: "Asia/Kolkata",
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
           }
        )
      : "⌛";

   const breakData = latestTimeCard.breaks.map(
      (b) =>
         `Start: ${
            b?.start?.dateTime
               ? new Date(b.start.dateTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                 })
               : "⌛"
         } ➜ End: ${
            b?.end?.dateTime
               ? new Date(b.end.dateTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                 })
               : "⌛"
         }`
   );
   const stateIcon =
      latestTimeCard.state === "clockedIn"
         ? "✅"
         : latestTimeCard.state === "clockedOut"
         ? "❌"
         : latestTimeCard.state === "onBreak"
         ? "⏸️"
         : "❓";
   const availabilityIcon =
      userStatus.availability === "Available"
         ? "🟢"
         : userStatus.availability === "Busy" ||
           userStatus.availability === "BusyIdle"
         ? "🔴"
         : userStatus.availability === "Away" ||
           userStatus.availability === "BeRightBack" ||
           userStatus.availability === "AvailableIdle"
         ? "🟡"
         : userStatus.availability === "DoNotDisturb"
         ? "⛔"
         : userStatus.availability === "Offline"
         ? "⚪"
         : "❓";

   //#endregion
   try {
      const payload = {
         fields: {
            Date: today,
            EmployeeName: username,
            TeamName: teamName,
            ClockIn: clockInTime,
            ClockOut: clockOutTime,
            Breaks: breakData.join("\n"),
            State: stateIcon + latestTimeCard.state,
            Availability: availabilityIcon + userStatus.availability,
            LastUpdated: lastUpdated,
         },
      };
      const response = await axios.patch(
         `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${listItemId}`,
         payload,
         {
            headers: {
               Authorization: `Bearer ${accessToken}`,
               "Content-Type": "application/json",
            },
         }
      );

      if (response.status !== 200) {
         throw new Error(
            `Error updating item in SharePoint list: ${response.statusText}`
         );
      }

      // log.info("Data updated in SharePoint list successfully.");
   } catch (error) {
      log.error(
         "Error updating data in SharePoint list:",
         error.response?.data
      );
      throw error; // Rethrow error for further handling
   }
}

module.exports = {
   getDefaultSiteId,
   getListId,
   updateSharePointList,
   getSharePointListItemId,
   sendDataToSharePointList,
   updateDataSharePointList,
};

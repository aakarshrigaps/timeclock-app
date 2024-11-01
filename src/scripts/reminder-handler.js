const { ipcRenderer } = window.electron;
function validateInput() {
   const input = document.getElementById("reminder-time");
   const okButton = document.getElementById("ok-button");
   const value = input.value.trim();

   // Check if input is a valid number and greater than or equal to 1
   if (!isNaN(value) && parseInt(value) >= 1) {
      okButton.disabled = false;
   } else {
      okButton.disabled = true;
   }
}

function setReminder() {
   const reminderTime = document.getElementById("reminder-time").value;
   if (reminderTime) {
      ipcRenderer.send("set-reminder", reminderTime);
   }
}

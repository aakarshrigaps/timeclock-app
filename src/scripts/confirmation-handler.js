const { ipcRenderer } = window.electron;

function confirmClockIn(isConfirmed) {
   if (isConfirmed) {
      ipcRenderer.send("clock-in-confirmation", true);
   } else {
      ipcRenderer.send("clock-in-confirmation", false);
   }
}

function confirmClockOut(isConfirmed){
   if (isConfirmed) {
      ipcRenderer.send("clock-out-confirmation", true);
   } else {
      ipcRenderer.send("clock-out-confirmation", false);
   }
}

function updateCurrentTime() {
   const currentTimeElement = document.getElementById("current-time");
   const now = new Date();
   const currentTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
   });
   currentTimeElement.textContent = currentTime;
}

// Update the time when the page loads and every second
window.onload = function () {
   updateCurrentTime(); // Initial call to set the time
   setInterval(updateCurrentTime, 1000); // Update time every second (1000 ms)
};
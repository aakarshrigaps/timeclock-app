const { ipcRenderer } = window.electron;
document
   .getElementById("otp-form")
   .addEventListener("submit", function (event) {
      event.preventDefault();
      const otp = document.getElementById("otp").value;

      // Send the OTP to the main process
      ipcRenderer.send("verify-otp", otp);
   });

// Listen for the "otp-error" message from the main process
ipcRenderer.on("otp-error", (event, message) => {
   const errorElement = document.getElementById("otp-error");
   errorElement.textContent = message;
});

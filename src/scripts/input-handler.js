const { ipcRenderer } = window.electron;

ipcRenderer.on("validationMessage", (event, message) => {
    const validationMessageDiv = document.getElementById('validationMessage');
    const submitButton = document.getElementById('submit');
    validationMessageDiv.textContent = message;
    validationMessageDiv.style.color = message.includes("Invalid") ? 'tomato' : 'lime';
    submitButton.disabled = message.includes("Invalid");
});

document.getElementById('teamName').addEventListener('input', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const teamName = document.getElementById('teamName').value;   
    ipcRenderer.send('validate-user-details', { email, teamName });
});

document.getElementById('userForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const teamName = document.getElementById('teamName').value;
    // Log details for debugging
    // console.log('Form submitted with:', { email, teamName });

    ipcRenderer.send('save-user-details', { email, teamName });
});

const { ipcRenderer } = window.electron;

ipcRenderer.on("validationMessage", (event, message) => {
    const validationMessageDiv = document.getElementById('validationMessage');
    validationMessageDiv.textContent = message;
    validationMessageDiv.style.color = message.includes("Invalid") ? 'tomato' : 'lime';
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

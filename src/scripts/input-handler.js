const { ipcRenderer } = window.electron;

document.getElementById('userForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const teamName = document.getElementById('teamName').value;
    // Log details for debugging
    // console.log('Form submitted with:', { email, teamName });

    ipcRenderer.send('save-user-details', { email, teamName });
});

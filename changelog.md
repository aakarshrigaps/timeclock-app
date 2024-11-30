# Changelog

## [2.6.3] - 2024-11-30
### 🚀 Enhancements
- **Added Inactivity Detection**: Implemented inactivity detection to automatically start and end breaks based on user activity.
- **Removed `/presence` API Usage**: Removed the `/presence` API usage for inactivity detection and break status updates.

## [2.6.2] - 2024-11-30
### 🐞 Bug fixes
- Fixed data to be sent in the SharePoint list only if the clock in date is the same as the current date.

## [2.6.1] - 2024-11-29
### 🐞 Bug fixes
- Fixed timestamps in SharePoint integration to use the Indian Standard Time (IST) zone by default.

## [2.6.0] - 2024-11-29
### 🚀 Enhancements
- **Added SharePoint Integration**: Implemented SharePoint integration to allow app to send periodic updates to SharePoint lists.

## [2.5.12] - 2024-11-28
### 🐞 Bug fixes
- Fixed potential issue with `checkInternetConnection` function.
- Relaunched app on any unhandled rejections or uncaught exceptions.

## [2.5.11] - 2024-11-25
### 🚀 Enhancements
- **Break Status Update**: Added `AvailableIdle` status check for breaks.

---

## [2.5.10] - 2024-11-25
### 🔧 Other Changes
- Disabled devtools in the packaged app.

---

## [2.5.9] - 2024-11-22
### 🚀 Enhancements
- **Check for Internet Connection**: Added a check for an active internet connection before performing any network requests to reduce unnecessary offline requests.

---

## [2.5.8] - 2024-11-22
### 🚀 Enhancements
- **Enhanced Error Logging in API Calls**: Improved error logging for API calls to provide more detailed information in case of failures.

---

## [2.5.7] - 2024-11-21
### 🛠️ Code Improvements
- **Break Addition Logic on System Resume**: Added logic to handle the addition of breaks when the system is resumed from sleep.

### 🚀 Enhancements
- **Enhanced Error Logging in API Calls**: Improved error logging for API calls to provide more detailed information in case of failures.

---

## [2.5.6] - 2024-11-20
### ⚙️ User Configuration and Workflow
- **User Configuration Validation**: Added validation for initial user configuration when entering the team name to ensure proper setup.
- **Fetching Teams**: Updated to use the `/v1.0/users/{userId}/joinedTeams` endpoint instead of `/v1.0/teams`, ensuring that only the teams the current user is a member of are fetched.

### 🎨 User Interface Enhancements
- **Time Zone Display**: A time zone field has been added next to dates in notification emails.

### 🚀 Additional Enhancements
- **Updated User Configuration UI and Functionality**: Revamped the user-config interface and improved customization options for a better user experience.
- **Improved OTP Page**: Optimized layout, responsiveness, and visual feedback for a more user-friendly experience.

### 🐞 Bug Fixes
- Fixed minor UI layout issues across different screen sizes and modes.

---

## [2.5.5] - 2024-11-19
### 🐞 Bug Fixes
- Fixed race condition issues in the main loop.

### 🔧 Other Changes
- Added logger for main actions like clock in/out, start/end break.
- Implemented periodic update checks.

---

## [2.5.4] - 2024-11-18
### 🛠️ Code Improvements
- **Removed Unused Dependencies**: Cleaned up the project by removing unused dependencies to reduce bundle size and improve performance.

---

## [2.5.3] - 2024-11-17
### 🚀 Additional Enhancements
- **Graceful Clock-Out Handler**: Added break-ending handling before attempting to clock out.

---

## [2.5.2] - 2024-11-17
### ⏱️ Clock In/Out Enhancements
- **Title and Header Text**: The header and title for the windows on all pages were updated to be more concise.

### 🐞 Bug Fixes
- Fixed race condition issues in the main loop.

---

## [2.5.1] - 2024-11-16
### 🚀 Additional Enhancements
- **Updated User Configuration UI and Functionality**: Revamped the user-config interface and improved customization options for a better user experience.
- **Improved OTP Page**: Optimized layout, responsiveness, and visual feedback for a more user-friendly experience.
- **Refined Tooltip Colors in User Configuration**: Enhanced tooltip color scheme for improved visibility and consistency.

### 🔧 Other Changes
- Updated dependencies for improved stability.

### 🐞 Bug Fixes
- Fixed minor UI layout issues across different screen sizes and modes.

---

## [2.5.0] - 2024-11-15
### 🛠️ Code Improvements
- **Removed Unused Dependencies**: Cleaned up the project by removing unused dependencies to reduce bundle size and improve performance.
- **Improved Main Loop Handling**: Optimized the main loop by separating presence updates from the main loop, improving performance and reliability.

### ⚙️ User Configuration and Workflow
- **User Configuration Validation**: Added validation for initial user configuration when entering the team name to ensure proper setup.

### ⏱️ Clock In/Out Enhancements
- **Team Name Display**: The team name is now shown during the clock in/out process for better clarity and user experience.

### 📊 API Performance
- **Improved API Performance**: Enhanced the performance of API calls by utilizing the `$select` query parameter to fetch only necessary data, reducing response times.

### 🎨 User Interface Enhancements
- **Dark Mode & Light Mode Styles**: Added and improved dark mode and light mode styles for a consistent and visually appealing experience across both modes.

### 🐞 Bug Fixes
- Fixed minor UI layout issues across different screen sizes and modes.

### 🔧 Other Changes
- Updated dependencies for improved stability.

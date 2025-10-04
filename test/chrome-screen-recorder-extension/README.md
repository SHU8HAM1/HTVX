# Chrome Screen Recorder Extension

This Chrome extension allows users to record the screen of the current tab using the Chrome `currentTab` API. It provides a simple user interface for starting and stopping recordings.

## Features

- Record the screen of the current tab.
- Simple popup interface for user interaction.
- Manage recordings with start and stop functionality.

## Installation

1. Clone the repository or download the ZIP file.
2. Navigate to `chrome://extensions/` in your Chrome browser.
3. Enable "Developer mode" by toggling the switch in the top right corner.
4. Click on "Load unpacked" and select the `chrome-screen-recorder-extension` directory.

## Usage

1. Click on the extension icon in the Chrome toolbar.
2. Use the buttons in the popup to start or stop the screen recording.
3. The recorded video will be saved to your local storage.

## Files Overview

- **src/background.js**: Background script that manages the screen recording process.
- **src/recorder.js**: Handles the screen recording functionality.
- **src/popup.js**: Manages the popup interface and user interactions.
- **src/types/index.ts**: TypeScript interfaces and types used in the extension.
- **popup.html**: HTML structure for the popup interface.
- **styles.css**: Styles for the popup interface.
- **manifest.json**: Configuration file for the Chrome extension.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.
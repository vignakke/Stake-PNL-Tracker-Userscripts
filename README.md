# Stake PNL Tracker Userscripts

## Overview

This repository contains two userscripts designed to enhance your experience on Stake and its mirror sites by providing advanced Profit/Loss (PNL) tracking and statistics.

-   `pnl_tracker_enhanced.js`: A feature-rich script offering multi-session history, smart notifications for big wins, and a compact mini-mode for the PNL display.
-   `pnl_tracker_optimized.js`: A streamlined version focused on core PNL tracking with improved performance.

Both scripts track your PNL across multiple cryptocurrencies, provide detailed game-specific statistics, and allow you to export your data.

## Features

### `pnl_tracker_enhanced.js`
*   **Multi-Session History:** Track and review your PNL across different gaming sessions.
*   **Smart Notifications:** Get notified for big wins (e.g., 100x+ multipliers) with customizable sound and popup duration.
*   **Mini Mode:** A compact display option for the PNL tracker.
*   **Time-Based Statistics:** Hourly, daily, and weekly PNL and wagered stats.
*   **Detailed Game Statistics:** PNL, best multiplier, total bets, win rate, and recent bets per game.
*   **Multi-Currency Support:** Track PNL across various cryptocurrencies.
*   **Data Export:** Export your session data as CSV or an image summary.
*   **Draggable & Resizable Popups:** Customize the layout of your stats and history windows.

### `pnl_tracker_optimized.js`
*   **Optimized Performance:** A lighter version focusing on efficient PNL tracking.
*   **Detailed Game Statistics:** PNL, best multiplier, total bets, win rate, and recent bets per game.
*   **Multi-Currency Support:** Track PNL across various cryptocurrencies.
*   **Data Export:** Export your session data as CSV or an image summary.

## Installation

To use these userscripts, you need a browser extension like [ScriptCat](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf?hl=en).

1.  **Install ScriptCat:**
    *   Install ScriptCat from the [Chrome Web Store](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf?hl=en).

2.  **Configure ScriptCat for Chrome:**
    *   Go to the Chrome extensions page: `chrome://extensions`.
    *   Enable Developer mode
    *   In the extension management interface, find the ScriptCat extension and click "Details".
    *   In the ScriptCat extension details page, find the "Allow user scripts" option and enable it.
    *   Then disable and re-enable the extension, or restart the browser to make the script functionality effective.

3.  **Install the Userscript:**
    *   Click on the ScriptCat extension icon in your browser.
    *   Select "Create a new script..."
    *   Delete any existing code in the editor.
    *   Open either `pnl_tracker_enhanced.js` or `pnl_tracker_optimized.js` from this repository in a text editor.
    *   Copy the entire content of the chosen `.js` file.
    *   Paste the copied code into the ScriptCat editor.
    *   Save the script (usually `Ctrl + S` or `File > Save`).

## Usage

1.  **Navigate to Stake:** Once installed, the script will automatically activate when you visit Stake or any of its mirrored domains.
2.  **Start a Session:**
    *   A PNL tracker element will appear on the Stake interface (usually near your balance).
    *   Click on the PNL tracker to start a new session. You will be prompted to select the cryptocurrencies you wish to track and your preferred display fiat currency.
3.  **View Statistics:**
    *   Click the "📊" button (stats button) to open the PNL statistics popup, showing detailed information per game.
    *   (For `pnl_tracker_enhanced.js` only) Click the "📜" button (history button) to view your session history and time-based statistics.
4.  **Stop a Session:** Click on the PNL tracker again to end the current session.

## Contributing

Feel free to fork the repository, make improvements, and submit pull requests.
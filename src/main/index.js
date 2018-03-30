'use strict';

import { app, screen, BrowserWindow } from 'electron'
import * as path from 'path'
import { format as formatUrl } from 'url'

import './repository';
import './network';
import './installMod';
import {loadDB} from "./db";

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow;

function createMainWindow() {
	const cursorPos = screen.getCursorScreenPoint();
	const currentScreen = screen.getDisplayNearestPoint(cursorPos);

	const window = new BrowserWindow({
		titleBarStyle: 'hiddenInset',
		width: Math.min(800, currentScreen.size.width * 0.5),
		height: currentScreen.size.height * 0.75
	});

	window.setMinimumSize(600, 400);

	if (isDevelopment) {
		window.webContents.openDevTools()
	}

	if (isDevelopment) {
		window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
	} else {
		window.loadURL(formatUrl({
			pathname: path.join(__dirname, 'index.html'),
			protocol: 'file',
			slashes: true
		}))
	}

	window.on('closed', () => {
		mainWindow = null
	});

	return window
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
	// on macOS it is common for applications to stay open until the user explicitly quits
	if (process.platform !== 'darwin') {
		app.quit()
	}
});

app.on('activate', () => {
	// on macOS it is common to re-create a window even after all windows have been closed
	if (mainWindow === null) {
		mainWindow = createMainWindow()
	}
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
	loadDB();
	mainWindow = createMainWindow();
});

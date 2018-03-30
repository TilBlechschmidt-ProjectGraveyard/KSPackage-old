import settings from 'electron-settings';
import { ipcMain } from 'electron';

import config from '../config.json';

export class Game {
	static get location() {
		return settings.get('game.location') || config.settings.game.location;
	}

	static set location(newLocation) {
		settings.set('game.location', newLocation);
	}

	static get version() {
		return settings.get('game.version') || config.settings.game.version;
	}

	static set version(newVersion) {
		settings.set('game.version', newVersion);
	}

	constructor() {}
}

ipcMain.on('setGameLocation', (_, args) => Game.location = args);
ipcMain.on('setGameVersion', (_, args) => Game.version = args);

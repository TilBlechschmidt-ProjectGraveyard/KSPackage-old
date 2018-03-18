import Datastore from 'nedb';
import { app } from 'electron';
import path from 'path';

const appDir = app.getPath('userData');

export const modDB = new Datastore({ filename: path.join(appDir, 'repository.db') });
export const installedDB = new Datastore({ filename: path.join(appDir, 'installedMods.db') });

export function loadDB() {
	modDB.loadDatabase();
	installedDB.loadDatabase();
}

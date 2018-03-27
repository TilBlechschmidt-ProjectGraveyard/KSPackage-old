import config from '../config.json';

import tmp from 'tmp';
import yauzl from 'yauzl';
import { ipcMain } from 'electron';

import { modDB, installedDB } from "./db";
import { downloadFile } from './network';
import {getLatestVersions, modIsCompatible, versionCompare} from "./installMod";

const decompressNotifyInterval = 250; // Files

let fetching = false;
let kspVersion = config.game.version;

function filterMods(modList) {
	// Match the game version compatibility
	const compatible = modList.filter(mod => modIsCompatible(mod, kspVersion));

	// Reduce to only one version per mod
	return getLatestVersions(compatible);
}

export function sendModsToClient(sender) {
	modDB.find({}).sort({ name: 1 }).exec((err, docs) => {
		if (!err) sender.send('modList', filterMods(docs));
	});
	installedDB.find({}).exec((err, docs) => {
		if (!err) sender.send('installedMods', docs);
	});
}

ipcMain.on('fetchRepository', (event) => {
	sendModsToClient(event.sender);
	// TODO Find a better solution
	// Maybe update individual entries instead of replacing the whole DB
	// which wipes DB keys ...
	// modDB.remove({}, { multi: true }, (err) => {
		if (fetching) return;
		else fetching = true;

		const newEntries = [];
		const tmpDir = tmp.dirSync({ unsafeCleanup: true });
		const tmpFile = tmpDir.name + '/file.zip';
		return downloadFile(config.repository.url, tmpFile, (progress) => {
			event.sender.send('repositoryFetchProgress', progress * 0.5);
		}).then(() => {
			yauzl.open(tmpFile, {lazyEntries: true}, function(err, zipfile) {
				if (err) throw err;

				const entryCount = zipfile.entryCount;
				let decompressedCount = 0;

				zipfile.readEntry();
				zipfile.on("entry", function(entry) {
					if (/\/$/.test(entry.fileName)) {
						// Directory file names end with '/'.
						// Note that entries for directories themselves are optional.
						// An entry's fileName implicitly requires its parent directories to exist.
						decompressedCount++;
						zipfile.readEntry();
					} else {
						// file entry
						zipfile.openReadStream(entry, function(err, readStream) {
							if (err) throw err;

							let data = "";

							readStream.on("end", function() {
								// Save the current entry in the DB
								try {
									const parsed = JSON.parse(data);
									parsed.id = `${parsed.identifier}---${parsed.version}`;
									if (!parsed.repositories && !parsed.builds) {// Filter out the repositories
										newEntries.push(parsed);
									}
								} catch (err) {}

								// Send status updates
								decompressedCount++;
								if (decompressedCount % decompressNotifyInterval === 0)
									event.sender.send('repositoryFetchProgress', (decompressedCount / entryCount) * 0.5 + 0.5);

								// Read the next entry
								zipfile.readEntry();
							});

							readStream.on("data", function (chunk) {
								data += chunk;
							});
						});
					}
				});

				zipfile.on('end', () => {
					modDB.remove({}, { multi: true }, (rmErr, rmCount) => {
						modDB.insert(newEntries, (insErr, docs) => {
							event.sender.send('repositoryFetchProgress', 1);
							sendModsToClient(event.sender);

							fetching = false;
						});
					});
				})
			});

			// TODO "Enable" these extra repos if the user chooses so.
			// const repos = zip.readAsText("CKAN-meta-master/repositories.json");

		}).catch((err) => {
			console.log("Error!", err);
		});
	// });
});

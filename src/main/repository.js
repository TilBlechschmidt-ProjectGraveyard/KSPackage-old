import config from '../config.json';

import tmp from 'tmp';
import yauzl from 'yauzl';
import { ipcMain } from 'electron';

import { modDB } from "./db";
import { downloadFile } from './network';
import { modIsCompatible, versionCompare } from "./installMod";

const decompressNotifyInterval = 250; // Files

let fetching = false;
let kspVersion = "1.4.1";

function filterMods(modList) {
	// Match the game version compatibility
	const compatible = modList.filter(mod => modIsCompatible(mod, kspVersion));

	// Reduce to only one version per mod
	const byIdentifier = compatible.reduce((list, mod) => {
		if (!list[mod.identifier] || versionCompare(mod.version, list[mod.identifier].version) > 0)
			list[mod.identifier] = mod;

		return list;
	}, {});

	const singleVersion = Object.keys(byIdentifier).map(identifier => byIdentifier[identifier]);

	return singleVersion;
}

function sendModsToClient(sender) {
	modDB.find({}).sort({ name: 1 }).exec((err, docs) => {
		if (!err) sender.send('modList', filterMods(docs));
	});
}

ipcMain.on('fetchRepository', (event) => {
	// TODO: Remove this.
	event.sender.send('repositoryFetchProgress', 1);
	sendModsToClient(event.sender);
	return;
	// ---

	if (fetching) return;
	else fetching = true;

	const tmpDir = tmp.dirSync({ unsafeCleanup: true });
	const tmpFile = tmpDir.name + '/file.zip';
	return downloadFile(config.repository.url, tmpFile, (progress) => {
		event.sender.send('repositoryFetchProgress', progress * 0.5);
	}).then(() => {
		yauzl.open(tmpFile, {lazyEntries: true}, function(err, zipfile) {

			const entryCount = zipfile.entryCount;
			let decompressedCount = 0;

			if (err) throw err;
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
								if (!parsed.repositories && !parsed.builds) // Filter out the repositories
									modDB.insert(parsed);
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
				event.sender.send('repositoryFetchProgress', 1);
				sendModsToClient(event.sender);

				fetching = false;
			})
		});

		// TODO "Enable" these extra repos if the user chooses so.
		// const repos = zip.readAsText("CKAN-meta-master/repositories.json");

	}).catch((err) => {
		console.log("Error!", err);
	});
});

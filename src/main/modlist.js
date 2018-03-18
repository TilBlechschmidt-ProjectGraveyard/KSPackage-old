import config from '../config.json';

import request from 'request';
import fs from 'fs';
import tmp from 'tmp';
import yauzl from 'yauzl';
import { ipcMain } from 'electron';

import { modDB } from "./db";

const downloadNotifyInterval = 1024 * 100; // Bytes
const decompressNotifyInterval = 250; // Files

export function httpRequest(url) {
	return new Promise((resolve, reject) => {
		let response = "";

		request.get(url)
			.on('data', data => {
				response += data;
			})
			.on('end', () => {
				resolve(response);
			})
			.on('error', function(err) {
				reject(err.message);
			});
	});
}


ipcMain.on('httpRequest', (event, args) => {
	if (args.url) httpRequest(args.url).then((response) => {
		args.data = response;
		event.sender.send('httpResponse', args);
	}).catch((err) => {
		console.error("Failed to send HTTP request:", err);
	})
});

function download(url, dest, sender) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest, { flags: "wx" });
		let totalSize = 0;
		let lastNotification = 0;
		let downloaded = 0;

		request.get(url)
			.on('response', data => {
				totalSize = data.headers['content-length'];
			})
			.on('data', data => {
				downloaded += data.length;
				if (lastNotification + downloadNotifyInterval < downloaded) {
					lastNotification = downloaded;
					sender.send('repositoryFetchProgress', (downloaded / totalSize) * 0.5);
				}
			})
			.on('error', function(err) {
				file.close();
				fs.unlink(dest, () => {}); // Delete temp file
				reject(err.message);
			})
			.pipe(file);

		file.on("finish", () => {
			sender.send('repositoryFetchProgress', 0.5);
			resolve();
		});

		file.on("error", err => {
			file.close();

			if (err.code === "EEXIST") {
				reject("File already exists");
			} else {
				fs.unlink(dest, () => {}); // Delete temp file
				reject(err.message);
			}
		});
	});
}

let fetching = false;

ipcMain.on('fetchRepository', (event) => {
	// TODO: Remove this.
	// event.sender.send('repositoryFetchProgress', 1);
	// modDB.find({ 'ksp_version': '1.4.0', "identifier": "Scatterer" }, (err, docs) => {
	// 	modDB.find({'ksp_version': '1.4.1', "identifier": "TakeCommandContinued"}, (err, docs2) => {
	// 		if (!err) event.sender.send('modList', docs.concat(docs2));
	// 	});
	// });
	// return;
	// ---

	if (fetching) return;
	else fetching = true;

	const tmpDir = tmp.dirSync({ unsafeCleanup: true });
	const tmpFile = tmpDir.name + '/file.zip';
	return download(config.repository.url, tmpFile, event.sender).then(() => {
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
								modDB.insert(JSON.parse(data));
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

				modDB.find({ 'ksp_version': '1.4.1' }).sort({ name: 1 }).exec((err, docs) => {
					if (!err) event.sender.send('modList', docs);
				});

				fetching = false;
			})
		});

		// TODO "Enable" these extra repos if the user chooses so.
		// const repos = zip.readAsText("CKAN-meta-master/repositories.json");

	}).catch((err) => {
		console.log("Error!", err);
	});
});

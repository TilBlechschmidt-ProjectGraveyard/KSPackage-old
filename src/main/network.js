import request from 'request';
import fs from 'fs';
import { ipcMain } from 'electron';

const downloadNotifyInterval = 1024 * 100; // Bytes

export function downloadFile(url, dest, progressCallback) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest, { flags: "w" });
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
					if (typeof progressCallback === 'function') progressCallback(downloaded / totalSize);
				}
			})
			.on('error', function(err) {
				file.close();
				fs.unlink(dest, () => {}); // Delete temp file
				reject(err.message);
			})
			.pipe(file);

		file.on("finish", () => {
			if (typeof progressCallback === 'function') progressCallback(1);
			resolve(dest);
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

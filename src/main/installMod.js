import { modDB } from "./db";
import { app, ipcMain } from 'electron';
import path from 'path';
import yauzl from 'yauzl';
import fs from 'fs';

import { downloadFile } from "./network";
import { installedDB } from "./db";

function getMod(filter, singleMod = true) {
	return new Promise((resolve, reject) => {
		if (singleMod)
			modDB.findOne(filter, (err, docs) => {
				if (err) reject(err);
				else resolve(docs);
			});
		else
			modDB.find(filter, (err, docs) => {
				if (err) reject(err);
				else resolve(docs);
			});
	});
}

function stripVersionPrefix(version) {
	const cleaned = version.replace(/(.+?):/g, '').replace(/v/gi, '').replace('-', '.');

	const postfix = /(\D+)$/g.exec(cleaned);

	if (postfix) {
		const postfixNumbers = postfix ? `.${postfix[1].split('').map(char => char.charCodeAt(0) - 97).join('.')}` : '';
		return cleaned.substring(0, cleaned.length - postfix[1].length) + postfixNumbers;
	} else {
		return cleaned;
	}
}

export function versionCompare(v1, v2, options) {
	if (!v1 || !v2) return 0;
	let lexicographical = options && options.lexicographical,
		zeroExtend = options && options.zeroExtend,
		v1parts = stripVersionPrefix(v1).split('.'),
		v2parts = stripVersionPrefix(v2).split('.');

	function isValidPart(x) {
		return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
	}

	if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
		return NaN;
	}

	if (zeroExtend) {
		while (v1parts.length < v2parts.length) v1parts.push("0");
		while (v2parts.length < v1parts.length) v2parts.push("0");
	}

	if (!lexicographical) {
		v1parts = v1parts.map(Number);
		v2parts = v2parts.map(Number);
	}

	for (let i = 0; i < v1parts.length; ++i) {
		if (v2parts.length === i) {
			return 1;
		}

		if (v1parts[i] === v2parts[i]) {
			continue;
		} else if (v1parts[i] > v2parts[i]) {
			return 1;
		} else {
			return -1;
		}
	}

	if (v1parts.length !== v2parts.length) {
		return -1;
	}

	return 0;
}

function isWithinVersionRange(version, startVersion, endVersion) {
	return (startVersion === 'any' || versionCompare(version, startVersion) > -1)
		&& (endVersion === 'any' || versionCompare(version, endVersion) < 1);
}

export function modIsCompatible(mod, targetVersion) {
	if (mod['ksp_version']) {
		return mod['ksp_version'] === targetVersion // Version match
			|| mod['ksp_version'] === 'any' // Version wildcard
	} else if (mod['ksp_version_min'] || mod['ksp_version_max']) {
		return isWithinVersionRange(targetVersion, mod['ksp_version_min'], mod['ksp_version_max']);
	} else {
		return true;
	}
}

async function getDependency(dependency, targetVersion) {
	// TODO Check provides array as well as identifier
	const allVersions = await getMod({ identifier: dependency.name }, false);

	return {
		name: dependency.name,
		versions: allVersions.filter(version => modIsCompatible(version, targetVersion))
	}
}

async function resolveDependencies(filter, targetVersion) {
	const mod = await getMod(filter);

	const dependencies = await Promise.all((mod.depends || []).map(dependency =>
		getDependency(dependency, targetVersion)
	));

	const recommendations = await Promise.all((mod.recommends || []).map(recommendation =>
		getDependency(recommendation, targetVersion)
	));

	const suggestions = await Promise.all((mod.suggests || []).map(suggestion =>
		getDependency(suggestion, targetVersion)
	));

	const dependenciesAutoResolvable = dependencies.reduce((resolvable, dependency) => {
		return resolvable && dependency.versions.length > 0;
	}, true);

	return {
		autoResolvable: dependenciesAutoResolvable,
		dependencies,
		recommendations,
		suggestions
	}
}

ipcMain.on('resolveDependencies', (event, args) => {
	resolveDependencies(args.filter, args.version).then((result) => {
		args.data = result;
		event.sender.send('resolvedDependencies', args);
	});
});

const gameDirectory = path.join(app.getPath('downloads'), 'KSPMods');

function mkdirp(dir, cb) {
	if (dir === ".") return cb();
	fs.stat(dir, function(err) {
		if (err === null) return cb(); // already exists

		const parent = path.dirname(dir);
		mkdirp(parent, function() {
			// process.stdout.write(dir.replace(/\/$/, "") + "/\n");
			fs.mkdir(dir, cb);
		});
	});
}

function unpackArchive(archive, targetDir) {
	const unzipPrefix = path.join(targetDir, path.basename(archive));

	return new Promise((resolve, reject) => {
		yauzl.open(archive, { lazyEntries: true }, (err, zipfile) => {
			if (err) reject(err);

			const files = [];

			zipfile.readEntry();

			zipfile.on("entry", function(entry) {
				if (/\/$/.test(entry.fileName)) {
					// directory file names end with '/'
					mkdirp(path.join(unzipPrefix, entry.fileName), function() {
						if (err) reject(err);
						zipfile.readEntry();
					});
				} else {
					files.push(entry.fileName);
					// ensure parent directory exists
					mkdirp(path.dirname(path.join(unzipPrefix, entry.fileName)), function () {
						zipfile.openReadStream(entry, function (err, readStream) {
							if (err) reject(err);
							const writeStream = fs.createWriteStream(path.join(unzipPrefix, entry.fileName));
							writeStream.on("close", () => {
								zipfile.readEntry();
							});
							writeStream.on('error', reject);
							readStream.pipe(writeStream);
						})
					});
				}
			});

			zipfile.on("end", () => {
				resolve({
					directory: unzipPrefix,
					files: files
				});
			});
		});
	});
}

function copyFile(source, target) {
	return new Promise((resolve, reject) => {
		mkdirp(path.dirname(target), () => {
			const rd = fs.createReadStream(source);
			const wr = fs.createWriteStream(target);

			rd.on('error', reject);
			wr.on('error', reject);
			wr.on('finish', resolve);
			rd.pipe(wr);
		});
	});
}

async function installMod(mod) {
	if (mod.kind === 'metapackage') return;
	const tmpDir = app.getPath('temp');
	const file = path.join(tmpDir, `${mod.identifier}`);

	await downloadFile(mod.download, file);
	const { directory, files } = await unpackArchive(file, path.join(tmpDir, 'unpacked'));

	let directives = [];
	if (!mod.install) {
		directives = [
			{
				files: files.filter(file => path.dirname(file).match(/GameData\/./g)).map(file => ({
					source: file,
					destination: file.substring('GameData/'.length)
				})),
				destination: 'GameData'
			}
		];
	} else {
		directives = mod.install.map(directive => {
			let matching = [];

			if (directive.file) {
				const prefixLength = directive.file.length - path.basename(directive.file).length;
				matching = files.filter(filePath => filePath.indexOf(directive.file) === 0).map(file => ({
					source: file,
					destination: file.substring(prefixLength)
				}));
			} else if (directive.find) {
				matching = files.filter(filePath => {
					return path.dirname(filePath).indexOf(directive.find) > -1
				}).map(file => ({
					source: file,
					destination: file.substring(file.indexOf(directive.find))
				}));
			} else if (directive['find_regexp']) {
				const regex = new RegExp(directive['find_regexp'], 'g');
				matching = files.filter(filePath => filePath.match(regex)).map(file => ({
					source: file,
					destination: file
				}));
			}

			return {
				files: matching,
				destination: directive['install_to']
			}
		});
	}

	const copyOperations = directives.reduce((operations, directive) =>
		operations.concat(directive.files.map(file => {
			const source = path.join(directory, file.source);
			const destination = path.join(gameDirectory, directive.destination, file.destination);

			return copyFile(source, destination);
		}))
	, []);

	await Promise.all(copyOperations);
}

async function installMods(modList) {
	const mods = await Promise.all(modList.map(mod => getMod({ _id: mod })));

	await Promise.all(mods.map(installMod));
}

ipcMain.on('installMods', (event, args) => {
	args.modList.forEach(id => installedDB.insert({ _id: id }) );
	installMods(args.modList).then(() => {
		event.sender.send('installedMods', args.modList);
	}).catch((err) => {
		console.log("Failed to install mods", args.modList, err);
		event.sender.send('failedToInstallMods', args.modList);
		args.modList.forEach(id => installedDB.remove({ _id: id }, {}) );
	});
});

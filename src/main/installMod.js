import { modDB } from "./db";
import { app, ipcMain } from 'electron';
import path from 'path';
import yauzl from 'yauzl';
import fs from 'fs';

import { downloadFile } from "./network";
import { installedDB } from "./db";
import {sendModsToClient} from "./repository";

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

function stripPatch(version) {
	return version.split('.').slice(0, 2).join('.');
}

export function modIsCompatible(mod, targetVersion) {
	if (mod['ksp_version']) {
		return mod['ksp_version'] === targetVersion // Version match
			|| mod['ksp_version'] === 'any' // Version wildcard
			|| stripPatch(mod['ksp_version']) === stripPatch(targetVersion); // Version match (ignoring the patch comp.)
	} else if (mod['ksp_version_min'] || mod['ksp_version_max']) {
		return isWithinVersionRange(targetVersion, mod['ksp_version_min'], mod['ksp_version_max']);
	} else {
		return true;
	}
}

export function getLatestVersions(mods) {
	const byIdentifier = mods.reduce((list, mod) => {
		if (!list[mod.identifier] || versionCompare(mod.version, list[mod.identifier].version) > 0)
			list[mod.identifier] = mod;

		return list;
	}, {});

	return Object.keys(byIdentifier).map(identifier => byIdentifier[identifier]);
}

async function getCompatibleMod(filter, targetVersion) {
	return (await getMod(filter, false)).filter(version =>
		modIsCompatible(version, targetVersion)
	);
}

async function resolveDependencies(filter, targetVersion) {
	const mod = await getMod(filter);

	if (!mod) throw new Error(`Mod not found in database (${JSON.stringify(filter)}).`);

	return await Promise.all((mod.depends || []).map(async dependency => {
		const direct = await getCompatibleMod({ identifier: dependency.name }, targetVersion);
		const providing = await getCompatibleMod({ 'provides': dependency.name }, targetVersion);

		return {
			name: dependency.name,
			choices: getLatestVersions(direct.concat(providing))
		}
	}));
}

export async function buildDependencyTree(filter, targetVersion, encounteredDependencies = []) {
	const dependencies = await resolveDependencies(filter, targetVersion);

	const tree = await Promise.all(
		dependencies.map((dependency, depID) =>
			Promise.all(
				dependency.choices.reduce((akk, choice) => {
					if (encounteredDependencies.includes(choice.identifier)) return akk;
					/// TODO Check whether or not this mod conflicts with any of the queued mods
					// const conflicting = encounteredDependencies.reduce((res, encountered) => {
					// 	if (!choice.conflicts || !encountered) return res;
					// 	return res && choice.conflicts.reduce((x, conflict) => {
					// 		if (encountered.includes(conflict.name)) console.log(`${choice.name} conflicts with ${conflict.name}`);
					// 		return x && !encountered.includes(conflict.name);
					// 	}, true)
					// }, true);
					// if (!conflicting) console.log("Found conflict!");

					/// Check whether or not we encountered this already
					if (encounteredDependencies.includes(choice.identifier)) return akk;
					/// Add the identifier and everything this mod provides to the "encountered" list
					encounteredDependencies.push(choice.identifier);
					if (choice.provides) choice.provides.forEach(providing => encounteredDependencies.push(providing.name));

					return akk.concat(
						buildDependencyTree({id: choice.id}, targetVersion, encounteredDependencies).then(dependencies =>
							({
								id: choice.id,
								label: `${choice.name} (Version ${choice.version})`,
								dependencies
							})
						)
					);
				}, [])
			).then(choices => ({ name: dependency.name, choices }))
		)
	);

	return tree.filter(dep => dep.choices.length > 0);
}

ipcMain.on('resolveDependencies', (event, args) => {
	// TODO Do initial conflict check against installed mods
	buildDependencyTree({ id: args.id }, args.version, [args.id]).then(result => {
		args.data = {
			id: args.id,
			dependencies: result
		};
		event.sender.send('resolvedDependencies', args);
	}).catch((err) => {
		args.error = err;
		event.sender.send('errorResolvingDependencies', args);
	});
});

const gameDirectory = path.join(app.getPath('downloads'), 'KSPMods');

function mkdirp(dir, cb) {
	if (dir === ".") return cb();
	fs.stat(dir, function(err) {
		if (err === null) return cb(); // already exists

		const parent = path.dirname(dir);
		mkdirp(parent, function() {
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
			} else
			if (directive.find) {
				matching = files.filter(filePath => {
					return path.dirname(filePath).indexOf(directive.find) > -1
				}).map(file => ({
					source: file,
					destination: file.substring(file.indexOf(directive.find))
				}));
			} else
			if (directive['find_regexp']) {
				const regex = new RegExp(directive['find_regexp'], 'g');
				matching = files.filter(filePath => filePath.match(regex)).map(file => ({
					source: file,
					destination: file
				}));
			}

			return {
				files: matching.map(file => ({
					source: file.source,
					// TODO This is a workaround. For some reason this is required for various mods.
					// Specification doesn't tell anything about this case tho -.-
					destination: file.destination.replace(`${directive['install_to']}/`, '')
				})),
				destination: directive['install_to']
			}
		});
	}

	const installedFiles = [];
	const copyOperations = directives.reduce((operations, directive) =>
		operations.concat(directive.files.map(file => {
			const source = path.join(directory, file.source);
			const destination = path.join(gameDirectory, directive.destination, file.destination);

			installedFiles.push(path.join(directive.destination, file.destination));

			return copyFile(source, destination);
		}))
	, []);

	await Promise.all(copyOperations);

	return new Promise((resolve, reject) => {
		installedDB.update({ id: mod.id }, { $set: { files: installedFiles } }, {}, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

async function installMods(modList) {
	const mods = await Promise.all(modList.map(mod => getMod({ id: mod })));

	mods.forEach(mod =>
		installedDB.insert({
			id: mod.id
		})
	);

	await Promise.all(mods.map(installMod));
}

ipcMain.on('installMods', (event, args) => {
	installMods(args.modList).then(() => {
		sendModsToClient(event.sender);
	}).catch((err) => {
		console.log("Failed to install mods", args.modList, err);
		event.sender.send('failedToInstallMods', args.modList);
		args.modList.forEach(id => installedDB.remove({ id: id }, {}) );
	});
});

import { provideState, update } from "freactal";
import Fuse from 'fuse.js';
import config from '../config.json';

const dependencyResolverCallbacks = {};

const resolveDependencies = (modID) => {
	return new Promise((resolve, reject) => {
		dependencyResolverCallbacks[modID] = { resolve, reject };

		ipcRenderer.send('resolveDependencies', {
			filter: { id: modID },
			version: config.game.version,
			id: modID
		});
	});
};

export const wrapComponentWithInstallState = provideState({
	initialState: () => ({
		resolverQueue: [], // Not yet resolved mods
		installQueue: [] // Resolved dependencies - install when resolver queue is empty
	}),
	effects: {

	}
});

export const wrapComponentWithAppState = provideState({
	initialState: () => ({
		rawRepository: [],
		processing: {},
		installed: {},
		selected: null,
		searchString: "",
	}),
	effects: {
		setSearchString: update((state, searchString) => ({ searchString })),
		setRepositoryContent: update((state, content) => ({
			rawRepository: content
		})),
		setModProcessing: update((state, modID, installing) => {
			const installingEntry = {};
			installingEntry[modID] = installing;
			return {
				processing: Object.assign({}, state.processing, installingEntry)
			}
		}),
		setModInstalled: update((state, mod, installed) => {
			const installingEntry = {};
			installingEntry[mod] = installed;
			return {
				installed: Object.assign({}, state.installed, installingEntry)
			}
		}),
		selectMod: update((state, modID) => ({
			selected: modID
		}))
	},
	computed: {
		selectedMod: ({selected, repository}) => repository[selected],
		repository: ({rawRepository}) => {
			return rawRepository.reduce((list, mod) => {
				list[mod.id] = mod;
				return list;
			}, {})
		},
		searchResults: ({ rawRepository, searchString }) =>
			new Fuse(rawRepository, config.list.search.options).search(searchString)
	}
});

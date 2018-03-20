import { provideState, update } from "freactal";
import Fuse from 'fuse.js';
import config from '../config.json';

export const wrapComponentWithAppState = provideState({
	initialState: () => ({
		rawRepository: [],
		installing: {},
		installed: {},
		selected: null,
		searchString: ""
	}),
	effects: {
		setSearchString: update((state, searchString) => ({ searchString })),
		setRepositoryContent: update((state, content) => ({
			rawRepository: content
		})),
		setModInstalling: update((state, modID, installing) => {
			const installingEntry = {};
			installingEntry[modID] = installing;
			return {
				installing: Object.assign({}, state.installing, installingEntry)
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

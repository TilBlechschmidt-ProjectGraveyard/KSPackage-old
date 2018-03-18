import { provideState, update } from "freactal";

export const wrapComponentWithAppState = provideState({
	initialState: () => ({
		repository: {},
		installing: {},
		installed: {},
		selected: null,
	}),
	effects: {
		setRepositoryContent: update((state, content) => {
			return {
				repository: content.reduce((list, mod) => {
					list[mod._id] = mod;
					return list;
				}, {})
			}
		}),
		setModInstalling: update((state, modID, installing) => {
			const installingEntry = {};
			installingEntry[modID] = installing;
			return {
				installing: Object.assign({}, state.installing, installingEntry)
			}
		}),
		setModInstalled: update((state, modID, installed) => {
			const installingEntry = {};
			installingEntry[modID] = installed;
			return {
				installed: Object.assign({}, state.installed, installingEntry)
			}
		}),
		selectMod: update((state, modID) => ({
			selected: modID
		}))
	},
	computed: {
		selectedMod: ({selected, repository}) => repository[selected]
	}
});

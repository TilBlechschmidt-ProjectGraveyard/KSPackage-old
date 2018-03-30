import { provideState, update } from "freactal";
import Fuse from 'fuse.js';
import config from '../config.json';
import { ipcRenderer } from 'electron';

const dependencyResolverCallbacks = {};

ipcRenderer.on('resolvedDependencies', (event, args) => {
	if (!args.id) return;

	if (dependencyResolverCallbacks[args.id] && typeof dependencyResolverCallbacks[args.id].resolve === 'function') {
		dependencyResolverCallbacks[args.id].resolve(args.data);
		clearTimeout(dependencyResolverCallbacks[args.id].timeout);
		delete dependencyResolverCallbacks[args.id];
	}
});

export const resolveDependencies = (modID) => {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			if (dependencyResolverCallbacks[modID] && typeof dependencyResolverCallbacks[modID].reject === 'function')
				dependencyResolverCallbacks[modID].reject("Resolving timed out.");
		}, config.install.dependencyResolveTimeout);

		dependencyResolverCallbacks[modID] = { resolve, reject, timeout };

		ipcRenderer.send('resolveDependencies', { id: modID });
	});
};

const breakDownTree = (dependencyTree, selected) => {

	const accumulator = {
		selectedChoices: selected,
		choices: [],
		installQueue: [dependencyTree.id]
	};

	if (dependencyTree.dependencies.length) {
		return dependencyTree.dependencies.reduce(({ selectedChoices, choices, installQueue }, dependency) => {
			if (dependency.choices.length === 1)
				selectedChoices[dependency.name] = dependency.choices[0].id;

			if (selectedChoices.hasOwnProperty(dependency.name)) {
				/// Found previous choice
				const s = dependency.choices.filter(choice => choice.id === selectedChoices[dependency.name]);

				if (s.length > 1) console.warn("Selected choice is ambigous!");

				const res = breakDownTree(s[0], selectedChoices);

				return {
					selectedChoices: Object.assign({}, selectedChoices, res.selectedChoices),
					choices: choices.concat(res.choices),
					installQueue: installQueue.concat(res.installQueue)
				};
			} else if (dependency.choices.length === 0) {
				/// No choices available. Alert user TODO Pass this up the tree
				console.warn(`Unable to resolve ${dependency.name}`);
				alert(`Unable to resolve ${dependency.name}`);
			} else {
				/// Unable to resolve to a single dependency
				return {
					selectedChoices,
					choices: choices.concat([dependency]),
					installQueue
				};
			}
		}, accumulator);
	} else {
		return accumulator;
	}

};

export const wrapComponentWithInstallState = provideState({
	initialState: () => ({
		processing: {},

		selectedChoices: {},
		choices: [],
		installQueue: [],
		tree: null
	}),
	effects: {
		setModProcessing: update((state, modID, installing) => ({
				processing: Object.assign({}, state.processing, { [modID]: installing })
		})),

		queueModInstall: (effects, modID) => {
			return resolveDependencies(modID).then(
				(dependencyTree) => {
					const tree = breakDownTree(dependencyTree, {});

					// If possible run automatic install
					if (tree.choices.length === 0) {
						ipcRenderer.send('installMods', {
							modList: tree.installQueue
						});

						tree.installQueue.forEach(mod => {
							effects.setModProcessing(mod, true);
						});
					} else {
						return (state) => {
							return Object.assign({},
								state,
								tree,
								{ tree: dependencyTree }
							);
						}
					}
				}
			).catch(console.error);
		},
		refreshDependencyTree: update((state) => breakDownTree(state.tree, state.selectedChoices)),
		addSelected: update((state, selected) => ({ selectedChoices: Object.assign({}, state.selectedChoices, selected) })),
		cancelInstall: update(() => ({ selectedChoices: {}, choices: [], installQueue: [] }))
	}
});

export const wrapComponentWithAppState = provideState({
	initialState: () => ({
		rawRepository: [],
		installed: {},
		selected: null,
		searchString: "",
	}),
	effects: {
		setSearchString: update((state, searchString) => ({ searchString })),
		setRepositoryContent: update((state, content) => ({
			rawRepository: content
		})),
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

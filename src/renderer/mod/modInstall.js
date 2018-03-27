import React from 'react'
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import { ipcRenderer } from 'electron';

import {injectState} from "freactal";
import {resolveDependencies, wrapComponentWithInstallState} from "../state";
import {
	Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormLabel, List, ListItem,
	Radio,
	RadioGroup,
	Typography
} from "material-ui";

const styles = theme => ({
	root: {}
});

class ModInstall extends React.Component {
	state = {
		selectedChoices: {}
	};

	applyConflictResolutions = () => {
		this.props.effects.addSelected(this.state.selectedChoices);
		this.props.effects.refreshDependencyTree();
		this.setState({
			selectedChoices: {}
		});
	};

	handleChoiceSelect = dependency => (event) => {
		const choice = {};
		choice[dependency] = event.target.value;
		this.setState({
			selectedChoices: Object.assign({}, this.state.selectedChoices, choice)
		});
	};

	executeInstallation = () => {
		ipcRenderer.send('installMods', {
			modList: this.props.state.installQueue
		});

		this.props.state.installQueue.forEach(mod => {
			this.props.effects.setModProcessing(mod, true);
		});

		this.props.effects.cancelInstall();
	};

	render() {
		const { state } = this.props;
		const { selectedChoices, choices, installQueue } = state;

		const conflictResolutionInvalid = !state.choices.reduce((akk, dependency) =>
			akk && this.state.selectedChoices[dependency.name], true);

		const choiceDialog = (
			<Dialog
				disableBackdropClick
				disableEscapeKeyDown
				maxWidth="xs"
				open={choices.length > 0}
			>
				<DialogTitle>Choose a dependency</DialogTitle>
				<DialogContent>
					<Typography>Multiple mods satisfy a dependency. Choose one for each:</Typography>
					<List>
						{choices.map(dependency => (
							<ListItem key={dependency.name}>
								<FormControl component="fieldset" required>
									<FormLabel component="legend">{dependency.name}</FormLabel>
									<RadioGroup
										name={dependency.name}
										value={this.state.selectedChoices[dependency.name]}
										onChange={this.handleChoiceSelect(dependency.name)}
									>
										{dependency.choices.map(dep => (
											<FormControlLabel
												key={dep.id}
												value={dep.id}
												control={<Radio />}
												label={dep.label}
											/>
										))}
									</RadioGroup>
								</FormControl>
							</ListItem>
						))}
					</List>
				</DialogContent>
				<DialogActions>
					{/* TODO: The following call to cancelInstall empties the dialog before it is fully hidden. */}
					<Button onClick={this.props.effects.cancelInstall}>
						Cancel
					</Button>
					<Button onClick={this.applyConflictResolutions} color="primary" disabled={conflictResolutionInvalid}>
						Confirm
					</Button>
				</DialogActions>
			</Dialog>
		);

		const dependencyList = Object.keys(selectedChoices).map(selection => (
			<ListItem key={selection}>
				<Typography>{selectedChoices[selection]}</Typography>
			</ListItem>
		));


		const installConfirmationDialog = (
			<Dialog
				disableBackdropClick
				disableEscapeKeyDown
				maxWidth="xs"
				open={choices.length === 0 && installQueue.length > 0}
			>
				<DialogTitle>Review selection</DialogTitle>
				<DialogContent>
					<Typography>The following dependencies will be installed:</Typography>
					<List>
						{Object.keys(selectedChoices).length > 0 ? dependencyList : '-'}
					</List>
				</DialogContent>
				<DialogActions>
					{/* TODO: The following call to cancelInstall empties the dialog before it is fully hidden. */}
					<Button onClick={this.props.effects.cancelInstall}>
						Cancel
					</Button>
					<Button onClick={this.executeInstallation} color="primary">
						Install
					</Button>
				</DialogActions>
			</Dialog>
		);

		return (
			<div>
				{choiceDialog}
				{installConfirmationDialog}
			</div>
		);

		// 	{/* Notify user about unresolvable dependencies and give the option to force install */}
		// 	<Dialog
		// 		disableBackdropClick
		// 		disableEscapeKeyDown
		// 		maxWidth="xs"
		// 		open={missingDependencies.length > 0}
		// 	>
		// 		<DialogTitle>Missing dependencies</DialogTitle>
		// 		<DialogContent>
		// 			<Typography>Unable to resolve the following dependencies:</Typography>
		// 			<List>
		// 				{missingDependencies.map(missingDep => (
		// 					<ListItem key={missingDep.name}>
		// 						<Typography>{missingDep.name}</Typography>
		// 					</ListItem>
		// 				))}
		// 			</List>
		// 		</DialogContent>
		// 		<DialogActions>
		// 			<Button onClick={this.props.effects.cancelInstall} color="primary">
		// 				Cancel
		// 			</Button>
		// 			<Button onClick={this.props.effects.ignoreConflicts} color="primary">
		// 				Force install
		// 			</Button>
		// 		</DialogActions>
		// 	</Dialog>
	}
}

ModInstall.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default injectState(withStyles(styles)(ModInstall));

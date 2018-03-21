import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import { ipcRenderer } from 'electron';

import {
	Divider, Icon, IconButton, ListItem, ListItemSecondaryAction, ListItemText, Tooltip,
	Typography
} from "material-ui";
import { injectState } from "freactal";
import {getModIdentifier} from "../helper";


const styles = theme => ({
	doneIcon: {
		color: 'green',
		'&:hover': {
			color: 'red'
		}
	}
});


class ModListEntry extends React.Component {
	handleModClick = modID => () => {
		this.props.effects.selectMod(modID);
	};

	handleModInstall = modID => () => {
		this.props.effects.setModProcessing(modID, true);

		ipcRenderer.send('resolveDependencies', {
			filter: { id: modID },
			version: "1.3.1",
			id: modID
		});
	};

	handleModUninstall = modID => () => {
		this.props.effects.setModProcessing(modID, true);

		ipcRenderer.send('uninstallMods', modID);
	};

	shouldComponentUpdate(nextProps) {
		const { id, state } = this.props;
		const nid = nextProps.id,
			nstate = nextProps.state;

		const idChanged = nid !== id;
		const installingChanged = nstate.processing[nid] !== state.processing[id];
		const installedChanged = nstate.installed[nid] !== state.installed[id];
		const selectedChanged = (state.selected === id && nstate.selected !== nid)
								|| (state.selected !== id && nstate.selected === nid);

		return idChanged || installingChanged || installedChanged || selectedChanged;
	}

	render() {
		const { id, state, classes } = this.props;

		const mod = state.repository[id];
		if (!mod) return <div/>;

		let icon = (
			<Tooltip title="Install" placement="bottom" onClick={this.handleModInstall(id)}>
				<IconButton> <Icon>add</Icon> </IconButton>
			</Tooltip>
		);

		if (state.processing[id]) {
			icon = (
				<IconButton disabled className='installIconSpinner'> <Icon>autorenew</Icon> </IconButton>
			)
		} else if (state.installed[id]) {
			icon = (
				<Tooltip title="Uninstall" placement="bottom" onClick={this.handleModUninstall(id)}>
					<IconButton> <Icon className={classes.doneIcon}>done</Icon> </IconButton>
				</Tooltip>
			)
		}

		return (
			<div>
				<ListItem
					button
					onClick={this.handleModClick(id)}
					style={{
						backgroundColor: state.selected === id ? 'rgba(1, 1, 1, .12)' : ''
					}}
				>
					<ListItemText
						disableTypography
						primary={
							<Typography variant="subheading" noWrap>{mod.name}</Typography>
						}
						secondary={
							<Typography variant="caption" noWrap>{mod.abstract}</Typography>
						}
					/>
					<ListItemSecondaryAction>{icon}</ListItemSecondaryAction>
				</ListItem>
				<Divider inset/>
			</div>
		);
	}
}

ModListEntry.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default injectState(withStyles(styles)(ModListEntry));

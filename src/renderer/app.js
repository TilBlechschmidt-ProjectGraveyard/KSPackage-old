import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import config from '../config.json';

import classNames from 'classnames';

import ReactList from 'react-list';
import Drawer from 'material-ui/Drawer';
import AppBar from 'material-ui/AppBar';
import List from 'material-ui/List';
import Typography from 'material-ui/Typography';
import Divider from 'material-ui/Divider';
import {
	Button,
	Dialog, DialogActions, DialogContent, DialogTitle, Grid, Icon, IconButton, Input, InputAdornment, ListItem,
	ListItemSecondaryAction,
	ListItemText,
	Tooltip
} from "material-ui";
import CssBaseline from 'material-ui/CssBaseline';

import ModListEntry from './mod/modListEntry';

import Mod from './mod/modDetails';
import Loader from './loader/loader';
import {wrapComponentWithAppState} from "./state";
import {injectState} from "freactal";
import {getModIdentifier} from "./helper";

const drawerWidth = 240;

const styles = theme => ({
	root: {
		// flexGrow: 1,
		height: '100%'
	},
	appFrame: {
		zIndex: 1,
		overflow: 'hidden',
		position: 'relative',
		height: '100%',
		display: 'flex',
		width: '100%',
	},
	appBar: {
		width: `calc(100% - ${drawerWidth}px)`,
		marginLeft: drawerWidth,
		backgroundColor: 'transparent'
	},
	drawerPaper: {
		position: 'relative',
		width: drawerWidth,
		backgroundColor: theme.palette.background.default,
	},
	toolbar: {
		minHeight: theme.spacing.unit * 4,
		padding: theme.spacing.unit,
		backgroundColor: theme.palette.background.default,
		boxShadow: 'none'
	},
	toolbarPadding: {
		height: theme.spacing.unit * 4,
	},
	content: {
		// flexGrow: 1,
		width: '100%',
		backgroundColor: theme.palette.background.default
	},
	searchInput: {
		margin: '10px'
	}
});

const { ipcRenderer } = require('electron');

class App extends React.Component {
	state = {
		initialFetch: true,
		currentDependencyList: null
	};

	componentWillMount() {
		ipcRenderer.on('modList', (event, args) => {
			this.props.effects.setRepositoryContent(args);
			this.setState({
				initialFetch: false
			});
		});

		// TODO Show failed installs visually
		ipcRenderer.on('installedMods', (event, args) => {
			args.forEach(mod => {
				this.props.effects.setModInstalled(mod.id, true);
				this.props.effects.setModInstalling(mod.id, false);
			});
		});

		ipcRenderer.on('resolvedDependencies', (event, args) => {
			if (args.data.autoResolvable) {
				const pendingInstall = args.data.dependencies.map(dependency =>
					// TODO the last element does not have to be the most recent
					dependency.versions[dependency.versions.length - 1].id
				);
				pendingInstall.push(args.id);

				ipcRenderer.send('installMods', {
					modList: pendingInstall
				});

				pendingInstall.forEach((mod) => {
					this.props.effects.setModInstalling(mod, true);
				});
			}
			args.data.id = args.id;
			this.setState({
				currentDependencyList: args.data
			});
		});
	}

	handleInstallCancel = () => {
		console.log(this.state.currentDependencyList.id);
		this.props.effects.setModInstalling(this.state.currentDependencyList.id, false);
		// const newInstalling = this.state.installing;
		// delete newInstalling[this.state.currentDependencyList.id];
        //
		this.setState({
			currentDependencyList: null
		});
	};

	handleSearch = (event) => {
		this.props.effects.setSearchString(event.target.value);
	};

	renderItem = (index) => {
		const mods = this.props.state.searchString ? this.props.state.searchResults : this.props.state.rawRepository;
		const mod = mods[index];
		return <ModListEntry id={mod.id} key={mod.id} />;
	};

	render() {
		const { classes, state } = this.props;
		const { initialFetch, currentDependencyList } = this.state;

		const resolverDialogOpen = !!(currentDependencyList && !currentDependencyList.autoResolvable);

		const dependencyResolverDialog = (
			<Dialog
				disableBackdropClick
				disableEscapeKeyDown
				maxWidth="xs"
				aria-labelledby="confirmation-dialog-title"
				open={resolverDialogOpen}
			>
				<DialogTitle id="confirmation-dialog-title">
					Meh
				</DialogTitle>
				<DialogContent>
					<Typography>Unable to auto-resolve dependencies!</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={this.handleInstallCancel} color="primary">
						Cancel
					</Button>
					<Button color="primary">
						Ok
					</Button>
				</DialogActions>
			</Dialog>
		);

		const mods = state.searchString ? state.searchResults : state.rawRepository;

		const modList = (
			<List>
				<ReactList
					itemRenderer={this.renderItem}
					length={mods.length}
					type='uniform'
				/>
			</List>
		);

		return (
			<div className={classes.root}>
				<CssBaseline />
				<div className={classNames(classes.appFrame, 'draggable')}>
					<Drawer
						variant="permanent"
						classes={{
							paper: classes.drawerPaper,
						}}
						className="not-draggable"
					>
						<AppBar position="sticky" color="default" classes={{ root: classes.toolbar }}>
							<div className={classes.toolbarPadding} />
							<Input
								placeholder="Search"
								inputProps={{
									'aria-label': 'Description'
								}}
								startAdornment={
									<InputAdornment position="start">
										<Icon>search</Icon>
									</InputAdornment>
								}
								classes={{
									input: classes.searchInput
								}}
								onChange={this.handleSearch}
								value={this.state.searchString}
							/>
						</AppBar>

						{initialFetch
							? <Grid container justify="center" alignItems="center" style={{ height: '100%' }}>
								<Grid item>
									<Loader text="Refreshing modlist" />
								</Grid>
							</Grid>
							: modList}
					</Drawer>
					<main className={classes.content}>
						<Mod />
					</main>
				</div>
				{dependencyResolverDialog}
			</div>
		);
	}
}

App.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default wrapComponentWithAppState(
	injectState(withStyles(styles)(App))
);

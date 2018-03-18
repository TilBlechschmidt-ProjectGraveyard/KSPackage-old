import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';

import classNames from 'classnames';

import Drawer from 'material-ui/Drawer';
import AppBar from 'material-ui/AppBar';
import List from 'material-ui/List';
import Typography from 'material-ui/Typography';
import Divider from 'material-ui/Divider';
import {Grid, ListItem, ListItemText} from "material-ui";
import CssBaseline from 'material-ui/CssBaseline';

import Mod from './mod/mod';

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
		height: theme.spacing.unit * 4,
		backgroundColor: theme.palette.background.default,
		boxShadow: 'none'
	},
	content: {
		// flexGrow: 1,
		width: '100%',
		backgroundColor: theme.palette.background.default
	},
});

const { ipcRenderer } = require('electron');

class PermanentDrawer extends React.Component {
	state = {
		modList: [],
		selectedMod: null
	};

	componentWillMount() {
		const x = this;

		ipcRenderer.on('modList', (event, args) => {
			x.setState({
				modList: args
			});
		});
	}

	handleModClick = mod => () => {
		this.setState({
			selectedMod: mod
		});
	};

	render() {
		const { classes } = this.props;
		const { modList, selectedMod } = this.state;

		const selectedModID = selectedMod ? selectedMod._id : null;

		return (
			<div className={classes.root}>
				<CssBaseline />
				<div className={classNames(classes.appFrame, 'draggable')}>
					<Drawer
						variant="permanent"
						classes={{
							paper: classes.drawerPaper,
						}}
					>
						<AppBar position="sticky" color="default" classes={{ root: classes.toolbar }}>
							<div/>
						</AppBar>
						<List>
							{modList.map((mod) =>
								<div key={mod._id}>
									<ListItem
										button
										onClick={this.handleModClick(mod)}
										style={{
											backgroundColor: selectedModID === mod._id ? 'rgba(1, 1, 1, .12)' : ''
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
									</ListItem>
									<Divider inset />
								</div>
							)}
						</List>
					</Drawer>
					<main className={classes.content}>
						{selectedMod
							? <Mod mod={selectedMod}/>
							: <Grid container justify="center" alignItems="center" style={{ height: '100%' }}>
								<Grid item>
									<Typography variant="display1" style={{ color: '#ccc' }}>No mod selected</Typography>
								</Grid>
							</Grid>}
					</main>
				</div>
			</div>
		);
	}
}

PermanentDrawer.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(PermanentDrawer);

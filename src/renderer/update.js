import React from 'react'
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';

import { ipcRenderer } from 'electron';

import { LinearProgress } from "material-ui";

const styles = theme => ({
	root: {
		position: 'fixed',
		top: 0,
		height: 'auto',
		width: '100%',
		zIndex: 1000000
	}
});

class Updater extends React.Component {
	state = {
		progress: 0,
		hidden: false
	};

	componentDidMount() {
		const updater = this;

		ipcRenderer.send('fetchRepository', {});

		ipcRenderer.on('repositoryFetchProgress', (event, progress) => {
			updater.setState({ progress });
		});
	}

	render() {
		return (
			<div className={this.props.classes.root}>
				<LinearProgress variant="determinate" value={this.state.progress * 100} className="fetchProgress"/>
			</div>
		);
	}
}

Updater.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Updater);

import React from 'react'
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import classNames from 'classnames';

import { ipcRenderer } from 'electron';

import {Grid, Typography} from "material-ui";
import Interweave from 'interweave';
import {injectState} from "freactal";

const styles = theme => ({
	root: {
		height: '100%',
		overflow: 'auto'
	},
	topPadding: {
		padding: theme.spacing.unit * 7
	},
	screenshot: {
		width: '100%'
	},
	content: {
		padding: theme.spacing.unit * 3
	},
	version: {
		float: 'right'
	},
	description: {
		paddingTop: theme.spacing.unit
	}
});

const spacedockIDRegex = /spacedock\.info\/mod\/(\d+?)\//g;

class ModDetails extends React.Component {
	state = {
		spacedock: undefined
	};

	onModChange = () => {
		this.setState({
			spacedock: undefined
		});

		if (this.props.state.selected) {
			const mod = this.props.state.selectedMod;
			if (mod.resources.spacedock) {
				const modIDMatch = spacedockIDRegex.exec(mod.resources.spacedock);
				if (modIDMatch) {
					const modID = modIDMatch[1];

					ipcRenderer.send('httpRequest', {
						id: mod._id,
						url: `http://spacedock.info/api/mod/${modID}`,
						type: 'spacedock'
					});
				}
			}
		}
	};

	componentDidUpdate(prevProps) {
		if (prevProps.state.selected !== this.props.state.selected) {
			this.onModChange();
		}
	}

	componentDidMount() {
		this.onModChange();

		ipcRenderer.on('httpResponse', (event, args) => {
			if (this.props.state.selected === args.id) {

				if (args.type === 'spacedock') {
					this.setState({
						spacedock: JSON.parse(args.data)
					});
				}

			}
		});
	}

	render() {
		const { classes, state } = this.props;

		if (!state.selected)
			return (
				<Grid container justify="center" alignItems="center" style={{ height: '100%' }}>
					<Grid item>
						<Typography variant="display1" style={{ color: '#ccc' }}>No mod selected</Typography>
					</Grid>
				</Grid>
			);

		const mod = state.selectedMod;
		const screenshot = mod.resources['x_screenshot'];

		const description = this.state.spacedock
			? <Interweave tagName="div" content={this.state.spacedock['description_html']} />
			: mod.description;

		return (
			<div className={classes.root}>
				{screenshot
					? <img src={mod.resources['x_screenshot']} className={classes.screenshot}/>
					: <div className={classes.topPadding} />
				}
				<div className={classes.content}>
					<Typography variant="headline">{mod.name}</Typography>
					<Typography variant="caption" className={classes.version}>{mod.version}</Typography>
					<Typography variant="caption" gutterBottom>{mod.abstract}</Typography>
					<Typography variant="body1" className={classNames(classes.description, 'mod-description')} component="div">
						{description}
					</Typography>
				</div>
			</div>
		);
	}
}

ModDetails.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default injectState(withStyles(styles)(ModDetails));

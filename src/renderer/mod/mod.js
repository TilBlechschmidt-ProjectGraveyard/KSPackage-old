import React from 'react'
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import classNames from 'classnames';

import { ipcRenderer } from 'electron';

import {Typography} from "material-ui";
import Interweave from 'interweave';

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

class Mod extends React.Component {
	state = {
		spacedock: undefined
	};

	onModChange = () => {
		this.setState({
			spacedock: undefined
		});

		const mod = this.props.mod;
		if (mod.resources.spacedock) {
			const modIDMatch = spacedockIDRegex.exec(mod.resources.spacedock);
			if (modIDMatch) {
				const modID = modIDMatch[1];

				ipcRenderer.send('httpRequest', {
					id: mod._id,
					url: `http://spacedock.info/api/mod/${modID}`,
					type: 'spacedock'
				});
				// const spacedockObj = fetch(`http://spacedock.info/api/mod/${modID}`, { mode: 'no-cors' });
                //
				// spacedockObj
				// 	.then(function(response) {
				// 		console.log(response);
				// 		return response.text();
				// 	})
				// 	.then(function(text) {
				// 		console.log('Request successful', text);
				// 	})
				// 	.catch(function(error) {
				// 		log('Request failed', error)
				// 	});
			}
		}
	};

	componentDidUpdate(prevProps) {
		if (prevProps.mod._id !== this.props.mod._id) {
			this.onModChange();
		}
	}

	componentDidMount() {
		this.onModChange();

		ipcRenderer.on('httpResponse', (event, args) => {
			if (this.props.mod._id === args.id) {

				if (args.type === 'spacedock') {
					this.setState({
						spacedock: JSON.parse(args.data)
					});
				}

			}
		});
	}

	render() {
		const { classes, mod } = this.props;

		const screenshot = mod.resources['x_screenshot'];

		console.log(mod);

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

Mod.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Mod);

import React from 'react'
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';

import { ipcRenderer } from 'electron';
import {injectState} from "freactal";

const styles = theme => ({
	root: {}
});

class ModInstall extends React.Component {
	render() {
		return <div>Hello world!</div>
	}
}

ModInstall.propTypes = {
	classes: PropTypes.object.isRequired,
};

export default injectState(withStyles(styles)(ModInstall));

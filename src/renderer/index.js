'use strict';
import React from 'react';
import { render } from 'react-dom';

import './main.scss';

import {MuiThemeProvider, createMuiTheme} from 'material-ui';

import App from './app';
import Updater from './update';

render(
	<MuiThemeProvider theme={createMuiTheme()}>
		<Updater />
		<App />
	</MuiThemeProvider>,
	document.getElementById('app')
);

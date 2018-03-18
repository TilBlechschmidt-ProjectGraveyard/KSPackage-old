import React from "react";
import {Typography} from "material-ui";

import "./Loader.scss";

export default class Loader extends React.Component {
	render() {
		return (
			<div>
				<div className="sk-cube-grid">
					<div className="sk-cube sk-cube1"/>
					<div className="sk-cube sk-cube2"/>
					<div className="sk-cube sk-cube3"/>
					<div className="sk-cube sk-cube4"/>
					<div className="sk-cube sk-cube5"/>
					<div className="sk-cube sk-cube6"/>
					<div className="sk-cube sk-cube7"/>
					<div className="sk-cube sk-cube8"/>
					<div className="sk-cube sk-cube9"/>
				</div>
				<div style={{textAlign: 'center'}}>
					<Typography type="subheading" color="inherit">
						{this.props.text} ...
					</Typography>
				</div>
			</div>
		);
	}
}

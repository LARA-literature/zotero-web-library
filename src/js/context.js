'use strict'

import React from 'react';

const UserContext = React.createContext({
	isKeyboardUser: false,
	isMouseUser: false,
	isTouchUser: false,
	userType: 'mouse'
});

const ViewportContext = React.createContext({
	xxs: false,
	xs: false,
	sm: false,
	md: false,
	lg: true,
});

export { UserContext, ViewportContext };

'use strict';

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';

import { triggerUserTypeChange } from '../actions';

const keysToTriggerKeyboardMode = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'];

const UserTypeDetector = () => {
	const dispatch = useDispatch();
	const lastTouchStartEvent = useRef(0);

	const handleKeyboard = useCallback(ev => {
		if(keysToTriggerKeyboardMode.includes(ev.key)) {
			dispatch(triggerUserTypeChange({ 'isKeyboardUser': true, }));
		}
	});

	const handleMouse = useCallback(ev => {
		// prevent simulated mouse events triggering mouse user
		if(!lastTouchStartEvent.current || ev.timeStamp - lastTouchStartEvent.current > 500) {
			dispatch(triggerUserTypeChange({
				'isKeyboardUser': false,
				'isMouseUser': true,
				'isTouchUser': false,
				'userType': 'mouse'
			}));
		}
	});

	const handleTouch = useCallback(ev => {
		lastTouchStartEvent.current = ev.timeStamp;
		// NOTE: This is guess work and might not be future-proof. E.g. if Apple releases
		// 		 touch-capable MacBook it would probably trigger this.
		const isTouchRequestingDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
		dispatch(triggerUserTypeChange({
			'isKeyboardUser': false,
			'isMouseUser': isTouchRequestingDesktop,
			'isTouchUser': !isTouchRequestingDesktop,
			'userType': isTouchRequestingDesktop ? 'mouse' : 'touch',
			isTouchRequestingDesktop
		}));
	});

	useEffect(() => {
		document.addEventListener('keyup', handleKeyboard);
		document.addEventListener('mousedown', handleMouse);
		document.addEventListener('touchstart', handleTouch);

		return () => {
			document.removeEventListener('keyup', handleKeyboard);
			document.removeEventListener('mousedown', handleMouse);
			document.removeEventListener('touchstart', handleTouch);
		}
	}, []);

	return null;
}

export default UserTypeDetector;

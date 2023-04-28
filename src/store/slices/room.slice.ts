/** @format */

import { createSlice } from '@reduxjs/toolkit';
import { obfuscate } from '../../utils/obfuscators/obfuscate';

// Save the initial state of the room to a variable
let initialState = {
	currentRoom: 'introduction',
	previousRoom: '',
};
const storage = obfuscate('room');

// Get the initial state of the room from local storage
const localRoom = storage.getItem(storage.key);
// If the initial state of the room is not in local storage, save it
if (!localRoom) {
	// Save the initial state of the room to local storage
	storage.setItem(storage.key, JSON.stringify(initialState));
}
// If the initial state of the room is in local storage, set it
else {
	initialState = JSON.parse(localRoom);
}
const roomSlice = createSlice({
	name: 'screen',
	initialState: initialState,
	reducers: {
		updateRoom: (state, action) => {
			state.previousRoom = state.currentRoom;
			state.currentRoom = action.payload;
			storage.setItem(storage.key, JSON.stringify(state));
		},
	},
});

export const { updateRoom } = roomSlice.actions;

export default roomSlice.reducer;

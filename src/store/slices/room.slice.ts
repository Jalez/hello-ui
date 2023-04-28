/** @format */

import { createSlice } from '@reduxjs/toolkit';

const roomSlice = createSlice({
	name: 'screen',
	initialState: {
		currentRoom: 'introduction',
		previousRoom: '',
	},
	reducers: {
		updateRoom: (state, action) => {
			state.previousRoom = state.currentRoom;
			state.currentRoom = action.payload;
		},
	},
});

export const { updateRoom } = roomSlice.actions;

export default roomSlice.reducer;

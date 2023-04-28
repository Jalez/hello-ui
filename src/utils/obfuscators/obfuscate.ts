/** @format */

export const obfuscate = (originalKey: string) => {
	const obfuscatedKey = btoa(originalKey);
	const setItem = (key: string, value: string) => {
		localStorage.setItem(obfuscatedKey + btoa(key), btoa(value));
	};
	const getItem = (key: string): string | null => {
		const item = localStorage.getItem(obfuscatedKey + btoa(key));
		if (item === null) {
			return null;
		}
		return atob(item);
	};
	const removeItem = (key: string) => {
		localStorage.removeItem(obfuscatedKey + btoa(key));
	};
	return {
		setItem,
		getItem,
		removeItem,
		key: obfuscatedKey,
	};
};

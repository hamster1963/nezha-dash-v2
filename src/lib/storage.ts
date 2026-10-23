/** Browser persistence is optional: both the storage getter and its methods
 * can throw (privacy settings, sandboxed frames, or exhausted quota). Resolve
 * storage lazily so module initialization never depends on browser access. */
function createSafeStorage(area: "localStorage" | "sessionStorage") {
	return {
		getItem(key: string): string | null {
			try {
				return window[area].getItem(key);
			} catch {
				return null;
			}
		},
		setItem(key: string, value: string): boolean {
			try {
				window[area].setItem(key, value);
				return true;
			} catch {
				return false;
			}
		},
		removeItem(key: string): boolean {
			try {
				window[area].removeItem(key);
				return true;
			} catch {
				return false;
			}
		},
	};
}

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");

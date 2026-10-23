// Function to handle public_note with sessionStorage
export function handlePublicNote(serverId: number, publicNote: string): string {
	const storageKey = `server_${serverId}_public_note`;
	const storedNote = sessionStorage.getItem(storageKey);

	if (!publicNote && storedNote) {
		return storedNote;
	}

	if (publicNote) {
		sessionStorage.setItem(storageKey, publicNote);
		return publicNote;
	}

	return "";
}

import { safeSessionStorage } from "@/lib/storage";
import type { NezhaServer } from "@/types/nezha-api";

/** Explicit data-receipt operation. Never call from a render or selector. */
export function handlePublicNote(serverId: number, publicNote: string): string {
	const storageKey = `server_${serverId}_public_note`;
	if (publicNote) {
		safeSessionStorage.setItem(storageKey, publicNote);
		return publicNote;
	}
	return safeSessionStorage.getItem(storageKey) || "";
}

/** Restore omitted notes once when a server snapshot arrives, before React
 * consumes it. Preserve server identities whenever no restoration is needed. */
export function restoreServerPublicNotes(
	servers: NezhaServer[],
): NezhaServer[] {
	return servers.map((server) => {
		const publicNote = handlePublicNote(server.id, server.public_note || "");
		return publicNote === server.public_note
			? server
			: { ...server, public_note: publicNote };
	});
}

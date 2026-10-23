import { describe, expect, it, vi } from "vitest";
import { restoreServerPublicNotes } from "@/lib/public-note-cache";
import { selectServerMetrics } from "@/lib/server-metrics";
import { formatNezhaInfo, handlePublicNote } from "@/lib/utils";
import { createServer } from "@/test/fixtures";

const now = Date.parse("2025-01-01T00:00:30.000Z");

describe("pure server metrics", () => {
	it("preserves snapshot fields, units and the inclusive online cutoff", () => {
		const server = createServer({ public_note: "new note" });
		const snapshot = structuredClone(server);
		expect(selectServerMetrics(now, server)).toMatchObject({
			cpu: 12,
			mem: 25,
			swap: 10,
			disk: 25,
			stg: 25,
			up: 2,
			down: 1,
			load_1: "0.12",
			online: true,
			public_note: "new note",
			host: server.host,
			state: server.state,
		});
		expect(selectServerMetrics(now + 1, server).online).toBe(false);
		expect(server).toEqual(snapshot);
	});

	it("never touches storage even when storage is inaccessible", () => {
		const storage = vi
			.spyOn(window, "sessionStorage", "get")
			.mockImplementation(() => {
				throw new Error("storage unavailable");
			});
		try {
			expect(selectServerMetrics(now, createServer()).public_note).toBe("");
			expect(formatNezhaInfo(now, createServer()).public_note).toBe("");
			expect(
				formatNezhaInfo(now, createServer({ public_note: "live" })).public_note,
			).toBe("live");
			expect(storage).not.toHaveBeenCalled();
		} finally {
			storage.mockRestore();
		}
	});

	it("preserves zero-date, missing-note and zero-total fallbacks", () => {
		const metrics = selectServerMetrics(
			now,
			createServer({
				last_active: "0001-01-01T00:00:00Z",
				host: {
					mem_total: 0,
					swap_total: 0,
					disk_total: 0,
					boot_time: 0,
					version: "",
				},
				state: { mem_used: 0, swap_used: 0, disk_used: 0, cpu: 0 },
			}),
		);
		expect(metrics).toMatchObject({
			mem: 0,
			swap: 0,
			disk: 0,
			cpu: 0,
			online: false,
			last_active_time_string: "",
			boot_time_string: "",
			version: null,
		});
	});

	it("restores cached notes at data receipt while keeping both projections pure", () => {
		sessionStorage.clear();
		const server = createServer({ id: 42, public_note: "first" });
		const pure = selectServerMetrics(now, server);
		expect(sessionStorage.length).toBe(0);
		expect(formatNezhaInfo(now, server)).toEqual(pure);
		expect(sessionStorage.length).toBe(0);
		restoreServerPublicNotes([server]);
		expect(sessionStorage.getItem("server_42_public_note")).toBe("first");
		const [restored] = restoreServerPublicNotes([
			{ ...server, public_note: "" },
		]);
		expect(formatNezhaInfo(now, restored).public_note).toBe("first");
		expect(
			formatNezhaInfo(now, { ...server, public_note: "" }).public_note,
		).toBe("");
		expect(
			selectServerMetrics(now, { ...server, public_note: "" }).public_note,
		).toBe("");
		expect(handlePublicNote(43, "")).toBe("");
		expect(handlePublicNote(42, "replacement")).toBe("replacement");
		expect(handlePublicNote(42, "")).toBe("replacement");
	});
});

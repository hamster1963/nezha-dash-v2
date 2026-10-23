import { describe, expect, it } from "vitest";
import { SORT_TYPES } from "@/context/sort-context";
import {
	isServerOnline,
	selectGroupServerIds,
	selectGroupTabs,
	selectServers,
} from "@/features/servers/selectors";
import { createServer } from "@/test/fixtures";
import type { NezhaServer, ServerGroup } from "@/types/nezha-api";

const now = Date.parse("2025-01-01T00:00:30.000Z");
const low = createServer({
	id: 1,
	name: "Alpha",
	host: { platform: "a", mem_total: 100, disk_total: 100 },
	state: {
		cpu: 1,
		uptime: 1,
		mem_used: 1,
		disk_used: 1,
		net_out_speed: 1,
		net_in_speed: 1,
		net_out_transfer: 1,
		net_in_transfer: 1,
	},
});
const high = createServer({
	id: 2,
	name: "Zulu",
	host: { platform: "z", mem_total: 100, disk_total: 100 },
	state: {
		cpu: 2,
		uptime: 2,
		mem_used: 2,
		disk_used: 2,
		net_out_speed: 2,
		net_in_speed: 2,
		net_out_transfer: 2,
		net_in_transfer: 2,
	},
});
const offline = createServer({
	id: 3,
	name: "Aaron",
	last_active: "0001-01-01T00:00:00Z",
});
const offline2 = createServer({ id: 4, name: "Zed", last_active: "invalid" });
const options = {
	data: { now, servers: [offline, high, offline2, low] },
	currentGroup: "All",
	groupServerIdSets: new Map<string, Set<number>>(),
	status: "all" as const,
	sortType: "default" as const,
	sortOrder: "desc" as const,
};
const ids = (servers: NezhaServer[]) => servers.map((server) => server.id);

describe("server selectors", () => {
	it("uses the inclusive 30-second boundary and preserves date semantics", () => {
		expect(isServerOnline(now, low)).toBe(true);
		expect(isServerOnline(now + 1, low)).toBe(false);
		expect(isServerOnline(now - 31_000, low)).toBe(true);
		expect(isServerOnline(now, offline)).toBe(false);
		expect(isServerOnline(now, offline2)).toBe(false);
	});
	it("preserves tab order and deduplicates group membership", () => {
		const groups: ServerGroup[] = [
			{
				group: { id: 1, name: "Europe", created_at: "", updated_at: "" },
				servers: [1, 1, 3],
			},
		];
		expect(selectGroupTabs(groups)).toEqual(["All", "Europe"]);
		expect([...(selectGroupServerIds(groups).get("Europe") ?? [])]).toEqual([
			1, 3,
		]);
		expect(selectGroupTabs(undefined)).toEqual(["All"]);
		expect(selectGroupServerIds(undefined).size).toBe(0);
	});
	it.each([
		"asc",
		"desc",
	] as const)("default %s keeps stable online-first ordering", (sortOrder) => {
		expect(
			ids(selectServers({ ...options, sortOrder }).filteredServers),
		).toEqual([2, 1, 3, 4]);
		expect(ids(options.data.servers)).toEqual([3, 2, 4, 1]);
	});
	it.each(
		SORT_TYPES.filter((type) => type !== "default" && type !== "name"),
	)("sorts %s online metrics both ways and leaves offline order unchanged", (sortType) => {
		expect(
			ids(
				selectServers({ ...options, sortType, sortOrder: "asc" })
					.filteredServers,
			),
		).toEqual([1, 2, 3, 4]);
		expect(
			ids(
				selectServers({ ...options, sortType, sortOrder: "desc" })
					.filteredServers,
			),
		).toEqual([2, 1, 3, 4]);
	});
	it("name sorting includes offline servers", () => {
		expect(
			ids(
				selectServers({ ...options, sortType: "name", sortOrder: "asc" })
					.filteredServers,
			),
		).toEqual([3, 1, 4, 2]);
		expect(
			ids(
				selectServers({ ...options, sortType: "name", sortOrder: "desc" })
					.filteredServers,
			),
		).toEqual([2, 4, 1, 3]);
	});
	it.each([
		"all",
		"online",
		"offline",
	] as const)("keeps group overview independent of status %s", (status) => {
		const result = selectServers({
			...options,
			status,
			currentGroup: "Europe",
			groupServerIdSets: new Map([["Europe", new Set([1, 3])]]),
		});
		expect(result).toMatchObject({
			totalServers: 2,
			onlineServers: 1,
			offlineServers: 1,
			up: 1,
			down: 1,
			upSpeed: 1,
			downSpeed: 1,
		});
		expect(ids(result.filteredServers)).toEqual(
			status === "all" ? [1, 3] : status === "online" ? [1] : [3],
		);
	});
	it("handles missing payload and unknown groups", () => {
		for (const result of [
			selectServers({ ...options, data: null }),
			selectServers({ ...options, currentGroup: "Missing" }),
		]) {
			expect(result).toEqual({
				totalServers: 0,
				onlineServers: 0,
				offlineServers: 0,
				up: 0,
				down: 0,
				upSpeed: 0,
				downSpeed: 0,
				filteredServers: [],
			});
		}
	});
	it("handles zero totals and absent optional runtime metrics without NaN ordering", () => {
		const zero = createServer({ id: 5, host: { mem_total: 0, disk_total: 0 } });
		const absent = {
			...low,
			id: 6,
			host: undefined,
			state: undefined,
		} as unknown as NezhaServer;
		for (const sortType of SORT_TYPES.filter(
			(type) => type !== "default" && type !== "name",
		)) {
			const result = selectServers({
				...options,
				data: { now, servers: [high, absent, low] },
				sortType,
				sortOrder: "asc",
			});
			expect(ids(result.filteredServers)).toEqual([6, 1, 2]);
		}
		for (const sortType of ["mem", "disk"] as const) {
			expect(
				ids(
					selectServers({
						...options,
						data: { now, servers: [high, zero, low] },
						sortType,
						sortOrder: "asc",
					}).filteredServers,
				),
			).toEqual([5, 1, 2]);
		}
	});
	it("preserves incoming order for tied metrics", () => {
		const tied = createServer({ ...low, id: 7 });
		expect(
			ids(
				selectServers({
					...options,
					data: { now, servers: [tied, low] },
					sortType: "cpu",
				}).filteredServers,
			),
		).toEqual([7, 1]);
	});
});

import type { SortOrder, SortType } from "@/context/sort-context";
import type { Status } from "@/context/status-context";
import type {
	NezhaServer,
	NezhaWebsocketResponse,
	ServerGroup,
} from "@/types/nezha-api";

type PreparedServer = {
	online: boolean;
	server: NezhaServer;
};

const EMPTY_SERVER_LIST: NezhaServer[] = [];

export const isServerOnline = (now: number, server: NezhaServer) => {
	const lastActiveTime = server.last_active.startsWith("000")
		? 0
		: Date.parse(server.last_active);

	return now - lastActiveTime <= 30000;
};

const getUsagePercent = (used = 0, total = 0) => {
	if (!total) return 0;
	return (used / total) * 100;
};

export function selectGroupServerIds(groups: ServerGroup[] | undefined) {
	const sets = new Map<string, Set<number>>();

	for (const item of groups ?? []) {
		if (Array.isArray(item.servers)) {
			sets.set(item.group.name, new Set(item.servers));
		}
	}

	return sets;
}

export function selectGroupTabs(groups: ServerGroup[] | undefined) {
	return ["All", ...(groups?.map((item) => item.group.name) || [])];
}

export function selectServers({
	data: nezhaWsData,
	currentGroup,
	groupServerIdSets,
	status,
	sortType,
	sortOrder,
}: {
	data: NezhaWebsocketResponse | null | undefined;
	currentGroup: string;
	groupServerIdSets: Map<string, Set<number>>;
	status: Status;
	sortType: SortType;
	sortOrder: SortOrder;
}) {
	if (!nezhaWsData) {
		return {
			down: 0,
			downSpeed: 0,
			filteredServers: EMPTY_SERVER_LIST,
			offlineServers: 0,
			onlineServers: 0,
			totalServers: 0,
			up: 0,
			upSpeed: 0,
		};
	}

	const currentGroupServerIds = groupServerIdSets.get(currentGroup);
	const groupFilteredServers: PreparedServer[] = [];
	const overview = {
		down: 0,
		downSpeed: 0,
		offlineServers: 0,
		onlineServers: 0,
		up: 0,
		upSpeed: 0,
	};

	for (const server of nezhaWsData.servers) {
		if (currentGroup !== "All" && !currentGroupServerIds?.has(server.id)) {
			continue;
		}

		const online = isServerOnline(nezhaWsData.now, server);

		groupFilteredServers.push({
			online,
			server,
		});

		if (!online) {
			overview.offlineServers += 1;
			continue;
		}

		overview.onlineServers += 1;
		overview.up += server.state?.net_out_transfer ?? 0;
		overview.down += server.state?.net_in_transfer ?? 0;
		overview.upSpeed += server.state?.net_out_speed ?? 0;
		overview.downSpeed += server.state?.net_in_speed ?? 0;
	}

	// The overview describes the selected group, independently of the status filter.
	const statusFilteredServers =
		status === "all"
			? groupFilteredServers
			: groupFilteredServers.filter((item) =>
					status === "online" ? item.online : !item.online,
				);

	// Default order is a stable partition, not a metric sort (direction is ignored).
	if (sortType === "default") {
		const onlineServers: NezhaServer[] = [];
		const offlineServers: NezhaServer[] = [];

		for (const item of statusFilteredServers) {
			if (item.online) {
				onlineServers.push(item.server);
			} else {
				offlineServers.push(item.server);
			}
		}

		return {
			...overview,
			filteredServers: [...onlineServers, ...offlineServers],
			totalServers: groupFilteredServers.length,
		};
	}

	const sortedServers = [...statusFilteredServers].sort((a, b) => {
		if (sortType !== "name") {
			if (!a.online && b.online) return 1;
			if (a.online && !b.online) return -1;
			if (!a.online && !b.online) {
				return 0;
			}
		}

		let comparison = 0;

		switch (sortType) {
			case "name":
				comparison = a.server.name.localeCompare(b.server.name);
				break;
			case "uptime":
				comparison =
					(a.server.state?.uptime ?? 0) - (b.server.state?.uptime ?? 0);
				break;
			case "system":
				comparison = (a.server.host?.platform ?? "").localeCompare(
					b.server.host?.platform ?? "",
				);
				break;
			case "cpu":
				comparison = (a.server.state?.cpu ?? 0) - (b.server.state?.cpu ?? 0);
				break;
			case "mem":
				comparison =
					getUsagePercent(a.server.state?.mem_used, a.server.host?.mem_total) -
					getUsagePercent(b.server.state?.mem_used, b.server.host?.mem_total);
				break;
			case "disk":
				comparison =
					getUsagePercent(
						a.server.state?.disk_used,
						a.server.host?.disk_total,
					) -
					getUsagePercent(b.server.state?.disk_used, b.server.host?.disk_total);
				break;
			case "up":
				comparison =
					(a.server.state?.net_out_speed ?? 0) -
					(b.server.state?.net_out_speed ?? 0);
				break;
			case "down":
				comparison =
					(a.server.state?.net_in_speed ?? 0) -
					(b.server.state?.net_in_speed ?? 0);
				break;
			case "up total":
				comparison =
					(a.server.state?.net_out_transfer ?? 0) -
					(b.server.state?.net_out_transfer ?? 0);
				break;
			case "down total":
				comparison =
					(a.server.state?.net_in_transfer ?? 0) -
					(b.server.state?.net_in_transfer ?? 0);
				break;
			default:
				comparison = 0;
		}

		return sortOrder === "asc" ? comparison : -comparison;
	});

	return {
		...overview,
		filteredServers: sortedServers.map((item) => item.server),
		totalServers: groupFilteredServers.length,
	};
}

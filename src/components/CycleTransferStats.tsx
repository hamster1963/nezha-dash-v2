import type React from "react";
import type { CycleTransferStats, NezhaServer } from "@/types/nezha-api";

import { CycleTransferStatsClient } from "./CycleTransferStatsClient";

interface CycleTransferStatsProps {
	serverList: NezhaServer[];
	cycleStats: CycleTransferStats;
	className?: string;
}

export const CycleTransferStatsCard: React.FC<CycleTransferStatsProps> = ({
	serverList,
	cycleStats,
	className,
}) => {
	if (serverList.length === 0) {
		return null;
	}

	const serverIdList = serverList.map((server) => server.id.toString());

	return (
		<section className="grid grid-cols-1 md:grid-cols-3 gap-3">
			{Object.entries(cycleStats).map(([cycleId, cycleData]) => {
				if (!cycleData.server_name) {
					return null;
				}

				return Object.entries(cycleData.server_name).map(
					([serverId, serverName]) => {
						const transfer = cycleData.transfer?.[serverId] || 0;
						const nextUpdate = cycleData.next_update?.[serverId];

						if (!serverIdList.includes(serverId)) {
							return null;
						}

						if (!transfer && !nextUpdate) {
							return null;
						}

						// Support per-server max values (map) or single max value (number)
						const max =
							typeof cycleData.max === "object"
								? cycleData.max[serverId] ?? 0
								: cycleData.max;

						// Support per-server from values (map) or single from value (string)
						const from =
							typeof cycleData.from === "object"
								? cycleData.from[serverId] ?? ""
								: cycleData.from;

						// Support per-server to values (map) or single to value (string)
						const to =
							typeof cycleData.to === "object"
								? cycleData.to[serverId] ?? ""
								: cycleData.to;

						return (
							<CycleTransferStatsClient
								key={`${cycleId}-${serverId}`}
								name={cycleData.name}
								from={from}
								to={to}
								max={max}
								serverStats={[
									{
										serverId,
										serverName,
										transfer,
										nextUpdate: nextUpdate || "",
									},
								]}
								className={className}
							/>
						);
					},
				);
			})}
		</section>
	);
};

export default CycleTransferStatsCard;

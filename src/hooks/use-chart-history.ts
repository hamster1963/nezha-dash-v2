import { useEffect, useState } from "react";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export function useChartHistory<T>(
	messageHistory: NezhaWebsocketResponse[],
	serverId: number,
	formatFn: (wsData: NezhaWebsocketResponse, serverId: number) => T | null,
) {
	const [data, setData] = useState<T[]>([]);

	useEffect(() => {
		if (messageHistory.length > 0 && data.length === 0) {
			const historyData = messageHistory
				.map((wsData) => {
					return formatFn(wsData, serverId);
				})
				.filter((item): item is T => item !== null)
				.reverse();

			setData(historyData);
		}
	}, [messageHistory, data.length, formatFn, serverId]);

	return data;
}

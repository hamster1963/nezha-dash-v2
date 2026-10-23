import { selectServerMetrics } from "@/lib/server-metrics";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";
import type {
	connectChartData,
	cpuChartData,
	diskChartData,
	gpuChartData,
	memChartData,
	networkChartData,
	processChartData,
} from "./chart-types";

export type RealtimeSeries = {
	cpu: cpuChartData[];
	gpu: gpuChartData[][];
	mem: memChartData[];
	disk: diskChartData[];
	process: processChartData[];
	network: networkChartData[];
	connect: connectChartData[];
};

/** Provider history is newest-first. The current frame wins timestamp collisions.
 * Normalize once per server, retain at most 30 frames, then render oldest-first.
 * Missing servers/cards produce no sample; zero and unchanged values are samples.
 */
export function projectRealtimeSeries(
	messageHistory: readonly NezhaWebsocketResponse[],
	lastData: NezhaWebsocketResponse | null,
	serverId: number,
): RealtimeSeries {
	const frames = new Map<number, NezhaWebsocketResponse>();
	for (const frame of lastData
		? [lastData, ...messageHistory]
		: messageHistory) {
		if (!frames.has(frame.now)) frames.set(frame.now, frame);
	}
	const ordered = [...frames.values()]
		.sort((a, b) => b.now - a.now)
		.slice(0, 30)
		.reverse();
	const series: RealtimeSeries = {
		cpu: [],
		gpu: [],
		mem: [],
		disk: [],
		process: [],
		network: [],
		connect: [],
	};
	for (const frame of ordered) {
		const server = frame.servers.find((server) => server.id === serverId);
		if (!server) continue;
		const { cpu, gpu, mem, swap, disk, process, up, down, tcp, udp } =
			selectServerMetrics(frame.now, server);
		const timeStamp = String(frame.now);
		series.cpu.push({ timeStamp, cpu });
		gpu.forEach((value, index) => {
			if (!Number.isFinite(value)) return;
			series.gpu[index] ??= [];
			series.gpu[index].push({ timeStamp, gpu: value });
		});
		series.mem.push({ timeStamp, mem, swap });
		series.disk.push({ timeStamp, disk });
		series.process.push({ timeStamp, process });
		series.network.push({ timeStamp, upload: up, download: down });
		series.connect.push({ timeStamp, tcp, udp });
	}
	return series;
}

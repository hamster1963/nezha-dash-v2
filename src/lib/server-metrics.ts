import dayjs from "dayjs";
import type { NezhaServer } from "@/types/nezha-api";

/** Pure snapshot projection. Never reads or writes the public-note cache. */
export function selectServerMetrics(now: number, serverInfo: NezhaServer) {
	const lastActiveTime = serverInfo.last_active.startsWith("000")
		? 0
		: new Date(serverInfo.last_active).getTime();
	return {
		...serverInfo,
		cpu: serverInfo.state.cpu || 0,
		gpu: serverInfo.state.gpu || [],
		process: serverInfo.state.process_count || 0,
		up: serverInfo.state.net_out_speed / 1024 / 1024 || 0,
		down: serverInfo.state.net_in_speed / 1024 / 1024 || 0,
		last_active_time_string: lastActiveTime
			? dayjs(lastActiveTime).format("YYYY-MM-DD HH:mm:ss")
			: "",
		online: now - lastActiveTime <= 30000,
		uptime: serverInfo.state.uptime || 0,
		version: serverInfo.host.version || null,
		tcp: serverInfo.state.tcp_conn_count || 0,
		udp: serverInfo.state.udp_conn_count || 0,
		mem: (serverInfo.state.mem_used / serverInfo.host.mem_total) * 100 || 0,
		swap: (serverInfo.state.swap_used / serverInfo.host.swap_total) * 100 || 0,
		disk: (serverInfo.state.disk_used / serverInfo.host.disk_total) * 100 || 0,
		stg: (serverInfo.state.disk_used / serverInfo.host.disk_total) * 100 || 0,
		country_code: serverInfo.country_code,
		platform: serverInfo.host.platform || "",
		net_out_transfer: serverInfo.state.net_out_transfer || 0,
		net_in_transfer: serverInfo.state.net_in_transfer || 0,
		arch: serverInfo.host.arch || "",
		mem_total: serverInfo.host.mem_total || 0,
		swap_total: serverInfo.host.swap_total || 0,
		disk_total: serverInfo.host.disk_total || 0,
		boot_time: serverInfo.host.boot_time || 0,
		boot_time_string: serverInfo.host.boot_time
			? dayjs(serverInfo.host.boot_time * 1000).format("YYYY-MM-DD HH:mm:ss")
			: "",
		platform_version: serverInfo.host.platform_version || "",
		cpu_info: serverInfo.host.cpu || [],
		gpu_info: serverInfo.host.gpu || [],
		load_1: serverInfo.state.load_1?.toFixed(2) || 0.0,
		load_5: serverInfo.state.load_5?.toFixed(2) || 0.0,
		load_15: serverInfo.state.load_15?.toFixed(2) || 0.0,
		public_note: serverInfo.public_note || "",
	};
}

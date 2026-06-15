import type { NezhaServer } from "@/types/nezha-api";

type NezhaServerOverrides = Omit<Partial<NezhaServer>, "host" | "state"> & {
	host?: Partial<NezhaServer["host"]>;
	state?: Partial<NezhaServer["state"]>;
};

const baseHost: NezhaServer["host"] = {
	platform: "linux",
	platform_version: "6.8",
	cpu: ["AMD EPYC"],
	gpu: [],
	mem_total: 200,
	disk_total: 400,
	swap_total: 100,
	arch: "amd64",
	boot_time: 1_735_603_200,
	version: "1.0.0",
};

const baseState: NezhaServer["state"] = {
	cpu: 12,
	mem_used: 50,
	swap_used: 10,
	disk_used: 100,
	net_in_transfer: 1024 ** 3,
	net_out_transfer: 2 * 1024 ** 3,
	net_in_speed: 1024 ** 2,
	net_out_speed: 2 * 1024 ** 2,
	uptime: 86_400,
	load_1: 0.12,
	load_5: 0.45,
	load_15: 0.78,
	tcp_conn_count: 8,
	udp_conn_count: 4,
	process_count: 88,
	temperatures: [],
	gpu: [],
};

export function createServer(
	overrides: NezhaServerOverrides = {},
): NezhaServer {
	return {
		id: 1,
		name: "edge-1",
		public_note: "",
		last_active: "2025-01-01T00:00:00.000Z",
		country_code: "us",
		...overrides,
		host: {
			...baseHost,
			...overrides.host,
		},
		state: {
			...baseState,
			...overrides.state,
		},
	};
}

export function createSettingResponse() {
	return {
		success: true,
		data: {
			config: {
				debug: false,
				language: "en-US",
				site_name: "Nezha",
				user_template: "",
				admin_template: "",
				custom_code: "",
			},
			version: "1.0.0",
		},
	};
}

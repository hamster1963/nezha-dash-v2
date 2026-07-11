import http from "node:http";
import { URL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.MOCK_NEZHA_PORT || 8008);
const serverCount = Number(process.env.MOCK_NEZHA_COUNT || 3000);
const updateIntervalMs = Number(
	process.env.MOCK_NEZHA_INTERVAL_MS || (serverCount > 10_000 ? 0 : 2000),
);

const countries = [
	"US",
	"SG",
	"JP",
	"DE",
	"GB",
	"FR",
	"NL",
	"CA",
	"AU",
	"BR",
	"IN",
	"KR",
	"HK",
	"TW",
	"FI",
	"PL",
];

const platforms = ["linux", "debian", "ubuntu", "centos", "alpine", "Windows"];

const nowIso = () => new Date().toISOString();

function createServer(index) {
	const id = index + 1;
	const platform = platforms[index % platforms.length];
	const memTotal = 2 ** 30 * (2 + (index % 15));
	const diskTotal = 2 ** 30 * (40 + (index % 200));
	const swapTotal = 2 ** 30 * (index % 8);
	const memUsed = memTotal * ((index % 90) / 100);
	const diskUsed = diskTotal * ((index % 84) / 100);
	const swapUsed = swapTotal ? swapTotal * ((index % 60) / 100) : 0;
	const isOffline = id % 17 === 0;

	return {
		id,
		name: `mock-server-${String(id).padStart(4, "0")}`,
		public_note: id % 19 === 0 ? "[[Plan]] bandwidth=1Gbps" : "",
		last_active: isOffline
			? new Date(Date.now() - 10 * 60 * 1000).toISOString()
			: nowIso(),
		country_code: countries[index % countries.length],
		host: {
			platform,
			platform_version: platform === "Windows" ? "Server 2022" : "6.8",
			cpu: [`Mock CPU ${1 + (index % 8)} Core`],
			gpu: index % 40 === 0 ? ["Mock GPU"] : [],
			mem_total: memTotal,
			disk_total: diskTotal,
			swap_total: swapTotal,
			arch: index % 5 === 0 ? "arm64" : "amd64",
			boot_time: Math.floor(Date.now() / 1000) - 86_400 * (1 + (index % 365)),
			version: "mock-1.0.0",
		},
		state: {
			cpu: (index * 7) % 100,
			mem_used: memUsed,
			swap_used: swapUsed,
			disk_used: diskUsed,
			net_in_transfer: 2 ** 30 * (index % 500),
			net_out_transfer: 2 ** 30 * ((index * 2) % 500),
			net_in_speed: 1024 * (20 + ((index * 13) % 80_000)),
			net_out_speed: 1024 * (20 + ((index * 17) % 80_000)),
			uptime: 3600 * (1 + (index % 20_000)),
			load_1: Number(((index % 100) / 20).toFixed(2)),
			load_5: Number(((index % 80) / 20).toFixed(2)),
			load_15: Number(((index % 60) / 20).toFixed(2)),
			tcp_conn_count: index % 300,
			udp_conn_count: index % 80,
			process_count: 40 + (index % 240),
			temperatures: [],
			gpu: index % 40 === 0 ? [(index * 3) % 100] : [],
		},
	};
}

const servers = Array.from({ length: serverCount }, (_, index) =>
	createServer(index),
);
let onlineCount = servers.filter((server) => server.id % 17 !== 0).length;

function updateServerMetrics() {
	const now = Date.now();
	let nextOnlineCount = 0;

	for (const server of servers) {
		const isOffline = server.id % 17 === 0;
		if (!isOffline) {
			server.last_active = new Date(now).toISOString();
			nextOnlineCount += 1;
		}

		const wave = (now / 1000 + server.id) % 100;
		server.state.cpu = Number(wave.toFixed(2));
		server.state.net_in_speed =
			1024 * (20 + ((server.id * 13 + now / 1000) % 80_000));
		server.state.net_out_speed =
			1024 * (20 + ((server.id * 17 + now / 1000) % 80_000));
		server.state.net_in_transfer += server.state.net_in_speed;
		server.state.net_out_transfer += server.state.net_out_speed;
	}

	onlineCount = nextOnlineCount;
}

function websocketPayload() {
	const payload = { now: Date.now() };

	if (onlineCount > 0) {
		payload.online = onlineCount;
	}
	if (servers.length > 0) {
		payload.servers = servers;
	}

	return JSON.stringify(payload);
}

function jsonResponse(response, data) {
	response.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "no-store",
		"Content-Type": "application/json; charset=utf-8",
	});
	response.end(JSON.stringify(data));
}

const populatedServerGroups = [
	{
		group: {
			id: 1,
			created_at: nowIso(),
			updated_at: nowIso(),
			name: "Region US/EU",
		},
		servers:
			serverCount > 10_000
				? []
				: servers
						.filter((server) =>
							["US", "DE", "GB", "FR", "NL"].includes(server.country_code),
						)
						.map((server) => server.id),
	},
	{
		group: {
			id: 2,
			created_at: nowIso(),
			updated_at: nowIso(),
			name: "Region APAC",
		},
		servers:
			serverCount > 10_000
				? []
				: servers
						.filter((server) =>
							["SG", "JP", "KR", "HK", "TW", "AU"].includes(
								server.country_code,
							),
						)
						.map((server) => server.id),
	},
];
const serverGroups = serverCount === 0 ? [] : populatedServerGroups;

const serviceHistory = Array.from({ length: 30 }, (_, index) => ({
	up: 95 + (index % 6),
	down: index % 13 === 0 ? 1 : 0,
	delay: 20 + index * 3,
}));

const services =
	serverCount === 0
		? {}
		: {
				mock_http: {
					service_name: "Mock HTTP",
					current_up: 1,
					current_down: 0,
					total_up: 2999,
					total_down: 1,
					delay: serviceHistory.map((item) => item.delay),
					up: serviceHistory.map((item) => item.up),
					down: serviceHistory.map((item) => item.down),
				},
			};

const httpServer = http.createServer((request, response) => {
	const requestUrl = new URL(
		request.url || "/",
		`http://${request.headers.host}`,
	);

	if (request.method === "OPTIONS") {
		response.writeHead(204, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		});
		response.end();
		return;
	}

	switch (requestUrl.pathname) {
		case "/api/v1/setting":
			jsonResponse(response, {
				success: true,
				data: {
					config: {
						debug: true,
						language: "en-US",
						site_name: `Nezha Mock ${serverCount}`,
						user_template: "",
						admin_template: "",
						custom_code: "",
					},
					version: "mock-1.0.0",
				},
			});
			return;
		case "/api/v1/server-group":
			jsonResponse(response, { success: true, data: serverGroups });
			return;
		case "/api/v1/service":
			jsonResponse(response, {
				success: true,
				data: {
					services,
					cycle_transfer_stats: {},
				},
			});
			return;
		case "/api/v1/profile":
			jsonResponse(response, {
				success: true,
				data: {
					id: 1,
					username: "mock-user",
					password: "",
					created_at: nowIso(),
					updated_at: nowIso(),
				},
			});
			return;
		default:
			jsonResponse(response, { success: true, data: [] });
	}
});

const websocketServer = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
	if (!request.url?.startsWith("/api/v1/ws/server")) {
		socket.destroy();
		return;
	}

	websocketServer.handleUpgrade(request, socket, head, (websocket) => {
		websocketServer.emit("connection", websocket, request);
	});
});

websocketServer.on("connection", (websocket) => {
	websocket.send(websocketPayload());
});

if (updateIntervalMs > 0) {
	setInterval(() => {
		updateServerMetrics();
		const payload = websocketPayload();
		for (const client of websocketServer.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(payload);
			}
		}
	}, updateIntervalMs);
}

httpServer.listen(port, () => {
	console.log(
		`Mock Nezha API listening on http://localhost:${port} with ${serverCount} servers`,
	);
	if (updateIntervalMs === 0) {
		console.log(
			"Mock Nezha websocket is in static mode. Set MOCK_NEZHA_INTERVAL_MS to enable repeated full-payload updates.",
		);
	}
});

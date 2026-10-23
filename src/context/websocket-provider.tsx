import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";
import {
	WebSocketContext,
	type WebSocketContextType,
} from "./websocket-context";

interface WebSocketProviderProps {
	url: string;
	children: React.ReactNode;
}

type RawNezhaWebsocketResponse = Omit<
	Partial<NezhaWebsocketResponse>,
	"servers"
> & {
	servers?: unknown;
};

function normalizeWebSocketResponse(data: unknown): NezhaWebsocketResponse {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new TypeError("WebSocket message must be an object");
	}

	const response = data as RawNezhaWebsocketResponse;
	if (typeof response.now !== "number" || !Number.isFinite(response.now)) {
		throw new TypeError("WebSocket message must include a finite now value");
	}

	return {
		...response,
		now: response.now,
		servers: Array.isArray(response.servers) ? response.servers : [],
	};
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
	url,
	children,
}) => {
	const [lastData, setLastData] = useState<NezhaWebsocketResponse | null>(null);
	const [messageHistory, setMessageHistory] = useState<
		NezhaWebsocketResponse[]
	>([]);
	const [connected, setConnected] = useState(false);
	const [needReconnect, setNeedReconnect] = useState(false);
	const ws = useRef<WebSocket | null>(null);
	const reconnectTimeout = useRef<NodeJS.Timeout>(null);
	const maxReconnectAttempts = 30;
	const reconnectAttempts = useRef(0);
	const isConnecting = useRef(false);
	const active = useRef(false);
	const lastRecoveryAt = useRef(Number.NEGATIVE_INFINITY);

	const cleanup = useCallback(() => {
		if (ws.current) {
			// 移除所有事件监听器
			ws.current.onopen = null;
			ws.current.onclose = null;
			ws.current.onmessage = null;
			ws.current.onerror = null;

			if (
				ws.current.readyState === WebSocket.OPEN ||
				ws.current.readyState === WebSocket.CONNECTING
			) {
				ws.current.close();
			}
			ws.current = null;
		}
		if (reconnectTimeout.current) {
			clearTimeout(reconnectTimeout.current);
			reconnectTimeout.current = null;
		}
		isConnecting.current = false;
		setConnected(false);
	}, []);

	const connect = useCallback(() => {
		if (!active.current || isConnecting.current) return;

		cleanup();
		isConnecting.current = true;

		const scheduleRetry = () => {
			if (!active.current || reconnectAttempts.current >= maxReconnectAttempts)
				return;
			reconnectTimeout.current = setTimeout(() => {
				reconnectTimeout.current = null;
				reconnectAttempts.current++;
				connect();
			}, 3000);
		};

		try {
			const wsUrl = new URL(url, window.location.origin);
			wsUrl.protocol = wsUrl.protocol.replace("http", "ws");

			ws.current = new WebSocket(wsUrl.toString());

			ws.current.onopen = () => {
				console.log("WebSocket connected");
				setConnected(true);
				reconnectAttempts.current = 0;
				isConnecting.current = false;
			};

			ws.current.onclose = () => {
				console.log("WebSocket disconnected");
				setConnected(false);
				ws.current = null;
				isConnecting.current = false;

				scheduleRetry();
			};

			ws.current.onmessage = (event) => {
				try {
					if (typeof event.data !== "string") {
						throw new Error("WebSocket message data must be a string");
					}

					const newData = normalizeWebSocketResponse(JSON.parse(event.data));
					setLastData(newData);
					// 更新历史消息，保持最新的30条记录
					setMessageHistory((prev) => {
						const updated = [newData, ...prev];
						return updated.slice(0, 30);
					});
				} catch (error) {
					console.error("Failed to parse WebSocket message:", error);
				}
			};

			ws.current.onerror = (error) => {
				console.error("WebSocket error:", error);
				isConnecting.current = false;
			};
		} catch (error) {
			console.error("WebSocket connection error:", error);
			isConnecting.current = false;
			scheduleRetry();
		}
	}, [cleanup, url]);

	const reconnect = useCallback(() => {
		if (!active.current) return;
		reconnectAttempts.current = 0;
		cleanup();
		// The same tracked timer owns both scheduled and manual reconnects.
		reconnectTimeout.current = setTimeout(() => {
			reconnectTimeout.current = null;
			connect();
		}, 1000);
	}, [cleanup, connect]);

	useEffect(() => {
		active.current = true;
		reconnectAttempts.current = 0;
		lastRecoveryAt.current = Number.NEGATIVE_INFINITY;
		setLastData(null);
		setMessageHistory([]);
		connect();

		const recover = () => {
			if (
				!active.current ||
				navigator.onLine === false ||
				isConnecting.current ||
				ws.current?.readyState === WebSocket.OPEN ||
				reconnectTimeout.current ||
				Date.now() - lastRecoveryAt.current < 3000
			)
				return;
			lastRecoveryAt.current = Date.now();
			reconnectAttempts.current = 0;
			connect();
		};
		const handleBeforeUnload = () => {
			// A leave-page confirmation may be cancelled. Only unmount deactivates
			// this provider; focus/online/manual recovery must remain usable.
			cleanup();
		};
		window.addEventListener("online", recover);
		window.addEventListener("focus", recover);
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			active.current = false;
			cleanup();
			window.removeEventListener("online", recover);
			window.removeEventListener("focus", recover);
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [cleanup, connect]);

	const contextValue: WebSocketContextType = {
		lastData,
		connected,
		messageHistory,
		reconnect,
		needReconnect,
		setNeedReconnect,
	};

	return (
		<WebSocketContext.Provider value={contextValue}>
			{children}
		</WebSocketContext.Provider>
	);
};

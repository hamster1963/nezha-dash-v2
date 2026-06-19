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
		setConnected(false);
	}, []);

	const connect = useCallback(() => {
		if (isConnecting.current) {
			console.log("Connection already in progress");
			return;
		}

		cleanup();
		isConnecting.current = true;

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

				if (reconnectAttempts.current < maxReconnectAttempts) {
					reconnectTimeout.current = setTimeout(() => {
						reconnectAttempts.current++;
						connect();
					}, 3000);
				}
			};

			ws.current.onmessage = (event) => {
				try {
					if (typeof event.data !== "string") {
						throw new Error("WebSocket message data must be a string");
					}

					const newData = JSON.parse(event.data) as NezhaWebsocketResponse;
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
		}
	}, [cleanup, url]);

	const reconnect = () => {
		reconnectAttempts.current = 0;
		// 等待一个小延时确保清理完成
		cleanup();
		setTimeout(() => {
			connect();
		}, 1000);
	};

	useEffect(() => {
		connect();

		// 添加页面卸载事件监听
		const handleBeforeUnload = () => {
			cleanup();
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			cleanup();
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

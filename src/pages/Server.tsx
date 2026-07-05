import {
	ArrowDownIcon,
	ArrowsUpDownIcon,
	ArrowUpIcon,
	ChartBarSquareIcon,
	MapIcon,
	ViewColumnsIcon,
} from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalMap from "@/components/GlobalMap";
import GroupSwitch from "@/components/GroupSwitch";
import { Loader } from "@/components/loading/Loader";
import ServerOverview from "@/components/ServerOverview";
import { ServiceTracker } from "@/components/ServiceTracker";
import VirtualServerList from "@/components/VirtualServerList";
import { SORT_TYPES } from "@/context/sort-context";
import { useSort } from "@/hooks/use-sort";
import { useStatus } from "@/hooks/use-status";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerGroup, fetchService } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";
import type { NezhaServer, ServerGroup } from "@/types/nezha-api";

type PreparedServer = {
	online: boolean;
	server: NezhaServer;
};

const EMPTY_SERVER_LIST: NezhaServer[] = [];

const isServerOnline = (now: number, server: NezhaServer) => {
	const lastActiveTime = server.last_active.startsWith("000")
		? 0
		: Date.parse(server.last_active);

	return now - lastActiveTime <= 30000;
};

const getUsagePercent = (used = 0, total = 0) => {
	if (!total) return 0;
	return (used / total) * 100;
};

const getErrorMessage = (error: unknown) => {
	if (!error) return "";
	if (error instanceof Error) return error.message;
	return String(error);
};

function BackendErrorState({ error }: { error: unknown }) {
	const { t } = useTranslation();
	const message = getErrorMessage(error);

	return (
		<div className="flex min-h-96 flex-col items-center justify-center px-4 text-center">
			<div className="flex max-w-md flex-col items-center gap-2">
				<p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
					{t("error.backendUnavailableTitle")}
				</p>
				<p className="text-sm text-muted-foreground">
					{t("error.backendUnavailableDescription")}
				</p>
				{message && (
					<p className="mt-1 max-w-full break-words rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
						{message}
					</p>
				)}
			</div>
		</div>
	);
}

export default function Servers({
	backendError,
}: {
	backendError?: Error | null;
}) {
	const { t } = useTranslation();
	const { sortType, sortOrder, setSortOrder, setSortType } = useSort();
	const { data: groupData, error: groupError } = useQuery({
		queryKey: ["server-group"],
		queryFn: () => fetchServerGroup(),
		retry: false,
	});
	const { data: serviceData, error: serviceError } = useQuery({
		queryKey: ["service"],
		queryFn: () => fetchService(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchInterval: 10000,
		retry: false,
	});
	const hasServices =
		!!serviceData?.data?.services &&
		Object.keys(serviceData.data.services).length > 0;
	const { lastData, connected } = useWebSocketContext();
	const { status } = useStatus();
	const [showServices, setShowServices] = useState<string>("0");
	const [showMap, setShowMap] = useState<string>("0");
	const [inline, setInline] = useState<string>("0");
	const hasRestoredScroll = useRef(false);
	const [currentGroup, setCurrentGroup] = useState<string>("All");
	const nezhaWsData = lastData;

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const restoreScrollPosition = useCallback(() => {
		const isFromMainPage = sessionStorage.getItem("fromMainPage") === "true";
		const savedPosition = sessionStorage.getItem("scrollPosition");
		const scrollTop = savedPosition ? Number(savedPosition) : Number.NaN;

		if (
			hasRestoredScroll.current ||
			!isFromMainPage ||
			!Number.isFinite(scrollTop)
		) {
			return;
		}

		hasRestoredScroll.current = true;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
			});
		});
	}, []);

	const handleTagChange = (newGroup: string) => {
		setCurrentGroup(newGroup);
		sessionStorage.setItem("selectedGroup", newGroup);
		sessionStorage.setItem("scrollPosition", String(window.scrollY || 0));
	};

	useEffect(() => {
		const showServicesState = localStorage.getItem("showServices");
		if (window.ForceShowServices) {
			setShowServices("1");
		} else if (showServicesState !== null) {
			setShowServices(showServicesState);
		}
	}, []);

	useEffect(() => {
		if (!hasServices) {
			setShowServices("0");
		}
	}, [hasServices]);

	useEffect(() => {
		const checkInlineSettings = () => {
			const isMobile = window.innerWidth < 768;

			if (!isMobile) {
				const inlineState = localStorage.getItem("inline");
				if (window.ForceCardInline) {
					setInline("1");
				} else if (inlineState !== null) {
					setInline(inlineState);
				}
			}
		};

		checkInlineSettings();

		window.addEventListener("resize", checkInlineSettings);

		return () => {
			window.removeEventListener("resize", checkInlineSettings);
		};
	}, []);

	useEffect(() => {
		const showMapState = localStorage.getItem("showMap");
		if (window.ForceShowMap) {
			setShowMap("1");
		} else if (showMapState !== null) {
			setShowMap(showMapState);
		}
	}, []);

	useEffect(() => {
		const savedGroup = sessionStorage.getItem("selectedGroup") || "All";
		setCurrentGroup(savedGroup);
	}, []);

	useEffect(() => {
		if (nezhaWsData) {
			restoreScrollPosition();
		}
	}, [nezhaWsData, restoreScrollPosition]);

	const groupServerIdSets = useMemo(() => {
		const sets = new Map<string, Set<number>>();

		for (const item of groupData?.data ?? []) {
			if (Array.isArray(item.servers)) {
				sets.set(item.group.name, new Set(item.servers));
			}
		}

		return sets;
	}, [groupData?.data]);

	const groupTabs = useMemo(
		() => [
			"All",
			...(groupData?.data?.map((item: ServerGroup) => item.group.name) || []),
		],
		[groupData?.data],
	);
	const {
		down,
		downSpeed,
		filteredServers,
		offlineServers,
		onlineServers,
		totalServers,
		up,
		upSpeed,
	} = useMemo(() => {
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

		const statusFilteredServers =
			status === "all"
				? groupFilteredServers
				: groupFilteredServers.filter((item) =>
						status === "online" ? item.online : !item.online,
					);

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
						getUsagePercent(
							a.server.state?.mem_used,
							a.server.host?.mem_total,
						) -
						getUsagePercent(b.server.state?.mem_used, b.server.host?.mem_total);
					break;
				case "disk":
					comparison =
						getUsagePercent(
							a.server.state?.disk_used,
							a.server.host?.disk_total,
						) -
						getUsagePercent(
							b.server.state?.disk_used,
							b.server.host?.disk_total,
						);
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
	}, [
		currentGroup,
		groupServerIdSets,
		nezhaWsData,
		sortOrder,
		sortType,
		status,
	]);

	const currentBackendError = backendError || groupError || serviceError;

	if (!nezhaWsData && currentBackendError) {
		return <BackendErrorState error={currentBackendError} />;
	}

	if (!connected && !lastData) {
		return (
			<div className="flex flex-col items-center min-h-96 justify-center ">
				<div className="font-semibold flex items-center gap-2 text-sm">
					<Loader visible={true} />
					{t("info.websocketConnecting")}
				</div>
			</div>
		);
	}

	if (!nezhaWsData) {
		return (
			<div className="flex flex-col items-center justify-center ">
				<p className="font-semibold text-sm">{t("info.processing")}</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-0">
			<ServerOverview
				total={totalServers}
				online={onlineServers}
				offline={offlineServers}
				up={up}
				down={down}
				upSpeed={upSpeed}
				downSpeed={downSpeed}
			/>
			<div className="flex mt-6 items-center justify-between gap-2 server-overview-controls">
				<section className="flex items-center gap-2 w-full overflow-hidden">
					<button
						onClick={() => {
							setShowMap(showMap === "0" ? "1" : "0");
							localStorage.setItem("showMap", showMap === "0" ? "1" : "0");
						}}
						className={cn(
							"inset-shadow-2xs inset-shadow-white/20 flex cursor-pointer flex-col items-center gap-0 rounded-[50px] bg-blue-100 p-2.5 text-blue-600 transition-all dark:bg-blue-900 dark:text-blue-100",
							{
								"inset-shadow-black/20 bg-blue-600 text-white dark:bg-blue-100 dark:text-blue-600":
									showMap === "1",
							},
							{
								"bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
							},
						)}
					>
						<MapIcon className="size-[13px]" />
					</button>
					{hasServices && (
						<button
							onClick={() => {
								setShowServices(showServices === "0" ? "1" : "0");
								localStorage.setItem(
									"showServices",
									showServices === "0" ? "1" : "0",
								);
							}}
							className={cn(
								"inset-shadow-2xs inset-shadow-white/20 flex cursor-pointer flex-col items-center gap-0 rounded-[50px] bg-blue-100 p-2.5 text-blue-600 transition-all dark:bg-blue-900 dark:text-blue-100",
								{
									"inset-shadow-black/20 bg-blue-600 text-white dark:bg-blue-100 dark:text-blue-600":
										showServices === "1",
								},
								{
									"bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
								},
							)}
						>
							<ChartBarSquareIcon className="size-[13px]" />
						</button>
					)}
					<button
						onClick={() => {
							setInline(inline === "0" ? "1" : "0");
							localStorage.setItem("inline", inline === "0" ? "1" : "0");
						}}
						className={cn(
							"inset-shadow-2xs inset-shadow-white/20 flex cursor-pointer flex-col items-center gap-0 rounded-[50px] bg-blue-100 p-2.5 text-blue-600 transition-all dark:bg-blue-900 dark:text-blue-100",
							{
								"inset-shadow-black/20 bg-blue-600 text-white dark:bg-blue-100 dark:text-blue-600":
									inline === "1",
							},
							{
								"bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
							},
						)}
					>
						<ViewColumnsIcon className="size-[13px]" />
					</button>
					<GroupSwitch
						tabs={groupTabs}
						currentTab={currentGroup}
						setCurrentTab={handleTagChange}
					/>
				</section>
				<div
					className={cn(
						"flex h-8 items-center rounded-full border border-stone-200 bg-white text-sm text-stone-600 shadow-xs transition-all dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:shadow-none shrink-0",
						{
							"dark:border-stone-600/80 dark:bg-stone-800/80 bg-white/75":
								customBackgroundImage,
						},
						{
							" text-blue-600  dark:text-blue-400": sortType !== "default",
						},
					)}
				>
					<button
						aria-label="Toggle sort direction"
						onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
						disabled={sortType === "default"}
						className="flex h-full cursor-pointer items-center gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<div className="text-stone-900 dark:text-stone-100">
							{sortOrder === "asc" && sortType !== "default" ? (
								<ArrowUpIcon className="size-3.5 shrink-0" />
							) : sortOrder === "desc" && sortType !== "default" ? (
								<ArrowDownIcon className="size-3.5 shrink-0" />
							) : (
								<ArrowsUpDownIcon className="size-3.5 shrink-0" />
							)}
						</div>

						<span className="font-medium text-stone-900 dark:text-stone-100">
							{t("sort.label")}
						</span>
					</button>
					<span className="text-stone-300 dark:text-stone-600 mb-0.5">|</span>
					<span className="relative ml-2 mr-3.25 inline-flex items-center">
						<span
							className="pointer-events-none select-none opacity-0 text-sm font-medium whitespace-nowrap"
							aria-hidden
						>
							{t(`sort.types.${sortType.replace(/ /g, "_")}`)}
						</span>
						<select
							aria-label="Sort metric"
							value={sortType}
							onChange={(e) => {
								const val = e.target.value as typeof sortType;
								setSortType(val);
								if (val === "default") setSortOrder("desc");
							}}
							className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-sm font-medium outline-none"
						>
							{SORT_TYPES.map((type) => (
								<option key={type} value={type}>
									{t(`sort.types.${type.replace(/ /g, "_")}`)}
								</option>
							))}
						</select>
					</span>
				</div>
			</div>
			{showMap === "1" && (
				<GlobalMap
					now={nezhaWsData.now}
					serverList={nezhaWsData?.servers || []}
				/>
			)}
			{showServices === "1" && <ServiceTracker serverList={filteredServers} />}
			<VirtualServerList
				inline={inline === "1"}
				now={nezhaWsData.now}
				servers={filteredServers}
			/>
		</div>
	);
}

import {
	ArrowDownIcon,
	ArrowsUpDownIcon,
	ArrowUpIcon,
	ChartBarSquareIcon,
	MapIcon,
	ViewColumnsIcon,
} from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalMap from "@/components/GlobalMap";
import GroupSwitch from "@/components/GroupSwitch";
import { Loader } from "@/components/loading/Loader";
import ServerCard from "@/components/ServerCard";
import ServerCardInline from "@/components/ServerCardInline";
import ServerOverview from "@/components/ServerOverview";
import { ServiceTracker } from "@/components/ServiceTracker";
import { SORT_TYPES } from "@/context/sort-context";
import { useSort } from "@/hooks/use-sort";
import { useStatus } from "@/hooks/use-status";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerGroup } from "@/lib/nezha-api";
import { cn, formatNezhaInfo } from "@/lib/utils";
import type { NezhaWebsocketResponse, ServerGroup } from "@/types/nezha-api";

export default function Servers() {
	const { t } = useTranslation();
	const { sortType, sortOrder, setSortOrder, setSortType } = useSort();
	const { data: groupData } = useQuery({
		queryKey: ["server-group"],
		queryFn: () => fetchServerGroup(),
	});
	const { lastMessage, connected } = useWebSocketContext();
	const { status } = useStatus();
	const [showServices, setShowServices] = useState<string>("0");
	const [showMap, setShowMap] = useState<string>("0");
	const [inline, setInline] = useState<string>("0");
	const containerRef = useRef<HTMLDivElement>(null);
	const [currentGroup, setCurrentGroup] = useState<string>("All");

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const restoreScrollPosition = useCallback(() => {
		const savedPosition = sessionStorage.getItem("scrollPosition");
		if (savedPosition && containerRef.current) {
			containerRef.current.scrollTop = Number(savedPosition);
		}
	}, []);

	const handleTagChange = (newGroup: string) => {
		setCurrentGroup(newGroup);
		sessionStorage.setItem("selectedGroup", newGroup);
		sessionStorage.setItem(
			"scrollPosition",
			String(containerRef.current?.scrollTop || 0),
		);
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

		restoreScrollPosition();
	}, [restoreScrollPosition]);

	const nezhaWsData = lastMessage
		? (JSON.parse(lastMessage.data) as NezhaWebsocketResponse)
		: null;

	const groupTabs = [
		"All",
		...(groupData?.data
			?.filter((item: ServerGroup) => {
				return (
					Array.isArray(item.servers) &&
					item.servers.some((serverId) =>
						nezhaWsData?.servers?.some((server) => server.id === serverId),
					)
				);
			})
			?.map((item: ServerGroup) => item.group.name) || []),
	];

	if (!connected && !lastMessage) {
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

	let filteredServers =
		nezhaWsData?.servers?.filter((server) => {
			if (currentGroup === "All") return true;
			const group = groupData?.data?.find(
				(g: ServerGroup) =>
					g.group.name === currentGroup &&
					Array.isArray(g.servers) &&
					g.servers.includes(server.id),
			);
			return !!group;
		}) || [];

	const totalServers = filteredServers.length || 0;
	const onlineServers =
		filteredServers.filter(
			(server) => formatNezhaInfo(nezhaWsData.now, server).online,
		)?.length || 0;
	const offlineServers =
		filteredServers.filter(
			(server) => !formatNezhaInfo(nezhaWsData.now, server).online,
		)?.length || 0;
	const up =
		filteredServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_out_transfer ?? 0)
					: total,
			0,
		) || 0;
	const down =
		filteredServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_in_transfer ?? 0)
					: total,
			0,
		) || 0;

	const upSpeed =
		filteredServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_out_speed ?? 0)
					: total,
			0,
		) || 0;
	const downSpeed =
		filteredServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_in_speed ?? 0)
					: total,
			0,
		) || 0;

	filteredServers =
		status === "all"
			? filteredServers
			: filteredServers.filter((server) =>
					[status].includes(
						formatNezhaInfo(nezhaWsData.now, server).online
							? "online"
							: "offline",
					),
				);

	filteredServers = filteredServers.sort((a, b) => {
		const serverAInfo = formatNezhaInfo(nezhaWsData.now, a);
		const serverBInfo = formatNezhaInfo(nezhaWsData.now, b);

		if (sortType !== "name") {
			// 仅在非 "name" 排序时，先按在线状态排序
			if (!serverAInfo.online && serverBInfo.online) return 1;
			if (serverAInfo.online && !serverBInfo.online) return -1;
			if (!serverAInfo.online && !serverBInfo.online) {
				// 如果两者都离线，可以继续按照其他条件排序，或者保持原序
				// 这里选择保持原序
				return 0;
			}
		}

		let comparison = 0;

		switch (sortType) {
			case "name":
				comparison = a.name.localeCompare(b.name);
				break;
			case "uptime":
				comparison = (a.state?.uptime ?? 0) - (b.state?.uptime ?? 0);
				break;
			case "system":
				comparison = a.host.platform.localeCompare(b.host.platform);
				break;
			case "cpu":
				comparison = (a.state?.cpu ?? 0) - (b.state?.cpu ?? 0);
				break;
			case "mem":
				comparison =
					(formatNezhaInfo(nezhaWsData.now, a).mem ?? 0) -
					(formatNezhaInfo(nezhaWsData.now, b).mem ?? 0);
				break;
			case "disk":
				comparison =
					(formatNezhaInfo(nezhaWsData.now, a).disk ?? 0) -
					(formatNezhaInfo(nezhaWsData.now, b).disk ?? 0);
				break;
			case "up":
				comparison =
					(a.state?.net_out_speed ?? 0) - (b.state?.net_out_speed ?? 0);
				break;
			case "down":
				comparison =
					(a.state?.net_in_speed ?? 0) - (b.state?.net_in_speed ?? 0);
				break;
			case "up total":
				comparison =
					(a.state?.net_out_transfer ?? 0) - (b.state?.net_out_transfer ?? 0);
				break;
			case "down total":
				comparison =
					(a.state?.net_in_transfer ?? 0) - (b.state?.net_in_transfer ?? 0);
				break;
			default:
				comparison = 0;
		}

		return sortOrder === "asc" ? comparison : -comparison;
	});

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
							Sort
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
			{inline === "1" && (
				<section
					ref={containerRef}
					className="flex flex-col gap-2 overflow-x-scroll p-px scrollbar-hidden mt-6 server-inline-list"
				>
					{filteredServers.map((serverInfo) => (
						<ServerCardInline
							now={nezhaWsData.now}
							key={serverInfo.id}
							serverInfo={serverInfo}
						/>
					))}
				</section>
			)}
			{inline === "0" && (
				<section
					ref={containerRef}
					className="grid grid-cols-1 gap-2 md:grid-cols-2 mt-6 server-card-list"
				>
					{filteredServers.map((serverInfo) => (
						<ServerCard
							now={nezhaWsData.now}
							key={serverInfo.id}
							serverInfo={serverInfo}
						/>
					))}
				</section>
			)}
		</div>
	);
}

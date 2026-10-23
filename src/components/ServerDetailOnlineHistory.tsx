import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import OnlineHistorySkeleton from "@/components/loading/OnlineHistorySkeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { useLoginUser } from "@/hooks/use-login-user";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerOnlineHistory } from "@/lib/nezha-api";
import {
	buildDailyOnlineRows,
	buildOfflineGroups,
	formatDuration,
	formatPeriodMoment,
	groupOnlineRows,
	panelDay,
	panelNow,
} from "@/lib/online-history";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = [1, 7, 30];
// Online periods 默认展开最近 3 天，每次「展开更多」追加 10 天
const PERIODS_INITIAL_DAYS = 3;
const PERIODS_EXPAND_STEP = 10;

type PeriodMode = "online" | "offline";

// 与详情页一致的轻量指标标签。
function SummaryLabel({ children }: { children: ReactNode }) {
	return <span className="text-xs text-muted-foreground">{children}</span>;
}

// 四项指标共用行高，辅助信息在底部对齐。
function SummaryMetric({
	label,
	children,
	footer,
}: {
	label: ReactNode;
	children: ReactNode;
	footer: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col items-center gap-2 px-3 text-center lg:px-5">
			<span className="text-xs leading-4 text-muted-foreground">{label}</span>
			<div className="text-lg font-medium leading-7 tracking-tight tabular-nums text-foreground lg:text-[22px]">
				{children}
			</div>
			<div className="flex min-h-4 items-center justify-center text-[11px] leading-4 text-muted-foreground tabular-nums">
				{footer}
			</div>
		</div>
	);
}

// 概要卡的信息盒：标签在上、数值在下
function SummaryBox({
	label,
	children,
}: {
	label: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center">
			<SummaryLabel>{label}</SummaryLabel>
			{children}
		</div>
	);
}

function WindowShade({
	left,
	width,
	label,
	striped = false,
}: {
	left: number;
	width: number;
	label: string;
	striped?: boolean;
}) {
	if (width <= 0) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					data-testid={striped ? "outside-window" : "unrecorded-window"}
					className={cn(
						"absolute inset-y-0 text-stone-300 focus-visible:outline-2 focus-visible:outline-ring dark:text-stone-600",
						!striped && "bg-background/80",
					)}
					style={{
						left: `${left}%`,
						width: `${width}%`,
						backgroundImage: striped
							? "repeating-linear-gradient(135deg, transparent, transparent 3px, currentColor 3px, currentColor 5px)"
							: undefined,
					}}
				/>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function DaysSelector({
	selectedDays,
	maxDays,
	onDaysChange,
}: {
	selectedDays: number;
	maxDays: number;
	onDaysChange: (days: number) => void;
}) {
	const { t } = useTranslation();
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator<number>(DAY_OPTIONS, selectedDays);

	return (
		<div
			ref={containerRef}
			data-testid="days-selector"
			className="relative flex gap-0.5 flex-wrap p-0.5 bg-muted dark:bg-muted/40 rounded-full w-fit border border-border/60 dark:border-border"
		>
			{indicator && (
				<div
					className="active-indicator-fade-in absolute left-0 top-0 z-10 bg-white dark:bg-background rounded-full ring-1 ring-border/60 dark:ring-border/40"
					style={{
						height: indicator.height,
						transform: `translate(${indicator.x}px, ${indicator.y}px)`,
						transition: indicator.shouldAnimate
							? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
							: "none",
						width: indicator.width,
					}}
				/>
			)}
			{DAY_OPTIONS.map((days, index) => {
				const isLocked = days > maxDays;
				return (
					<div
						key={days}
						aria-disabled={isLocked}
						ref={setItemRef(index)}
						onClick={() => {
							if (!isLocked) {
								if (selectedDays !== days) {
									enableIndicatorAnimation();
								}
								onDaysChange(days);
							}
						}}
						className={cn(
							"relative z-20 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
							selectedDays === days
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
							isLocked && "cursor-not-allowed opacity-40 grayscale",
						)}
					>
						<p className="whitespace-nowrap">
							{t(`serverOnlineHistory.days${days}`)}
						</p>
					</div>
				);
			})}
		</div>
	);
}

function PeriodsModeSwitch({
	mode,
	onModeChange,
}: {
	mode: PeriodMode;
	onModeChange: (mode: PeriodMode) => void;
}) {
	const { t } = useTranslation();
	const options: PeriodMode[] = ["online", "offline"];
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(options, mode);

	return (
		<div
			ref={containerRef}
			data-testid="period-mode-switch"
			className="relative ml-auto -mt-1 -mr-2 flex self-start gap-0.5 p-0.5 bg-muted dark:bg-muted/40 rounded-[8px] w-fit border border-border/60 dark:border-border sm:-mr-3"
		>
			{indicator && (
				<div
					className="active-indicator-fade-in absolute left-0 top-0 z-10 bg-white dark:bg-background rounded-[5px] ring-1 ring-border/60 dark:ring-border/40"
					style={{
						height: indicator.height,
						transform: `translate(${indicator.x}px, ${indicator.y}px)`,
						transition: indicator.shouldAnimate
							? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
							: "none",
						width: indicator.width,
					}}
				/>
			)}
			{options.map((option, index) => (
				<div
					key={option}
					ref={setItemRef(index)}
					onClick={() => {
						if (mode !== option) {
							enableIndicatorAnimation();
							onModeChange(option);
						}
					}}
					className={cn(
						"relative z-20 cursor-pointer rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors duration-300",
						mode === option
							? "text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<p className="whitespace-nowrap">
						{t(
							option === "online"
								? "serverOnlineHistory.periodsOnline"
								: "serverOnlineHistory.periodsOffline",
						)}
					</p>
				</div>
			))}
		</div>
	);
}

export default function ServerDetailOnlineHistory({
	server_id,
}: {
	server_id: string;
}) {
	const { t } = useTranslation();
	const { lastData } = useWebSocketContext();
	const { isAuthenticated: isLogin } = useLoginUser();
	const [days, setDays] = useState(DAY_OPTIONS[0]);
	const [guestMaxDays, setGuestMaxDays] = useState<number | null>(null);
	const [periodMode, setPeriodMode] = useState<PeriodMode>("online");
	const [visibleDays, setVisibleDays] = useState(PERIODS_INITIAL_DAYS);
	// 桌面为四列，手机为两行指标，两端统一使用在线率进度条。
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const requestDays = isLogin && guestMaxDays !== 1 ? days : 1;
	useEffect(() => {
		if (!isLogin) setDays(1);
	}, [isLogin]);

	const {
		data: historyData,
		isError,
		isPending,
		error: queryError,
	} = useQuery({
		queryKey: ["online-history", server_id, requestDays],
		queryFn: () => fetchServerOnlineHistory(Number(server_id), requestDays),
		// 只在同一节点切换天数时保留内容，不能把上一节点历史与当前实时状态混合。
		placeholderData: isLogin
			? (previousData, previousQuery) =>
					previousQuery?.queryKey[1] === server_id ? previousData : undefined
			: undefined,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchInterval: 60000,
	});

	// 游客仅能查 1 天：服务端拒绝 days>1 时自动回退到 1d 并锁定更长窗口，
	// 避免游客首屏只看到登录提示
	useEffect(() => {
		if (
			guestMaxDays === null &&
			queryError instanceof Error &&
			queryError.message.includes("only 1d data available for guests")
		) {
			setGuestMaxDays(1);
			setDays(1);
		}
	}, [guestMaxDays, queryError]);

	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();

	const online = historyData?.data;
	const tz = online?.timezone;
	const dailyRows = useMemo(
		() =>
			online
				? buildDailyOnlineRows(
						online.periods,
						online.daily,
						online.window_start,
						online.window_end,
						tz,
					)
				: [],
		[online, tz],
	);
	const periodGroups = useMemo(() => {
		if (!online) return [];
		return periodMode === "online"
			? groupOnlineRows(dailyRows, tz)
			: buildOfflineGroups(
					online.periods,
					online.daily,
					online.window_start,
					online.window_end,
					online.currently_online,
					tz,
				);
	}, [online, dailyRows, periodMode, tz]);
	// 最后活跃属于节点实时状态，不随 1/7/30 天查询缓存切换。
	// 历史尚无活跃记录时继续展示 N/A，实时数据不可用时回退到接口值。
	const lastActive = online?.last_active
		? lastData?.servers.find((server) => server.id === Number(server_id))
				?.last_active || online.last_active
		: undefined;
	// 使用接口返回的实际窗口，兼容不足整天的记录和时区切换。
	const windowSeconds = online
		? panelDay(online.window_end, tz).diff(
				panelDay(online.window_start, tz),
				"second",
			)
		: 0;
	const offlineSeconds = Math.max(
		0,
		windowSeconds - (online?.total_online_seconds ?? 0),
	);
	const windowRange = online
		? `${panelDay(online.window_start, tz).format("MM-DD")} – ${panelDay(online.window_end, tz).format("MM-DD")}`
		: "";

	if (isPending) {
		return <OnlineHistorySkeleton days={days} />;
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				{online && (
					<span
						className={cn(
							"inline-flex items-center gap-2 text-xs font-medium md:px-1",
							online.currently_online
								? "text-foreground"
								: "text-muted-foreground",
						)}
					>
						<span
							className={cn(
								"size-2 rounded-full",
								online.currently_online
									? "bg-green-500"
									: "bg-stone-400 dark:bg-stone-500",
							)}
						/>
						{online.currently_online ? t("online") : t("offline")}
					</span>
				)}
				<DaysSelector
					selectedDays={requestDays}
					maxDays={
						isLogin ? (guestMaxDays ?? online?.max_days ?? DAY_OPTIONS[2]) : 1
					}
					onDaysChange={(nextDays) => {
						setDays(nextDays);
						setVisibleDays(PERIODS_INITIAL_DAYS);
					}}
				/>
			</div>
			<Card className="border-0 bg-transparent shadow-none ring-0 dark:shadow-none dark:ring-0">
				<CardContent className="px-0 py-2 md:px-6 md:py-4">
					{isError && !online ? (
						<p className="text-xs text-muted-foreground">
							{t("serverOnlineHistory.loginRequired")}
						</p>
					) : (
						online &&
						(isDesktop ? (
							<div
								className="grid grid-cols-4 divide-x divide-stone-100 dark:divide-stone-800"
								data-testid="summary-desktop"
							>
								<SummaryMetric
									label={t("serverOnlineHistory.onlineRate")}
									footer={
										<div className="h-1 w-20 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
											<div
												className="h-full rounded-full bg-green-500"
												style={{
													width: `${Math.min(100, Math.max(0, online.online_rate))}%`,
												}}
											/>
										</div>
									}
								>
									{online.online_rate.toFixed(1)}%
								</SummaryMetric>
								<SummaryMetric
									label={t("serverOnlineHistory.totalOnline")}
									footer={windowRange}
								>
									{formatDuration(online.total_online_seconds)}
								</SummaryMetric>
								<SummaryMetric
									label={t("serverOnlineHistory.totalOffline")}
									footer={windowRange}
								>
									{formatDuration(offlineSeconds)}
								</SummaryMetric>
								<SummaryMetric
									label={t("serverOnlineHistory.lastActive")}
									footer={
										lastActive
											? panelDay(lastActive, tz).format("YYYY-MM-DD")
											: null
									}
								>
									{lastActive
										? panelDay(lastActive, tz).format("HH:mm:ss")
										: "N/A"}
								</SummaryMetric>
							</div>
						) : (
							<div className="flex flex-col gap-3" data-testid="summary-mobile">
								<div className="grid grid-cols-2 gap-4">
									<div className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center">
										<SummaryLabel>
											{t("serverOnlineHistory.onlineRate")}
										</SummaryLabel>
										<div className="flex min-w-0 flex-col items-center justify-center gap-1.5">
											<span className="shrink-0 text-2xl font-medium leading-7 tracking-tight tabular-nums">
												{online.online_rate.toFixed(1)}%
											</span>
											<div className="h-1 w-20 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
												<div
													className="h-full rounded-full bg-green-500"
													style={{
														width: `${Math.min(100, Math.max(0, online.online_rate))}%`,
													}}
												/>
											</div>
										</div>
										<span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
											{windowRange}
										</span>
									</div>
									<div className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center">
										<SummaryLabel>
											{t("serverOnlineHistory.lastActive")}
										</SummaryLabel>
										<span className="text-xl font-medium leading-7 tracking-tight tabular-nums">
											{lastActive
												? panelDay(lastActive, tz).format("HH:mm:ss")
												: "N/A"}
										</span>
										{lastActive && (
											<span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
												{panelDay(lastActive, tz).format("YYYY-MM-DD")}
											</span>
										)}
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-3 dark:border-stone-800">
									<SummaryBox label={t("serverOnlineHistory.totalOnline")}>
										<span className="text-lg font-medium leading-6 tracking-tight tabular-nums text-foreground">
											{formatDuration(online.total_online_seconds)}
										</span>
									</SummaryBox>
									<SummaryBox label={t("serverOnlineHistory.totalOffline")}>
										<span className="text-lg font-medium leading-6 tracking-tight tabular-nums text-foreground">
											{formatDuration(offlineSeconds)}
										</span>
									</SummaryBox>
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>

			<Card className={cn({ "bg-card/70": customBackgroundImage })}>
				<CardContent className="px-4 py-3 sm:px-5">
					<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
						<p className="text-base font-medium">
							{t("serverOnlineHistory.dailyOnline")}
						</p>
						{/* 面板时区下的 0:00–24:00 挂钟轴 */}
						<span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
							0:00 – 24:00{tz ? ` · ${tz}` : ""}
						</span>
					</div>
					<TooltipProvider delayDuration={100}>
						{/* 宽屏两列一行两日；末行为奇数时占满整行 */}
						<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
							{dailyRows.map((day) => {
								const segments = day.segments;
								return (
									<div
										key={day.date}
										data-testid="daily-online-day"
										className="flex min-w-0 flex-col gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2 dark:bg-muted/20"
									>
										<div className="flex items-baseline justify-between gap-2 text-xs">
											<span className="text-foreground tabular-nums">
												{day.date}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{formatDuration(day.online_seconds)}
											</span>
										</div>
										<div className="relative">
											<div className="relative h-2 overflow-hidden rounded-full bg-stone-200/70 dark:bg-stone-700">
												<WindowShade
													left={0}
													width={day.window.leftPct}
													striped
													label={t("serverOnlineHistory.outsideWindow")}
												/>
												<WindowShade
													left={day.window.rightPct}
													width={100 - day.window.rightPct}
													label={t("serverOnlineHistory.notYetRecorded")}
												/>
												{segments.map((segment) => (
													<Tooltip
														key={`${segment.leftPct}-${segment.period.start}`}
													>
														<TooltipTrigger asChild>
															<div
																data-testid="online-segment"
																className={cn(
																	"absolute inset-y-0 cursor-pointer rounded-full bg-green-500/90 transition-colors hover:bg-green-600",
																	segment.live && "bg-green-500",
																)}
																style={{
																	left: `${segment.leftPct}%`,
																	width: `${segment.widthPct}%`,
																	minWidth: 2,
																}}
															/>
														</TooltipTrigger>
														<TooltipContent className="px-2 py-1">
															<div className="flex flex-col gap-0.5">
																<span>
																	{segment.segStart.format("HH:mm:ss")}
																	{" → "}
																	{segment.live
																		? t("serverOnlineHistory.ongoing")
																		: formatPeriodMoment(
																				segment.segEnd,
																				segment.segStart,
																				tz,
																				true,
																			)}
																</span>
																<span className="text-muted-foreground">
																	{formatDuration(segment.elapsedSeconds)}
																</span>
															</div>
														</TooltipContent>
													</Tooltip>
												))}
												{[25, 50, 75].map((position) => (
													<span
														key={position}
														aria-hidden
														className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15"
														style={{ left: `${position}%` }}
													/>
												))}
											</div>
											{day.window.seconds > 0 &&
												day.window.rightPct > 0 &&
												day.window.rightPct < 100 && (
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																type="button"
																data-testid="data-cutoff"
																aria-label={`${t("serverOnlineHistory.dataCutoff")} ${day.window.end.format("HH:mm:ss")}`}
																className="absolute -top-0.5 -bottom-0.5 w-px bg-stone-500 dark:bg-stone-400"
																style={{ left: `${day.window.rightPct}%` }}
															>
																<span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-stone-500 dark:bg-stone-400" />
															</button>
														</TooltipTrigger>
														<TooltipContent>
															{t("serverOnlineHistory.dataCutoff")}{" "}
															{day.window.end.format("HH:mm:ss")}
														</TooltipContent>
													</Tooltip>
												)}
										</div>
										<div
											aria-hidden
											className="flex justify-between text-[9px] leading-none text-muted-foreground tabular-nums"
										>
											{[0, 6, 12, 18, 24].map((hour) => (
												<span key={hour}>{hour}</span>
											))}
										</div>
									</div>
								);
							})}
						</div>
						<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
							<span className="inline-flex items-center gap-1.5">
								<span
									aria-hidden
									className="h-2 w-3 rounded-sm"
									style={{
										backgroundImage:
											"repeating-linear-gradient(135deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)",
									}}
								/>
								{t("serverOnlineHistory.outsideWindow")}
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span
									aria-hidden
									className="h-2 w-3 rounded-sm border border-border bg-background/80"
								/>
								{t("serverOnlineHistory.notYetRecorded")}
							</span>
							<span>{t("serverOnlineHistory.dataCutoffHint")}</span>
						</div>
					</TooltipProvider>
				</CardContent>
			</Card>

			<Card className={cn({ "bg-card/70": customBackgroundImage })}>
				<CardContent className="px-4 py-3 sm:px-5">
					<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
						<p className="text-base font-medium">
							{t(
								periodMode === "online"
									? "serverOnlineHistory.periods"
									: "serverOnlineHistory.offlinePeriods",
							)}
						</p>
						<PeriodsModeSwitch
							mode={periodMode}
							onModeChange={(nextMode) => {
								setPeriodMode(nextMode);
								setVisibleDays(PERIODS_INITIAL_DAYS);
							}}
						/>
					</div>
					{(() => {
						if (!online) {
							return null;
						}
						const groups = periodGroups;
						const visibleGroups = groups.slice(0, visibleDays);
						if (groups.length === 0) {
							return (
								<p className="py-8 text-center text-sm text-muted-foreground">
									{t("serverOnlineHistory.noData")}
								</p>
							);
						}
						return (
							<TooltipProvider delayDuration={100}>
								<div className="mt-3 flex flex-col gap-3">
									{visibleGroups.map((group) => (
										<div key={group.date} data-testid="period-day">
											<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2">
												<span className="text-xs font-medium">
													{group.day.format("MM-DD")}
													{group.day.isSame(panelNow(tz), "day") && (
														<span className="text-muted-foreground font-normal">
															{" · "}
															{t("serverOnlineHistory.today")}
														</span>
													)}
												</span>
												<span className="text-xs text-muted-foreground">
													{t(periodMode === "online" ? "online" : "offline")}{" "}
													<span>{formatDuration(group.total)}</span>
												</span>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{group.chips.map((chip, index) => {
													const seconds = chip.end.diff(chip.start, "second");
													return (
														<Tooltip key={`${chip.start.valueOf()}-${index}`}>
															<TooltipTrigger asChild>
																<span
																	data-testid="period-chip"
																	className={cn(
																		"inline-flex max-w-full items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-xs tabular-nums transition-colors cursor-default",
																		chip.ongoing
																			? periodMode === "online"
																				? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
																				: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
																			: "bg-stone-100 text-stone-600 hover:bg-stone-200/70 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
																	)}
																>
																	{chip.ongoing && (
																		<span className="size-1.5 shrink-0 rounded-full bg-current" />
																	)}
																	{chip.start.format("HH:mm")}
																	{" → "}
																	{chip.ongoing
																		? t("serverOnlineHistory.ongoing")
																		: formatPeriodMoment(
																				chip.end,
																				chip.start,
																				tz,
																			)}
																	<span className="text-muted-foreground">
																		{formatDuration(seconds)}
																	</span>
																</span>
															</TooltipTrigger>
															<TooltipContent className="px-2 py-1">
																{chip.start.format("HH:mm:ss")}
																{" → "}
																{chip.ongoing
																	? t("serverOnlineHistory.ongoing")
																	: formatPeriodMoment(
																			chip.end,
																			chip.start,
																			tz,
																			true,
																		)}
																{" · "}
																{formatDuration(seconds)}
																{chip.original &&
																	(!chip.start.isSame(
																		panelDay(chip.original.start, tz),
																	) ||
																		!chip.end.isSame(
																			panelDay(chip.original.end, tz),
																		)) && (
																		<div className="mt-1 text-muted-foreground">
																			{t("serverOnlineHistory.originalSession")}{" "}
																			{panelDay(chip.original.start, tz).format(
																				"MM-DD HH:mm:ss",
																			)}
																			{" → "}
																			{chip.original.ongoing
																				? t("serverOnlineHistory.ongoing")
																				: panelDay(
																						chip.original.end,
																						tz,
																					).format("MM-DD HH:mm:ss")}
																		</div>
																	)}
															</TooltipContent>
														</Tooltip>
													);
												})}
											</div>
										</div>
									))}
									{groups.length > visibleDays && (
										<button
											type="button"
											data-testid="periods-expand"
											onClick={() =>
												setVisibleDays((d) => d + PERIODS_EXPAND_STEP)
											}
											className="w-full rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring cursor-pointer"
										>
											{t("serverOnlineHistory.expandMore")}
										</button>
									)}
								</div>
							</TooltipProvider>
						);
					})()}
				</CardContent>
			</Card>
		</div>
	);
}

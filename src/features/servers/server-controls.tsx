import {
	ArrowDownIcon,
	ArrowsUpDownIcon,
	ArrowUpIcon,
	ChartBarSquareIcon,
	MapIcon,
	ViewColumnsIcon,
} from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import GroupSwitch from "@/components/GroupSwitch";
import { SORT_TYPES, type SortContextType } from "@/context/sort-context";
import { cn } from "@/lib/utils";
import type { useServerPreferences } from "./use-server-preferences";

type Props = ReturnType<typeof useServerPreferences> &
	SortContextType & {
		hasServers: boolean;
		hasServices: boolean;
		groupTabs: string[];
		customBackgroundImage: string | undefined;
	};

export function ServerControls({
	hasServers,
	hasServices,
	groupTabs,
	customBackgroundImage,
	showMap,
	showServices,
	inline,
	currentGroup,
	handleTagChange,
	toggleMap,
	toggleServices,
	toggleInline,
	sortType,
	sortOrder,
	setSortType,
	setSortOrder,
}: Props) {
	const { t } = useTranslation();
	return (
		<div
			hidden={!hasServers}
			className="flex mt-6 items-center justify-between gap-2 server-overview-controls"
		>
			<section className="flex items-center gap-2 w-full overflow-hidden">
				<button
					onClick={toggleMap}
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
						onClick={toggleServices}
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
					onClick={toggleInline}
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
	);
}

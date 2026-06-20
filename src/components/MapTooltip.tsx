import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useTooltip from "@/hooks/use-tooltip";
import { saveMainPageScrollPosition } from "@/lib/navigation";

const MapTooltip = memo(function MapTooltip() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { tooltipData } = useTooltip();

	if (!tooltipData) return null;

	return (
		<div
			className="tooltip-animate absolute hidden lg:block bg-white dark:bg-neutral-800 px-2 py-1 rounded shadow-lg text-sm dark:border dark:border-neutral-700 z-50"
			key={tooltipData.country}
			style={{
				left: tooltipData.centroid[0],
				top: tooltipData.centroid[1],
				transform: "translate(20%, -50%)",
			}}
			onMouseEnter={(e) => {
				e.stopPropagation();
			}}
		>
			<div>
				<p className="font-medium">
					{tooltipData.country === "China"
						? "Mainland China"
						: tooltipData.country}
				</p>
				<p className="text-neutral-600 dark:text-neutral-400 text-xs font-light mb-1">
					{tooltipData.count} {t("map.Servers")}
				</p>
			</div>
			<div
				className="border-t dark:border-neutral-700 pt-1"
				style={{
					maxHeight: "200px",
					overflowY: "auto",
				}}
			>
				{tooltipData.servers.map((server) => (
					<button
						key={server.id}
						type="button"
						className="flex items-center gap-1.5 py-0.5 text-neutral-500 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white"
						onClick={() => {
							saveMainPageScrollPosition();
							navigate(`/server/${server.id}`);
						}}
					>
						<span
							className={`h-1.5 w-1.5 shrink-0 rounded-full ${server.status ? "bg-green-500" : "bg-red-500"}`}
						/>
						<span className="text-xs">{server.name}</span>
					</button>
				))}
			</div>
		</div>
	);
});

export default MapTooltip;

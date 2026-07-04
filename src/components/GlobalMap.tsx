import { geoEquirectangular, geoPath } from "d3-geo";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useTooltip from "@/hooks/use-tooltip";
import { geoJsonString } from "@/lib/geo-json-string";
import { countryCoordinates } from "@/lib/geo-limit";
import { cn, formatNezhaInfo } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

import MapTooltip from "./MapTooltip";

const geoJson = JSON.parse(geoJsonString) as {
	features: Array<{
		type: "Feature";
		properties: {
			iso_a2_eh: string;
			iso_a3_eh: string;
			[key: string]: string;
		};
		geometry: never;
	}>;
};

const filteredFeatures = geoJson.features.filter(
	(feature) => feature.properties.iso_a3_eh !== "",
);

type TooltipServer = {
	id: number;
	name: string;
	status: boolean;
};

export default function GlobalMap({
	serverList,
	now,
}: {
	serverList: NezhaServer[];
	now: number;
}) {
	const { t } = useTranslation();
	const { countryList, countryServers, serverCounts } = useMemo(() => {
		const countryList: string[] = [];
		const countryServers: Record<string, TooltipServer[]> = {};
		const serverCounts: Record<string, number> = {};

		serverList.forEach((server) => {
			if (!server.country_code) return;

			const countryCode = server.country_code.toUpperCase();
			if (!countryServers[countryCode]) {
				countryList.push(countryCode);
				countryServers[countryCode] = [];
			}

			serverCounts[countryCode] = (serverCounts[countryCode] || 0) + 1;
			countryServers[countryCode].push({
				id: server.id,
				name: server.name,
				status: formatNezhaInfo(now, server).online,
			});
		});

		return { countryList, countryServers, serverCounts };
	}, [now, serverList]);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const width = 900;
	const height = 500;

	return (
		<section
			className={cn("flex flex-col gap-4 mt-8", {
				"bg-card/70 rounded-lg  p-4": customBackgroundImage,
			})}
		>
			<p className="text-sm font-medium opacity-40">
				{t("map.Distributions")} {countryList.length} {t("map.Regions")}
			</p>
			<div className="w-full overflow-x-auto">
				<InteractiveMap
					countries={countryList}
					serverCounts={serverCounts}
					width={width}
					height={height}
					filteredFeatures={filteredFeatures}
					countryServers={countryServers}
				/>
			</div>
		</section>
	);
}

interface InteractiveMapProps {
	countries: string[];
	serverCounts: { [key: string]: number };
	width: number;
	height: number;
	filteredFeatures: {
		type: "Feature";
		properties: {
			iso_a3_eh: string;
			iso_a2_eh: string;
			[key: string]: string;
		};
		geometry: never;
	}[];
	countryServers: Record<string, TooltipServer[]>;
}

export function InteractiveMap({
	countries,
	serverCounts,
	width,
	height,
	filteredFeatures,
	countryServers,
}: InteractiveMapProps) {
	const { setTooltipData } = useTooltip();

	const { path, projection } = useMemo(() => {
		const projection = geoEquirectangular()
			.scale(140)
			.translate([width / 2, height / 2])
			.rotate([-12, 0, 0]);

		return {
			path: geoPath().projection(projection),
			projection,
		};
	}, [height, width]);

	const featureCountryCodes = useMemo(
		() =>
			new Set(filteredFeatures.map((feature) => feature.properties.iso_a2_eh)),
		[filteredFeatures],
	);
	const highlightedCountryCodes = useMemo(
		() => new Set(countries),
		[countries],
	);

	return (
		<div
			className="relative w-full aspect-2/1"
			onMouseLeave={() => setTooltipData(null)}
		>
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				xmlns="http://www.w3.org/2000/svg"
				className="w-full h-auto"
			>
				<defs>
					<pattern id="dots" width="2" height="2" patternUnits="userSpaceOnUse">
						<circle cx="1" cy="1" r="0.5" fill="currentColor" />
					</pattern>
				</defs>
				<g>
					{/* Background rect to handle mouse events in empty areas */}
					<rect
						x="0"
						y="0"
						width={width}
						height={height}
						fill="transparent"
						onMouseEnter={() => setTooltipData(null)}
					/>
					{filteredFeatures.map((feature, index) => {
						const isHighlighted = highlightedCountryCodes.has(
							feature.properties.iso_a2_eh,
						);

						const serverCount = serverCounts[feature.properties.iso_a2_eh] || 0;

						return (
							<path
								key={index}
								d={path(feature) || ""}
								className={
									isHighlighted
										? "fill-green-700 hover:fill-green-600    dark:fill-green-900 dark:hover:fill-green-700 transition-all cursor-pointer"
										: "fill-neutral-200/50 dark:fill-neutral-800 stroke-neutral-300/40 dark:stroke-neutral-700 stroke-[0.5]"
								}
								onMouseEnter={() => {
									if (!isHighlighted) {
										setTooltipData(null);
										return;
									}
									if (path.centroid(feature)) {
										const countryCode = feature.properties.iso_a2_eh;
										setTooltipData({
											centroid: path.centroid(feature),
											country: feature.properties.name,
											count: serverCount,
											servers: countryServers[countryCode] ?? [],
										});
									}
								}}
							/>
						);
					})}

					{/* 渲染不在 filteredFeatures 中的国家标记点 */}
					{countries.map((countryCode) => {
						// 检查该国家是否已经在 filteredFeatures 中
						const isInFilteredFeatures = featureCountryCodes.has(countryCode);

						// 如果已经在 filteredFeatures 中，跳过
						if (isInFilteredFeatures) return null;

						// 获取国家的经纬度
						const coords = countryCoordinates[countryCode];
						if (!coords) return null;

						// 使用投影函数将经纬度转换为 SVG 坐标
						const [x, y] = projection([coords.lng, coords.lat]) || [0, 0];
						const serverCount = serverCounts[countryCode] || 0;

						return (
							<g
								key={countryCode}
								onMouseEnter={() => {
									setTooltipData({
										centroid: [x, y],
										country: coords.name,
										count: serverCount,
										servers: countryServers[countryCode] ?? [],
									});
								}}
								className="cursor-pointer"
							>
								<circle
									cx={x}
									cy={y}
									r={4}
									className="fill-sky-700 stroke-white hover:fill-sky-600 dark:fill-sky-900 dark:hover:fill-sky-700 transition-all"
								/>
							</g>
						);
					})}
				</g>
			</svg>
			<MapTooltip />
		</div>
	);
}

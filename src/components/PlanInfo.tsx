import { cn, type PublicNoteData } from "@/lib/utils";

export default function PlanInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	if (!parsedData?.planDataMod) {
		return null;
	}

	const extraList =
		parsedData.planDataMod.extra.split(",").length > 1
			? parsedData.planDataMod.extra.split(",")
			: parsedData.planDataMod.extra.split(",")[0] === ""
				? []
				: [parsedData.planDataMod.extra];
	const networkRoutes = parsedData.planDataMod.networkRoute
		? parsedData.planDataMod.networkRoute.split(",")
		: [];

	return (
		<section className="flex gap-1 items-center flex-wrap mt-0.5">
			{parsedData.planDataMod.bandwidth !== "" && (
				<p
					className={cn(
						"text-[9px] bg-blue-600 dark:bg-blue-800 text-blue-200 dark:text-blue-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{parsedData.planDataMod.bandwidth}
				</p>
			)}
			{parsedData.planDataMod.trafficVol !== "" && (
				<p
					className={cn(
						"text-[9px] bg-green-600 text-green-200 dark:bg-green-800 dark:text-green-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{parsedData.planDataMod.trafficVol}
				</p>
			)}
			{parsedData.planDataMod.IPv4 === "1" && (
				<p
					className={cn(
						"text-[9px] bg-purple-600 text-purple-200 dark:bg-purple-800 dark:text-purple-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					IPv4
				</p>
			)}
			{parsedData.planDataMod.IPv6 === "1" && (
				<p
					className={cn(
						"text-[9px] bg-pink-600 text-pink-200 dark:bg-pink-800 dark:text-pink-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					IPv6
				</p>
			)}
			{parsedData.planDataMod.networkRoute && (
				<p
					className={cn(
						"text-[9px] bg-blue-600 text-blue-200 dark:bg-blue-800 dark:text-blue-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{networkRoutes.map((route, index) => {
						return route + (index === networkRoutes.length - 1 ? "" : "｜");
					})}
				</p>
			)}
			{extraList.map((extra, index) => {
				return (
					<p
						key={index}
						className={cn(
							"text-[9px] bg-stone-600 text-stone-200 dark:bg-stone-800 dark:text-stone-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
						)}
					>
						{extra}
					</p>
				);
			})}
		</section>
	);
}

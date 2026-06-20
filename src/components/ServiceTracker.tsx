import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchService } from "@/lib/nezha-api";
import type { NezhaServer, ServiceData } from "@/types/nezha-api";

import { CycleTransferStatsCard } from "./CycleTransferStats";
import { Loader } from "./loading/Loader";
import ServiceTrackerClient from "./ServiceTrackerClient";

export function ServiceTracker({ serverList }: { serverList: NezhaServer[] }) {
	const { t } = useTranslation();
	const { data: serviceData, isLoading } = useQuery({
		queryKey: ["service"],
		queryFn: () => fetchService(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchInterval: 10000,
	});

	const processServiceData = (serviceData: ServiceData) => {
		const days = serviceData.up.map((up, index) => {
			const totalChecks = up + serviceData.down[index];
			const dailyUptime = totalChecks > 0 ? (up / totalChecks) * 100 : 0;
			return {
				completed: up > serviceData.down[index],
				date: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000),
				uptime: dailyUptime,
				delay: serviceData.delay[index] || 0,
			};
		});

		const totalUp = serviceData.up.reduce((a, b) => a + b, 0);
		const totalChecks =
			serviceData.up.reduce((a, b) => a + b, 0) +
			serviceData.down.reduce((a, b) => a + b, 0);
		const uptime = totalChecks > 0 ? (totalUp / totalChecks) * 100 : 0;

		const avgDelay =
			serviceData.delay.length > 0
				? serviceData.delay.reduce((a, b) => a + b, 0) /
					serviceData.delay.length
				: 0;

		return { days, uptime, avgDelay };
	};

	if (isLoading) {
		return (
			<div className="mt-4 text-sm font-medium flex items-center gap-1">
				<Loader visible={true} />
				{t("serviceTracker.loading")}
			</div>
		);
	}

	if (
		!serviceData?.data?.services &&
		!serviceData?.data?.cycle_transfer_stats
	) {
		return (
			<div className="mt-4 text-sm font-medium flex items-center gap-1">
				<ExclamationTriangleIcon className="w-4 h-4" />
				{t("serviceTracker.noService")}
			</div>
		);
	}

	return (
		<div className="mt-4 w-full mx-auto ">
			{serviceData.data.cycle_transfer_stats && (
				<div>
					<CycleTransferStatsCard
						serverList={serverList}
						cycleStats={serviceData.data.cycle_transfer_stats}
					/>
				</div>
			)}
			{serviceData.data.services &&
				Object.keys(serviceData.data.services).length > 0 && (
					<section className="grid grid-cols-1 md:grid-cols-2 mt-4 gap-2 md:gap-4">
						{Object.entries(serviceData.data.services).map(([name, data]) => {
							const { days, uptime, avgDelay } = processServiceData(data);
							return (
								<ServiceTrackerClient
									key={name}
									days={days}
									title={data.service_name}
									uptime={uptime}
									avgDelay={avgDelay}
								/>
							);
						})}
					</section>
				)}
		</div>
	);
}

export default ServiceTracker;

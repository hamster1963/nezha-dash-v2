import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import OnlineHistorySkeleton from "@/components/loading/OnlineHistorySkeleton";
import { ServerDetailChartLoading } from "@/components/loading/ServerDetailLoading";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import RetryableLazy from "@/components/RetryableLazy";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import TabSwitch from "@/components/TabSwitch";
import { Separator } from "@/components/ui/separator";
import {
	getPreloadedServerDetailChart,
	loadServerDetailChart,
} from "@/lib/server-detail-preload";

const loadNetworkChart = () =>
	import("@/components/NetworkChart").then((module) => ({
		default: module.NetworkChart,
	}));

const loadOnlineHistory = () =>
	import("@/components/ServerDetailOnlineHistory").then((module) => ({
		default: module.default,
	}));

export default function ServerDetail() {
	const { t } = useTranslation();
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, []);

	const tabs = ["Detail", "Network", "Online"];
	const [currentTab, setCurrentTab] = useState(tabs[0]);

	const { id: server_id } = useParams();

	if (!server_id) {
		return <Navigate to="/404" replace />;
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-0 flex flex-col gap-4 server-info">
			<ServerDetailOverview server_id={server_id} />
			<section className="flex items-center my-2 w-full">
				<Separator className="flex-1" />
				<div className="flex justify-center w-full max-w-50">
					<TabSwitch
						tabs={tabs}
						currentTab={currentTab}
						setCurrentTab={setCurrentTab}
					/>
				</div>
				<Separator className="flex-1" />
			</section>

			{/* <section>
				<ServerDetailSummary server_id={Number(server_id)} />
			</section> */}

			{currentTab === tabs[0] && (
				<RetryableLazy
					load={loadServerDetailChart}
					getPreloaded={getPreloadedServerDetailChart}
					componentProps={{ server_id }}
					fallback={<ServerDetailChartLoading />}
					resetKey={server_id}
					title={t("error.chartFailed")}
				/>
			)}
			{currentTab === tabs[1] && (
				<RetryableLazy
					load={loadNetworkChart}
					componentProps={{ server_id: Number(server_id), show: true }}
					fallback={<NetworkChartLoading />}
					resetKey={server_id}
					title={t("error.chartFailed")}
				/>
			)}
			{currentTab === tabs[2] && (
				<RetryableLazy
					load={loadOnlineHistory}
					componentProps={{ server_id }}
					fallback={<OnlineHistorySkeleton />}
					resetKey={server_id}
					title={t("error.chartFailed")}
				/>
			)}
		</div>
	);
}

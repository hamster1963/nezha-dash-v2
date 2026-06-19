import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import ServerDetailChart from "@/components/ServerDetailChart";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import TabSwitch from "@/components/TabSwitch";
import { Separator } from "@/components/ui/separator";

const NetworkChart = lazy(() =>
	import("@/components/NetworkChart").then((module) => ({
		default: module.NetworkChart,
	})),
);

export default function ServerDetail() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, []);

	const tabs = ["Detail", "Network"];
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

			{currentTab === tabs[0] && <ServerDetailChart server_id={server_id} />}
			{currentTab === tabs[1] && (
				<Suspense fallback={<NetworkChartLoading />}>
					<NetworkChart server_id={Number(server_id)} show={true} />
				</Suspense>
			)}
		</div>
	);
}

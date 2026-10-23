import { useTranslation } from "react-i18next";
import type { HistoryStatus } from "@/hooks/use-metric-history";

export function HistoricalError({ status }: { status: HistoryStatus }) {
	const { t } = useTranslation();
	if (status !== "error") return null;
	return (
		<p role="status" className="text-xs text-destructive">
			{t("serverDetailChart.historyError", "Unable to load historical data")}
		</p>
	);
}

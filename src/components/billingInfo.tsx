import { useTranslation } from "react-i18next";
import {
	cn,
	getDaysBetweenDatesWithAutoRenewal,
	type PublicNoteData,
} from "@/lib/utils";

import RemainPercentBar from "./RemainPercentBar";

export default function BillingInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	const { t } = useTranslation();
	if (!parsedData?.billingDataMod) {
		return null;
	}

	let isNeverExpire = false;
	let daysLeftObject = {
		days: 0,
		cycleLabel: "",
		remainingPercentage: 0,
	};
	const hasBillingDates =
		Boolean(parsedData.billingDataMod.startDate) ||
		Boolean(parsedData.billingDataMod.endDate);

	if (parsedData?.billingDataMod?.endDate) {
		if (parsedData.billingDataMod.endDate.startsWith("0000-00-00")) {
			isNeverExpire = true;
		} else {
			try {
				daysLeftObject = getDaysBetweenDatesWithAutoRenewal(
					parsedData.billingDataMod,
				);
			} catch (error) {
				console.error(error);
				return (
					<div className={cn("text-[10px] text-muted-foreground text-red-600")}>
						{t("billingInfo.remaining")}: {t("billingInfo.error")}
					</div>
				);
			}
		}
	}

	return daysLeftObject.days >= 0 ? (
		<>
			{parsedData.billingDataMod.amount &&
			parsedData.billingDataMod.amount !== "0" &&
			parsedData.billingDataMod.amount !== "-1" ? (
				<p className={cn("text-[10px] text-muted-foreground ")}>
					{t("billingInfo.price")}: {parsedData.billingDataMod.amount}/
					{parsedData.billingDataMod.cycle}
				</p>
			) : parsedData.billingDataMod.amount === "0" ? (
				<p className={cn("text-[10px] text-green-600 ")}>
					{t("billingInfo.free")}
				</p>
			) : parsedData.billingDataMod.amount === "-1" ? (
				<p className={cn("text-[10px] text-pink-600 ")}>
					{t("billingInfo.usage-baseed")}
				</p>
			) : null}
			{hasBillingDates && (
				<div className={cn("text-[10px] text-muted-foreground")}>
					{t("billingInfo.remaining")}:{" "}
					{isNeverExpire
						? t("billingInfo.indefinite")
						: `${daysLeftObject.days} ${t("billingInfo.days")}`}
				</div>
			)}
			{hasBillingDates && !isNeverExpire && (
				<RemainPercentBar
					className="mt-0.5"
					value={daysLeftObject.remainingPercentage * 100}
				/>
			)}
		</>
	) : (
		<>
			{parsedData.billingDataMod.amount &&
			parsedData.billingDataMod.amount !== "0" &&
			parsedData.billingDataMod.amount !== "-1" ? (
				<p className={cn("text-[10px] text-muted-foreground ")}>
					{t("billingInfo.price")}: {parsedData.billingDataMod.amount}/
					{parsedData.billingDataMod.cycle}
				</p>
			) : parsedData.billingDataMod.amount === "0" ? (
				<p className={cn("text-[10px] text-green-600 ")}>
					{t("billingInfo.free")}
				</p>
			) : parsedData.billingDataMod.amount === "-1" ? (
				<p className={cn("text-[10px] text-pink-600 ")}>
					{t("billingInfo.usage-baseed")}
				</p>
			) : null}
			<p className={cn("text-[10px] text-muted-foreground text-red-600")}>
				{t("billingInfo.expired")}: {daysLeftObject.days * -1}{" "}
				{t("billingInfo.days")}
			</p>
		</>
	);
}

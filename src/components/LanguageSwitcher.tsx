import { useRuntimeConfig } from "@/lib/runtime-config";

("use client");

import { CheckCircleIcon, LanguageIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
	const { t, i18n } = useTranslation();

	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();

	const locale = i18n.languages[0];

	const handleSelect = (e: Event, newLocale: string) => {
		e.preventDefault(); // 阻止默认的关闭行为
		i18n.changeLanguage(newLocale);
	};

	const localeItems = [
		{ name: t("language.zh-CN"), code: "zh-CN" },
		{ name: t("language.zh-TW"), code: "zh-TW" },
		{ name: t("language.en-US"), code: "en-US" },
		{ name: t("language.ru-RU"), code: "ru-RU" },
		{ name: t("language.es-ES"), code: "es-ES" },
		{ name: t("language.de-DE"), code: "de-DE" },
		{ name: t("language.ta-IN"), code: "ta-IN" },
		{ name: t("language.fr"), code: "fr" },
		{ name: t("language.gl"), code: "gl" },
		{ name: t("language.id"), code: "id" },
		{ name: t("language.ja"), code: "ja" },
		{ name: t("language.pt_BR"), code: "pt_BR" },
		{ name: t("language.ro"), code: "ro" },
		{ name: t("language.uk"), code: "uk" },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn("rounded-full px-[9px] bg-white dark:bg-black", {
						"bg-white/70 dark:bg-black/70": customBackgroundImage,
					})}
				>
					<LanguageIcon className="size-4" />
					<span className="sr-only">Change language</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-0.5" align="end">
				{localeItems.map((item, index) => (
					<DropdownMenuItem
						key={item.code}
						onSelect={(e) => handleSelect(e, item.code)}
						className={cn(
							"text-xs",
							{
								"gap-3 bg-muted font-semibold": locale === item.code,
							},
							{
								"rounded-t-[5px]": index === localeItems.length - 1,
								"rounded-[5px]":
									index !== 0 && index !== localeItems.length - 1,
								"rounded-b-[5px]": index === 0,
							},
						)}
					>
						{item.name}{" "}
						{locale === item.code && <CheckCircleIcon className="size-4" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

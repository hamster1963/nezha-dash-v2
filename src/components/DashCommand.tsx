"use client";

import { Home, Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useCommand } from "@/hooks/use-command";
import { useTheme } from "@/hooks/use-theme";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { formatNezhaInfo } from "@/lib/utils";

export function DashCommand() {
	const { isOpen, closeCommand, toggleCommand } = useCommand();
	const [search, setSearch] = useState("");
	const navigate = useNavigate();
	const { t } = useTranslation();
	const { setTheme } = useTheme();

	const { lastData, connected } = useWebSocketContext();

	const nezhaWsData = lastData;

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				toggleCommand();
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [toggleCommand]);

	if (!connected || !nezhaWsData) return null;

	const shortcuts = [
		{
			keywords: ["home", "homepage"],
			icon: <Home />,
			label: t("Home"),
			action: () => navigate("/"),
		},
		{
			keywords: ["light", "theme", "lightmode"],
			icon: <Sun />,
			label: t("ToggleLightMode"),
			action: () => setTheme("light"),
		},
		{
			keywords: ["dark", "theme", "darkmode"],
			icon: <Moon />,
			label: t("ToggleDarkMode"),
			action: () => setTheme("dark"),
		},
		{
			keywords: ["system", "theme", "systemmode"],
			icon: <SunMoon />,
			label: t("ToggleSystemMode"),
			action: () => setTheme("system"),
		},
	].map((item) => ({
		...item,
		value: `${item.keywords.join(" ")} ${item.label}`,
	}));

	return (
		<CommandDialog open={isOpen} onOpenChange={closeCommand}>
			<CommandInput
				placeholder={t("TypeCommand")}
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList className="border-t">
				<CommandEmpty>{t("NoResults")}</CommandEmpty>
				{nezhaWsData.servers && nezhaWsData.servers.length > 0 && (
					<CommandGroup heading={t("Servers")}>
						{nezhaWsData.servers.map((server) => (
							<CommandItem
								key={server.id}
								value={server.name}
								onSelect={() => {
									saveMainPageScrollPosition();
									navigate(`/server/${server.id}`);
									closeCommand();
								}}
							>
								{formatNezhaInfo(nezhaWsData.now, server).online ? (
									<span className="h-2 w-2 shrink-0 rounded-full bg-green-500 self-center" />
								) : (
									<span className="h-2 w-2 shrink-0 rounded-full bg-red-500 self-center" />
								)}
								<span>{server.name}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
				<CommandSeparator />

				<CommandGroup heading={t("Shortcuts")}>
					{shortcuts.map((item) => (
						<CommandItem
							key={item.label}
							value={item.value}
							onSelect={() => {
								item.action();
								closeCommand();
							}}
						>
							{item.icon}
							<span>{item.label}</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}

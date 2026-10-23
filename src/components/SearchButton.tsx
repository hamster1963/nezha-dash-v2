import { useRuntimeConfig } from "@/lib/runtime-config";

("use client");

import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export function SearchButton() {
	const { openCommand } = useCommand();

	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();

	return (
		<Button
			variant="outline"
			size="sm"
			className={cn("rounded-full px-[9px] bg-white dark:bg-black", {
				"bg-white/70 dark:bg-black/70": customBackgroundImage,
			})}
			onClick={openCommand}
			title="Search"
		>
			<MagnifyingGlassIcon className="size-4" />
			<span className="sr-only">Search</span>
		</Button>
	);
}

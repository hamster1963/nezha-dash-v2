import { type ReactNode, useEffect, useState } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";

import { SortContext, type SortOrder, type SortType } from "./sort-context";

export function SortProvider({ children }: { children: ReactNode }) {
	const { forceSortType, forceSortOrder } = useRuntimeConfig();
	const [sortType, setSortType] = useState<SortType>(
		forceSortType || "default",
	);
	const [sortOrder, setSortOrder] = useState<SortOrder>(
		forceSortOrder || "desc",
	);
	useEffect(() => {
		if (forceSortType) setSortType(forceSortType);
		if (forceSortOrder) setSortOrder(forceSortOrder);
	}, [forceSortType, forceSortOrder]);

	return (
		<SortContext.Provider
			value={{ sortType, setSortType, sortOrder, setSortOrder }}
		>
			{children}
		</SortContext.Provider>
	);
}

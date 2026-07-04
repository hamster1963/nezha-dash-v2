import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useState } from "react";
import ServerCard from "@/components/ServerCard";
import ServerCardInline from "@/components/ServerCardInline";
import type { NezhaServer } from "@/types/nezha-api";

type VirtualServerListProps = {
	now: number;
	servers: NezhaServer[];
	inline: boolean;
};

const CARD_ROW_GAP = 8;
const CARD_COLUMNS_BREAKPOINT = 768;

function useCardColumnCount(enabled: boolean) {
	const [columnCount, setColumnCount] = useState(() => {
		if (!enabled || typeof window === "undefined") return 1;
		return window.innerWidth >= CARD_COLUMNS_BREAKPOINT ? 2 : 1;
	});

	useEffect(() => {
		if (!enabled) {
			setColumnCount(1);
			return;
		}

		const updateColumnCount = () => {
			setColumnCount(window.innerWidth >= CARD_COLUMNS_BREAKPOINT ? 2 : 1);
		};

		updateColumnCount();
		window.addEventListener("resize", updateColumnCount);

		return () => {
			window.removeEventListener("resize", updateColumnCount);
		};
	}, [enabled]);

	return columnCount;
}

export default function VirtualServerList({
	inline,
	now,
	servers,
}: VirtualServerListProps) {
	if (inline) {
		return <VirtualInlineServerList now={now} servers={servers} />;
	}

	return <VirtualCardServerList now={now} servers={servers} />;
}

function VirtualCardServerList({
	now,
	servers,
}: {
	now: number;
	servers: NezhaServer[];
}) {
	const columnCount = useCardColumnCount(true);
	const rowCount = Math.ceil(servers.length / columnCount);

	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		estimateSize: () => 150,
		gap: CARD_ROW_GAP,
		overscan: 6,
	});

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<section
			className="relative mt-6 server-card-list"
			style={{ height: virtualizer.getTotalSize() }}
		>
			<div
				className="absolute left-0 top-0 w-full"
				style={{
					transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
				}}
			>
				{virtualItems.map((virtualRow) => {
					const rowStart = virtualRow.index * columnCount;
					const row = servers.slice(rowStart, rowStart + columnCount);

					return (
						<div
							className="grid grid-cols-1 gap-2 md:grid-cols-2"
							data-index={virtualRow.index}
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							style={{
								paddingBottom: CARD_ROW_GAP,
							}}
						>
							{row.map((serverInfo) => (
								<ServerCard
									key={serverInfo.id}
									now={now}
									serverInfo={serverInfo}
								/>
							))}
						</div>
					);
				})}
			</div>
		</section>
	);
}

function VirtualInlineServerList({
	now,
	servers,
}: {
	now: number;
	servers: NezhaServer[];
}) {
	const virtualizer = useWindowVirtualizer({
		count: servers.length,
		estimateSize: () => 86,
		gap: CARD_ROW_GAP,
		overscan: 8,
	});

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<section
			className="relative mt-6 overflow-x-scroll scrollbar-hidden server-inline-list"
			style={{ height: virtualizer.getTotalSize() }}
		>
			<div
				className="absolute left-0 top-0 px-px py-px flex w-full flex-col"
				style={{
					transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
				}}
			>
				{virtualItems.map((virtualRow) => {
					const serverInfo = servers[virtualRow.index];
					if (!serverInfo) return null;

					return (
						<div
							data-index={virtualRow.index}
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							style={{ paddingBottom: CARD_ROW_GAP }}
						>
							<ServerCardInline now={now} serverInfo={serverInfo} />
						</div>
					);
				})}
			</div>
		</section>
	);
}

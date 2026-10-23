import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { safeLocalStorage, safeSessionStorage } from "@/lib/storage";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export function useServerPreferences(
	hasServices: boolean,
	data: NezhaWebsocketResponse | null | undefined,
) {
	const { forceShowServices, forceShowMap, forceCardInline } =
		useRuntimeConfig();
	const [desiredShowServices, setShowServices] = useState<string>("0");
	const [showMap, setShowMap] = useState<string>("0");
	const [inline, setInline] = useState<string>("0");
	const unsavedInline = useRef<string | null>(null);
	const hasRestoredScroll = useRef(false);
	const [currentGroup, setCurrentGroup] = useState<string>("All");
	const restoreScrollPosition = useCallback(() => {
		const isFromMainPage =
			safeSessionStorage.getItem("fromMainPage") === "true";
		const savedPosition = safeSessionStorage.getItem("scrollPosition");
		const scrollTop = savedPosition ? Number(savedPosition) : Number.NaN;

		if (
			hasRestoredScroll.current ||
			!isFromMainPage ||
			!Number.isFinite(scrollTop)
		) {
			return;
		}

		hasRestoredScroll.current = true;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
			});
		});
	}, []);

	const handleTagChange = (newGroup: string) => {
		setCurrentGroup(newGroup);
		safeSessionStorage.setItem("selectedGroup", newGroup);
		safeSessionStorage.setItem("scrollPosition", String(window.scrollY || 0));
	};

	useEffect(() => {
		const showServicesState = safeLocalStorage.getItem("showServices");
		if (forceShowServices) {
			setShowServices("1");
		} else if (showServicesState !== null) {
			setShowServices(showServicesState);
		}
	}, [forceShowServices]);

	const showServices = hasServices ? desiredShowServices : "0";

	useEffect(() => {
		const checkInlineSettings = () => {
			const isMobile = window.innerWidth < 768;

			// Mobile skips desktop defaults; shrinking does not reset an explicit choice.
			if (!isMobile) {
				const inlineState = safeLocalStorage.getItem("inline");
				if (forceCardInline) {
					setInline("1");
				} else if (unsavedInline.current !== null) {
					// A failed write must not let an older stored value undo this session.
					setInline(unsavedInline.current);
				} else if (inlineState !== null) {
					setInline(inlineState);
				}
			}
		};

		checkInlineSettings();

		window.addEventListener("resize", checkInlineSettings);

		return () => {
			window.removeEventListener("resize", checkInlineSettings);
		};
	}, [forceCardInline]);

	useEffect(() => {
		const showMapState = safeLocalStorage.getItem("showMap");
		if (forceShowMap) {
			setShowMap("1");
		} else if (showMapState !== null) {
			setShowMap(showMapState);
		}
	}, [forceShowMap]);

	useEffect(() => {
		const savedGroup = safeSessionStorage.getItem("selectedGroup") || "All";
		setCurrentGroup(savedGroup);
	}, []);

	useEffect(() => {
		if (data) {
			restoreScrollPosition();
		}
	}, [data, restoreScrollPosition]);

	const toggleMap = () => {
		const value = showMap === "0" ? "1" : "0";
		setShowMap(value);
		safeLocalStorage.setItem("showMap", value);
	};
	const toggleServices = () => {
		const value = desiredShowServices === "0" ? "1" : "0";
		setShowServices(value);
		safeLocalStorage.setItem("showServices", value);
	};
	const toggleInline = () => {
		const value = inline === "0" ? "1" : "0";
		setInline(value);
		unsavedInline.current = safeLocalStorage.setItem("inline", value)
			? null
			: value;
	};
	return {
		showServices,
		showMap,
		inline,
		currentGroup,
		handleTagChange,
		toggleMap,
		toggleServices,
		toggleInline,
	};
}

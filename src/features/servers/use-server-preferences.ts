import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";
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
	const hasRestoredScroll = useRef(false);
	const [currentGroup, setCurrentGroup] = useState<string>("All");
	const restoreScrollPosition = useCallback(() => {
		const isFromMainPage = sessionStorage.getItem("fromMainPage") === "true";
		const savedPosition = sessionStorage.getItem("scrollPosition");
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
		sessionStorage.setItem("selectedGroup", newGroup);
		sessionStorage.setItem("scrollPosition", String(window.scrollY || 0));
	};

	useEffect(() => {
		const showServicesState = localStorage.getItem("showServices");
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
				const inlineState = localStorage.getItem("inline");
				if (forceCardInline) {
					setInline("1");
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
		const showMapState = localStorage.getItem("showMap");
		if (forceShowMap) {
			setShowMap("1");
		} else if (showMapState !== null) {
			setShowMap(showMapState);
		}
	}, [forceShowMap]);

	useEffect(() => {
		const savedGroup = sessionStorage.getItem("selectedGroup") || "All";
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
		localStorage.setItem("showMap", value);
	};
	const toggleServices = () => {
		const value = desiredShowServices === "0" ? "1" : "0";
		setShowServices(value);
		localStorage.setItem("showServices", value);
	};
	const toggleInline = () => {
		const value = inline === "0" ? "1" : "0";
		setInline(value);
		localStorage.setItem("inline", value);
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

import { useCallback, useEffect, useRef, useState } from "react";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export function useServerPreferences(
	hasServices: boolean,
	data: NezhaWebsocketResponse | null | undefined,
) {
	const [showServices, setShowServices] = useState<string>("0");
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
		if (window.ForceShowServices) {
			setShowServices("1");
		} else if (showServicesState !== null) {
			setShowServices(showServicesState);
		}
	}, []);

	useEffect(() => {
		if (!hasServices) {
			setShowServices("0");
		}
	}, [hasServices]);

	useEffect(() => {
		const checkInlineSettings = () => {
			const isMobile = window.innerWidth < 768;

			// Mobile skips desktop defaults; shrinking does not reset an explicit choice.
			if (!isMobile) {
				const inlineState = localStorage.getItem("inline");
				if (window.ForceCardInline) {
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
	}, []);

	useEffect(() => {
		const showMapState = localStorage.getItem("showMap");
		if (window.ForceShowMap) {
			setShowMap("1");
		} else if (showMapState !== null) {
			setShowMap(showMapState);
		}
	}, []);

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
		const value = showServices === "0" ? "1" : "0";
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

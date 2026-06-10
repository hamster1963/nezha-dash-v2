import { useCallback, useLayoutEffect, useRef, useState } from "react";

type ActiveIndicator = {
	x: number;
	y: number;
	width: number;
	height: number;
	shouldAnimate: boolean;
};

export function useActiveIndicator<T>(items: T[], activeItem: T) {
	const containerRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
	const hasMeasuredRef = useRef(false);
	const shouldAnimateNextRef = useRef(false);
	const [indicator, setIndicator] = useState<ActiveIndicator | null>(null);

	const enableIndicatorAnimation = useCallback(() => {
		shouldAnimateNextRef.current = true;
	}, []);

	const setItemRef = useCallback(
		(index: number) => (node: HTMLDivElement | null) => {
			itemRefs.current[index] = node;
		},
		[],
	);

	const updateIndicator = useCallback(() => {
		const activeIndex = items.indexOf(activeItem);
		const activeElement = itemRefs.current[activeIndex];

		if (!activeElement || !containerRef.current) {
			hasMeasuredRef.current = false;
			shouldAnimateNextRef.current = false;
			setIndicator((currentIndicator) =>
				currentIndicator === null ? currentIndicator : null,
			);
			return;
		}

		const nextIndicator = {
			x: activeElement.offsetLeft,
			y: activeElement.offsetTop,
			width: activeElement.offsetWidth,
			height: activeElement.offsetHeight,
			shouldAnimate: hasMeasuredRef.current && shouldAnimateNextRef.current,
		};
		hasMeasuredRef.current = true;
		shouldAnimateNextRef.current = false;

		setIndicator((currentIndicator) => {
			if (
				currentIndicator &&
				currentIndicator.x === nextIndicator.x &&
				currentIndicator.y === nextIndicator.y &&
				currentIndicator.width === nextIndicator.width &&
				currentIndicator.height === nextIndicator.height
			) {
				return currentIndicator;
			}

			return nextIndicator;
		});
	}, [activeItem, items]);

	useLayoutEffect(() => {
		updateIndicator();

		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const resizeObserver = new ResizeObserver(updateIndicator);
		resizeObserver.observe(container);

		for (const item of itemRefs.current) {
			if (item) {
				resizeObserver.observe(item);
			}
		}

		return () => {
			resizeObserver.disconnect();
		};
	}, [updateIndicator]);

	return {
		containerRef,
		enableIndicatorAnimation,
		indicator,
		itemRefs,
		setItemRef,
	};
}

import type { ComponentPropsWithoutRef } from "react";

type NumericTextTransition = {
	duration?: number;
	easing?: string;
};

type NumericTextProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
	animated?: boolean;
	respectMotionPreference?: boolean;
	transition?: NumericTextTransition;
	trend?: -1 | 0 | 1;
	value: number | string;
};

export default function NumericText({
	animated,
	respectMotionPreference,
	transition,
	trend,
	value,
	...spanProps
}: NumericTextProps) {
	void animated;
	void respectMotionPreference;
	void transition;
	void trend;

	return <span {...spanProps}>{value}</span>;
}

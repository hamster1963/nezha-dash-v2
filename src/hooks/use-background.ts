import { useEffect } from "react";
import {
	restoreBackground,
	updateBackground,
	useRuntimeConfig,
} from "@/lib/runtime-config";

export function useBackground() {
	const { backgroundImage } = useRuntimeConfig();
	useEffect(restoreBackground, []);
	return { backgroundImage, updateBackground };
}

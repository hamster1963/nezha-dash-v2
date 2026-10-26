import { useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_LOGO = "/apple-touch-icon.png";

export default function InitializationSplash({ logo }: { logo?: string }) {
	const [failedLogo, setFailedLogo] = useState<string>();
	// Custom branding may become available before the remaining scripts finish.
	// Never wait for it: the bundled logo is safe to show during initialization.
	const source = logo && logo !== failedLogo ? logo : DEFAULT_LOGO;

	return (
		<div
			role="status"
			className="fixed inset-0 flex items-center justify-center bg-background"
		>
			<img
				src={source}
				alt=""
				aria-hidden="true"
				width={96}
				height={96}
				onError={() => {
					if (source !== DEFAULT_LOGO) setFailedLogo(source);
				}}
				className={cn(
					"h-24 w-24 object-contain",
					// Blend away the bundled icon's black tile without altering custom logos.
					source === DEFAULT_LOGO &&
						"invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen",
				)}
			/>
			<span className="sr-only">Loading dashboard configuration…</span>
		</div>
	);
}

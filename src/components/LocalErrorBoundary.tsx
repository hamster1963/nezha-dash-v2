import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LazyChunkLoadError } from "@/lib/lazy-load-error";
import { cn } from "@/lib/utils";

interface Props {
	children: ReactNode;
	title?: string;
	resetKey?: string;
	onRetry?: () => void;
	allowReload?: boolean;
	className?: string;
}

function ErrorFallback({
	title,
	onRetry,
	allowReload,
	className,
	reloadRequired,
}: Omit<Props, "children" | "resetKey"> & { reloadRequired: boolean }) {
	const { t } = useTranslation();
	return (
		<div
			role="alert"
			aria-label={title}
			className={cn(
				"flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center",
				className,
			)}
		>
			{title && <p className="font-medium">{title}</p>}
			<p className="text-sm text-muted-foreground">
				{t("error.sectionFailed")}
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					{t(reloadRequired ? "error.reloadPage" : "error.retry")}
				</Button>
				{allowReload && !reloadRequired && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => window.location.reload()}
					>
						{t("error.reloadPage")}
					</Button>
				)}
			</div>
		</div>
	);
}

class SectionBoundary extends Component<
	Props,
	{ hasError: boolean; reloadRequired: boolean }
> {
	state = { hasError: false, reloadRequired: false };

	static getDerivedStateFromError(error: unknown) {
		return {
			hasError: true,
			reloadRequired: error instanceof LazyChunkLoadError,
		};
	}

	private retry = () => {
		if (this.state.reloadRequired) {
			window.location.reload();
			return;
		}
		this.props.onRetry?.();
		this.setState({ hasError: false, reloadRequired: false });
	};

	render() {
		if (this.state.hasError) {
			return (
				<ErrorFallback
					{...this.props}
					reloadRequired={this.state.reloadRequired}
					onRetry={this.retry}
				/>
			);
		}
		return this.props.children;
	}
}

/** Retry locally unless a lazy asset failure requires a fresh document. */
export default function LocalErrorBoundary({ resetKey, ...props }: Props) {
	return <SectionBoundary key={resetKey} {...props} />;
}

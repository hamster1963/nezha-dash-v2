import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
}: Omit<Props, "children" | "resetKey">) {
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
					{t("error.retry")}
				</Button>
				{allowReload && (
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

class SectionBoundary extends Component<Props, { hasError: boolean }> {
	state = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	private retry = () => {
		this.props.onRetry?.();
		this.setState({ hasError: false });
	};

	render() {
		if (this.state.hasError) {
			return <ErrorFallback {...this.props} onRetry={this.retry} />;
		}
		return this.props.children;
	}
}

/** Reset only this section on retry or when its navigation/data scope changes. */
export default function LocalErrorBoundary({ resetKey, ...props }: Props) {
	return <SectionBoundary key={resetKey} {...props} />;
}

import ServerOverview from "@/components/ServerOverview";
import { Loader } from "./Loader";
import SkeletonBar from "./SkeletonBar";

const ITEMS = [0, 1, 2, 3, 4, 5];

export default function HomeSkeleton() {
	return (
		<div
			role="status"
			aria-busy="true"
			className="mx-auto flex w-full max-w-5xl flex-1 flex-col"
		>
			<div aria-hidden="true">
				<ServerOverview
					loading
					total={0}
					online={0}
					offline={0}
					up={0}
					down={0}
					upSpeed={0}
					downSpeed={0}
				/>
				<div className="mt-6 flex h-9 items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-2 overflow-hidden">
						{ITEMS.slice(0, 3).map((item) => (
							<SkeletonBar
								key={item}
								className="size-8 shrink-0 rounded-full"
							/>
						))}
						<SkeletonBar className="h-8 w-16 shrink-0 rounded-full" />
						<SkeletonBar className="hidden h-8 w-24 rounded-full sm:block" />
					</div>
					<SkeletonBar className="h-8 w-28 shrink-0 rounded-full" />
				</div>
			</div>
			<div className="flex min-h-16 flex-1 items-center justify-center gap-2">
				<span aria-hidden="true">
					<Loader visible />
				</span>
				<p className="text-sm font-semibold">Loading…</p>
			</div>
		</div>
	);
}

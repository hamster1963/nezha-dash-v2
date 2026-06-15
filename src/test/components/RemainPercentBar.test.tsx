import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RemainPercentBar from "@/components/RemainPercentBar";

describe("RemainPercentBar", () => {
	it("uses status colors for low, medium, and healthy remaining percentages", () => {
		const { rerender } = render(<RemainPercentBar value={29} />);
		const progress = screen.getByRole("progressbar");
		const indicator = progress.firstElementChild;

		expect(progress).toHaveClass("w-[70px]");
		expect(indicator).toHaveClass("bg-red-500");
		expect(indicator).toHaveStyle({ transform: "translateX(-71%)" });

		rerender(<RemainPercentBar value={30} />);
		expect(progress.firstElementChild).toHaveClass("bg-orange-400");

		rerender(<RemainPercentBar value={70} />);
		expect(progress.firstElementChild).toHaveClass("bg-green-500");
	});
});

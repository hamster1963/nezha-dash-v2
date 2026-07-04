import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashCommand } from "@/components/DashCommand";
import { createServer } from "@/test/fixtures";

const dashMocks = vi.hoisted(() => ({
	closeCommand: vi.fn(),
	isOpen: true,
	lastData: null as {
		now: number;
		servers: ReturnType<typeof createServer>[];
	} | null,
	navigate: vi.fn(),
	setTheme: vi.fn(),
	toggleCommand: vi.fn(),
	connected: true,
}));

vi.mock("@/hooks/use-command", () => ({
	useCommand: () => ({
		closeCommand: dashMocks.closeCommand,
		isOpen: dashMocks.isOpen,
		toggleCommand: dashMocks.toggleCommand,
	}),
}));

vi.mock("@/hooks/use-theme", () => ({
	useTheme: () => ({
		setTheme: dashMocks.setTheme,
	}),
}));

vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => ({
		connected: dashMocks.connected,
		lastData: dashMocks.lastData,
	}),
}));

vi.mock("react-router-dom", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router-dom")>();
	return {
		...actual,
		useNavigate: () => dashMocks.navigate,
	};
});

function seedWebSocketData() {
	dashMocks.connected = true;
	dashMocks.lastData = {
		now: Date.parse("2025-01-01T00:00:20.000Z"),
		servers: [
			createServer({
				id: 7,
				name: "edge-7",
				last_active: "2025-01-01T00:00:00.000Z",
			}),
		],
	};
}

describe("DashCommand", () => {
	beforeEach(() => {
		dashMocks.closeCommand.mockClear();
		dashMocks.navigate.mockClear();
		dashMocks.setTheme.mockClear();
		dashMocks.toggleCommand.mockClear();
		dashMocks.isOpen = true;
		dashMocks.connected = true;
		dashMocks.lastData = null;
	});

	it("does not render until websocket data is available", () => {
		dashMocks.connected = false;
		dashMocks.lastData = null;

		const { container } = render(<DashCommand />);

		expect(container).toBeEmptyDOMElement();
	});

	it("does not mount server command items while the dialog is closed", () => {
		seedWebSocketData();
		dashMocks.isOpen = false;

		render(<DashCommand />);

		expect(screen.queryByText("edge-7")).not.toBeInTheDocument();
	});

	it("renders server and shortcut commands, handles selection, and listens for keyboard toggle", async () => {
		const user = userEvent.setup();
		seedWebSocketData();

		render(<DashCommand />);

		fireEvent.keyDown(document, { key: "k", metaKey: true });
		expect(dashMocks.toggleCommand).toHaveBeenCalledOnce();

		expect(screen.getByPlaceholderText("TypeCommand")).toBeInTheDocument();
		expect(screen.getByText("edge-7")).toBeInTheDocument();
		expect(screen.getByText("ToggleDarkMode")).toBeInTheDocument();

		Object.defineProperty(window, "scrollY", {
			configurable: true,
			value: 256,
		});
		await user.click(screen.getByText("edge-7"));
		expect(dashMocks.navigate).toHaveBeenCalledWith("/server/7");
		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
		expect(sessionStorage.getItem("scrollPosition")).toBe("256");
		expect(dashMocks.closeCommand).toHaveBeenCalled();

		await user.click(screen.getByText("ToggleDarkMode"));
		expect(dashMocks.setTheme).toHaveBeenCalledWith("dark");
	});
});

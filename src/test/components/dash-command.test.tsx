import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashCommand } from "@/components/DashCommand";
import { createServer } from "@/test/fixtures";

const dashMocks = vi.hoisted(() => ({
	closeCommand: vi.fn(),
	isOpen: true,
	lastMessage: null as MessageEvent<string> | null,
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
		lastMessage: dashMocks.lastMessage,
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
	dashMocks.lastMessage = new MessageEvent("message", {
		data: JSON.stringify({
			now: Date.parse("2025-01-01T00:00:00.000Z") / 1000,
			servers: [
				createServer({
					id: 7,
					name: "edge-7",
					last_active: "2025-01-01T00:00:00.000Z",
				}),
			],
		}),
	});
}

describe("DashCommand", () => {
	it("does not render until websocket data is available", () => {
		dashMocks.connected = false;
		dashMocks.lastMessage = null;

		const { container } = render(<DashCommand />);

		expect(container).toBeEmptyDOMElement();
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

		await user.click(screen.getByText("edge-7"));
		expect(dashMocks.navigate).toHaveBeenCalledWith("/server/7");
		expect(dashMocks.closeCommand).toHaveBeenCalled();

		await user.click(screen.getByText("ToggleDarkMode"));
		expect(dashMocks.setTheme).toHaveBeenCalledWith("dark");
	});
});

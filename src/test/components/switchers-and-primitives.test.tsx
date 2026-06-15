import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ModeToggle } from "@/components/ThemeSwitcher";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

describe("language and theme switchers", () => {
	it("opens the language menu and marks the active locale", async () => {
		const user = userEvent.setup();

		render(<LanguageSwitcher />);

		await user.click(screen.getByRole("button", { name: "Change language" }));

		expect(screen.getByText("language.zh-CN")).toBeInTheDocument();
		expect(screen.getByText("language.en-US")).toHaveClass("font-semibold");
	});

	it("updates the theme through the mode menu", async () => {
		const user = userEvent.setup();

		render(
			<ThemeProvider storageKey="theme-switcher-test">
				<ModeToggle />
			</ThemeProvider>,
		);

		await user.click(screen.getByRole("button", { name: "Toggle theme" }));
		await user.click(await screen.findByText("theme.dark"));

		expect(document.documentElement).toHaveClass("dark");
		expect(localStorage.getItem("theme-switcher-test")).toBe("dark");
	});
});

describe("Radix UI wrappers", () => {
	it("opens accordion, popover, tooltip, and dialog content", async () => {
		const user = userEvent.setup();

		render(
			<>
				<Accordion type="single" collapsible>
					<AccordionItem value="status">
						<AccordionTrigger>Toggle status</AccordionTrigger>
						<AccordionContent>Status body</AccordionContent>
					</AccordionItem>
				</Accordion>
				<Popover>
					<PopoverTrigger>Open popover</PopoverTrigger>
					<PopoverContent>Popover body</PopoverContent>
				</Popover>
				<TooltipProvider delayDuration={0}>
					<Tooltip>
						<TooltipTrigger>Hover status</TooltipTrigger>
						<TooltipContent>Tooltip body</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Dialog>
					<DialogTrigger>Open dialog</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Confirm action</DialogTitle>
							<DialogDescription>Dialog body</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<DialogClose>Done</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>,
		);

		await user.click(screen.getByRole("button", { name: "Toggle status" }));
		expect(screen.getByText("Status body")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Open popover" }));
		expect(screen.getByText("Popover body")).toBeInTheDocument();

		await user.hover(screen.getByText("Hover status"));
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Tooltip body",
		);

		await user.click(screen.getByRole("button", { name: "Open dialog" }));
		expect(screen.getByText("Confirm action")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Done" }));
		await waitFor(() => {
			expect(screen.queryByText("Confirm action")).not.toBeInTheDocument();
		});
	});

	it("toggles checkbox and switch controls through labels", async () => {
		const user = userEvent.setup();
		const onCheckboxChange = vi.fn();
		const onSwitchChange = vi.fn();

		render(
			<>
				<Label htmlFor="alerts">Alerts</Label>
				<Checkbox id="alerts" onCheckedChange={onCheckboxChange} />
				<Switch
					id="compact"
					aria-label="Compact mode"
					onCheckedChange={onSwitchChange}
				/>
			</>,
		);

		await user.click(screen.getByText("Alerts"));
		await user.click(screen.getByRole("switch", { name: "Compact mode" }));

		expect(onCheckboxChange).toHaveBeenCalledWith(true);
		expect(onSwitchChange).toHaveBeenCalledWith(true);
		expect(screen.getByRole("checkbox")).toHaveAttribute(
			"data-state",
			"checked",
		);
		expect(
			screen.getByRole("switch", { name: "Compact mode" }),
		).toHaveAttribute("data-state", "checked");
	});

	it("renders dropdown labels, indicators, shortcuts, and submenus", async () => {
		render(
			<DropdownMenu open={true}>
				<DropdownMenuTrigger>Open actions</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuLabel inset={true}>Actions</DropdownMenuLabel>
					<DropdownMenuGroup>
						<DropdownMenuItem inset={true}>
							Copy
							<DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuCheckboxItem checked={true}>
							Show hidden
						</DropdownMenuCheckboxItem>
						<DropdownMenuRadioGroup value="compact">
							<DropdownMenuRadioItem value="compact">
								Compact rows
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator />
						<DropdownMenuSub open={true}>
							<DropdownMenuSubTrigger inset={true}>
								More actions
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem>Archive</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		expect(await screen.findByText("Actions")).toHaveClass("pl-8");
		expect(screen.getByText("Copy")).toHaveClass("pl-8");
		expect(screen.getByText("Ctrl+C")).toHaveClass("tracking-widest");
		expect(screen.getByText("Show hidden")).toHaveAttribute(
			"data-state",
			"checked",
		);
		expect(screen.getByText("Compact rows")).toHaveAttribute(
			"data-state",
			"checked",
		);
		expect(screen.getByText("More actions")).toHaveClass("pl-8");
		expect(screen.getByText("Archive")).toBeInTheDocument();
	});

	it("selects values and renders table structure", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();

		render(
			<>
				<Select onValueChange={onValueChange}>
					<SelectTrigger aria-label="Region">
						<SelectValue placeholder="Choose region" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Regions</SelectLabel>
							<SelectItem value="asia">Asia</SelectItem>
							<SelectSeparator />
							<SelectItem value="europe">Europe</SelectItem>
						</SelectGroup>
					</SelectContent>
				</Select>
				<Table>
					<TableCaption>Server summary</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell>edge-1</TableCell>
							<TableCell>online</TableCell>
						</TableRow>
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell>Total</TableCell>
							<TableCell>1</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</>,
		);

		await user.click(screen.getByRole("combobox", { name: "Region" }));
		await user.click(await screen.findByRole("option", { name: "Asia" }));

		expect(onValueChange).toHaveBeenCalledWith("asia");
		expect(screen.getByText("Server summary")).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Name" }),
		).toBeInTheDocument();
		expect(screen.getByText("edge-1")).toBeInTheDocument();
	});
});

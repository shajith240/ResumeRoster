"use client";

import {
	createContext,
	useContext,
	useId,
	useMemo,
	useState,
	type ComponentPropsWithoutRef,
	type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type AccordionType = "multiple" | "single";

type AccordionContextValue = {
	isOpen: (value: string) => boolean;
	toggle: (value: string) => void;
};

type AccordionItemContextValue = {
	contentId: string;
	triggerId: string;
	value: string;
};

type AccordionProps = ComponentPropsWithoutRef<"div"> & {
	defaultValue?: string | string[];
	type?: AccordionType;
};

type AccordionItemProps = ComponentPropsWithoutRef<"div"> & {
	value: string;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordion() {
	const context = useContext(AccordionContext);
	if (!context) {
		throw new Error("Accordion components must be used inside Accordion.");
	}
	return context;
}

function useAccordionItem() {
	const context = useContext(AccordionItemContext);
	if (!context) {
		throw new Error("AccordionTrigger and AccordionContent must be used inside AccordionItem.");
	}
	return context;
}

function getInitialValues(defaultValue: AccordionProps["defaultValue"]) {
	if (!defaultValue) return [];
	return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
}

function Accordion({
	children,
	className,
	defaultValue,
	type = "single",
	...props
}: AccordionProps) {
	const [openValues, setOpenValues] = useState<string[]>(
		getInitialValues(defaultValue),
	);

	const value = useMemo<AccordionContextValue>(
		() => ({
			isOpen: (itemValue) => openValues.includes(itemValue),
			toggle: (itemValue) => {
				setOpenValues((current) => {
					const isCurrentOpen = current.includes(itemValue);
					if (type === "multiple") {
						return isCurrentOpen
							? current.filter((value) => value !== itemValue)
							: [...current, itemValue];
					}

					return isCurrentOpen ? [] : [itemValue];
				});
			},
		}),
		[openValues, type],
	);

	return (
		<AccordionContext.Provider value={value}>
			<div className={className} {...props}>
				{children}
			</div>
		</AccordionContext.Provider>
	);
}

function AccordionItem({
	children,
	className,
	value,
	...props
}: AccordionItemProps) {
	const id = useId();
	const contextValue = useMemo(
		() => ({
			contentId: `${id}-content`,
			triggerId: `${id}-trigger`,
			value,
		}),
		[id, value],
	);

	return (
		<AccordionItemContext.Provider value={contextValue}>
			<div className={className} data-value={value} {...props}>
				{children}
			</div>
		</AccordionItemContext.Provider>
	);
}

function AccordionTrigger({
	children,
	className,
	...props
}: ComponentPropsWithoutRef<"button">) {
	const { isOpen, toggle } = useAccordion();
	const { contentId, triggerId, value } = useAccordionItem();
	const open = isOpen(value);

	return (
		<button
			aria-controls={contentId}
			aria-expanded={open}
			className={cn("accordion-trigger", className)}
			data-state={open ? "open" : "closed"}
			id={triggerId}
			onClick={() => toggle(value)}
			type="button"
			{...props}
		>
			{children}
		</button>
	);
}

function AccordionContent({
	children,
	className,
	...props
}: ComponentPropsWithoutRef<"div"> & { children?: ReactNode }) {
	const { isOpen } = useAccordion();
	const { contentId, triggerId, value } = useAccordionItem();
	const open = isOpen(value);

	return (
		<div
			aria-labelledby={triggerId}
			className={cn("accordion-content", className)}
			data-state={open ? "open" : "closed"}
			hidden={!open}
			id={contentId}
			role="region"
			{...props}
		>
			{children}
		</div>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

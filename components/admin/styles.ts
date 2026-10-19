// Shared admin control styles, built on shadcn/ui's button variants and input
// look so every admin page matches. `press` adds the 160ms press feedback.
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

export const primaryButton = cn(buttonVariants({ size: "lg" }), "press h-10 px-4");
export const secondaryButton = cn(buttonVariants({ variant: "outline", size: "lg" }), "press h-9 px-3");
export const iconButton = cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "press");

// Padding-based height (not a fixed h-*) because textareas and selects share it.
export const inputClass =
  "w-full min-w-0 border border-input bg-transparent px-3 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50 aria-[invalid=true]:border-2 aria-[invalid=true]:border-foreground dark:bg-input/20 md:text-sm";

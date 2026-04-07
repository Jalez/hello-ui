"use client";

import type { ReactNode } from "react";
import type { TooltipRenderProps } from "react-joyride";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

function nodeToPlainText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToPlainText).join("");
  return "";
}

export function GameboardTourTooltip(props: TooltipRenderProps) {
  const {
    backProps,
    closeProps,
    continuous,
    index,
    isLastStep,
    primaryProps,
    skipProps,
    step,
    tooltipProps,
  } = props;

  const { buttons, content, title } = step;
  const closeChildren = (closeProps as { children?: ReactNode }).children;

  const stepData = step.data as { description?: string } | undefined;
  const description = stepData?.description;

  const ariaDescribedBy = [
    description ? "joyride-tooltip-description" : null,
    "joyride-tooltip-content",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaProps = title
    ? {
        "aria-labelledby": "joyride-tooltip-title",
        "aria-describedby": ariaDescribedBy,
      }
    : {
        "aria-label": [nodeToPlainText(description), nodeToPlainText(content)].filter(Boolean).join(". "),
        "aria-describedby": ariaDescribedBy,
      };

  const showBack = Boolean(continuous && buttons.includes("back") && index > 0);
  const showSkip = Boolean(continuous && buttons.includes("skip") && !isLastStep);
  const showFooter = buttons.some(
    (b) => b === "back" || b === "primary" || b === "skip"
  );

  return (
    <div
      className={cn(
        "react-joyride__tooltip w-[min(22rem,calc(100vw-1rem))] max-w-[min(22rem,calc(100vw-1rem))]",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      data-joyride-step={index}
      {...(step.id ? { "data-joyride-id": step.id } : {})}
      {...tooltipProps}
      {...ariaProps}
    >
      <Card className="relative max-h-[min(80vh,40rem)] gap-0 overflow-hidden border-border bg-card py-0 shadow-lg">
        {buttons.includes("close") ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 h-8 w-8 shrink-0 border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
            aria-label={closeProps["aria-label"]}
            title={closeProps.title}
            data-action={closeProps["data-action"]}
            onClick={closeProps.onClick}
          >
            <X className="h-4 w-4" aria-hidden />
            {closeChildren != null ? (
              <span className="sr-only">{closeChildren}</span>
            ) : null}
          </Button>
        ) : null}

        {title ? (
          <CardHeader className="space-y-1.5 pb-2 pr-12 pt-4">
            <CardTitle
              id="joyride-tooltip-title"
              className="break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]"
            >
              {title}
            </CardTitle>
            {description ? (
              <CardDescription
                id="joyride-tooltip-description"
                className="break-words text-xs leading-snug [overflow-wrap:anywhere]"
              >
                {description}
              </CardDescription>
            ) : null}
          </CardHeader>
        ) : null}

        <CardContent
          id="joyride-tooltip-content"
          className={cn(
            "max-h-[min(50vh,24rem)] overflow-y-auto break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
            title ? "pb-3" : "pb-3 pt-4 pr-12",
          )}
        >
          {!title && description ? (
            <p id="joyride-tooltip-description" className="mb-2 break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              {description}
            </p>
          ) : null}
          <div className="break-words [overflow-wrap:anywhere] [&_*]:max-w-full">
            {content}
          </div>
        </CardContent>

        {showFooter ? (
          <CardFooter className="flex flex-wrap items-center justify-end gap-1 border-t border-border/60 px-4 py-3">
            {showSkip ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mr-auto border-0 bg-transparent shadow-none hover:bg-transparent"
                {...skipProps}
              />
            ) : null}
            {showBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="border-0 bg-transparent shadow-none hover:bg-transparent"
                {...backProps}
              />
            ) : null}
            {buttons.includes("primary") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="border-0 bg-transparent font-semibold text-foreground shadow-none hover:bg-transparent"
                {...primaryProps}
              />
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

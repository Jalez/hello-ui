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
        "react-joyride__tooltip max-w-[min(22rem,calc(100vw-2rem))]",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      data-joyride-step={index}
      {...(step.id ? { "data-joyride-id": step.id } : {})}
      {...tooltipProps}
      {...ariaProps}
    >
      <Card className="relative gap-0 border-border bg-card py-0 shadow-lg">
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
              className="text-base font-semibold leading-snug"
            >
              {title}
            </CardTitle>
            {description ? (
              <CardDescription
                id="joyride-tooltip-description"
                className="text-xs leading-snug"
              >
                {description}
              </CardDescription>
            ) : null}
          </CardHeader>
        ) : null}

        <CardContent
          id="joyride-tooltip-content"
          className={cn(
            "text-sm leading-relaxed text-muted-foreground",
            title ? "pb-3" : "pb-3 pt-4 pr-12",
          )}
        >
          {!title && description ? (
            <p id="joyride-tooltip-description" className="mb-2 text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
          {content}
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

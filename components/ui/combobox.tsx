"use client";

import * as React from "react";
import Select, { type GroupBase, type InputActionMeta, type MenuPlacement, type SingleValue } from "react-select";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
  disabled?: boolean;
}

interface ComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  disabled?: boolean;
  isLoading?: boolean;
  menuPlacement?: MenuPlacement;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  renderOption?: (option: ComboboxOption, isSelected: boolean) => React.ReactNode;
  renderValue?: (selected: ComboboxOption | null) => React.ReactNode;
}

export function Combobox({
  value,
  onValueChange,
  options,
  inputValue,
  onInputChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  loadingText = "Loading...",
  disabled = false,
  isLoading = false,
  menuPlacement = "auto",
  className,
  triggerClassName,
  contentClassName,
  renderOption,
  renderValue,
}: ComboboxProps) {
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const formatOptionLabel = (
    option: ComboboxOption,
    meta: { context: "menu" | "value"; selectValue: readonly ComboboxOption[] }
  ) => {
    if (meta.context === "value") {
      // Use `option` here — it is the value row react-select is rendering; `selected` from useMemo can lag.
      return renderValue ? renderValue(option) : option.label;
    }

    const isSelected = meta.selectValue.some((item) => item.value === option.value);
    if (renderOption) {
      return renderOption(option, isSelected);
    }
    return <span className="truncate">{option.label}</span>;
  };

  return (
    <Select<ComboboxOption, false, GroupBase<ComboboxOption>>
      className={cn("w-full", className)}
      classNames={{
        control: () => cn(triggerClassName),
        menu: () => cn(contentClassName),
      }}
      options={options}
      value={selected}
      inputValue={inputValue}
      isLoading={isLoading}
      isDisabled={disabled}
      menuPlacement={menuPlacement}
      isSearchable
      isClearable={false}
      blurInputOnSelect
      placeholder={placeholder}
      noOptionsMessage={() => emptyText}
      loadingMessage={() => loadingText}
      formatOptionLabel={formatOptionLabel}
      getOptionLabel={(option) => option.label}
      getOptionValue={(option) => option.value}
      isOptionDisabled={(option) => Boolean(option.disabled)}
      onInputChange={(nextValue: string, meta: InputActionMeta) => {
        if (meta.action === "input-change") {
          onInputChange?.(nextValue);
        }
      }}
      onChange={(next: SingleValue<ComboboxOption>) => {
        if (next) {
          onValueChange(next.value);
        }
      }}
      styles={{
        container: (base) => ({ ...base, width: "100%" }),
        control: (base, state) => ({
          ...base,
          minHeight: 40,
          paddingLeft: 2,
          borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
          boxShadow: state.isFocused ? "0 0 0 1px hsl(var(--ring))" : "none",
          backgroundColor: state.isFocused ? "hsl(var(--accent) / 0.15)" : "hsl(var(--background))",
          borderRadius: 8,
          transition: "all 120ms ease",
        }),
        valueContainer: (base) => ({
          ...base,
          paddingLeft: 8,
        }),
        indicatorSeparator: (base) => ({
          ...base,
          backgroundColor: "hsl(var(--border))",
        }),
        dropdownIndicator: (base, state) => ({
          ...base,
          color: state.isFocused ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          paddingLeft: 10,
          paddingRight: 10,
        }),
        loadingIndicator: (base) => ({
          ...base,
          color: "hsl(var(--muted-foreground))",
        }),
        menu: (base) => ({
          ...base,
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          overflow: "hidden",
          zIndex: 1000,
          backgroundColor: "hsl(var(--popover))",
          boxShadow: "0 10px 24px -8px hsl(var(--foreground) / 0.25)",
        }),
        menuList: (base) => ({
          ...base,
          paddingTop: 6,
          paddingBottom: 6,
        }),
        option: (base, state) => ({
          ...base,
          padding: "10px 12px",
          backgroundColor: state.isSelected
            ? "hsl(var(--accent))"
            : state.isFocused
              ? "hsl(var(--accent) / 0.55)"
              : "transparent",
          color: "hsl(var(--foreground))",
          cursor: state.isDisabled ? "not-allowed" : "pointer",
        }),
        singleValue: (base) => ({ ...base, color: "hsl(var(--foreground))" }),
        input: (base) => ({ ...base, color: "hsl(var(--foreground))" }),
        placeholder: (base) => ({ ...base, color: "hsl(var(--muted-foreground))" }),
      }}
      aria-label={searchPlaceholder}
    />
  );
}

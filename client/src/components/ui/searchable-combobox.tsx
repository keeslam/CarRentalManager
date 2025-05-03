import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  tags?: string[];
};

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  groups?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  variant?: "default" | "outline" | "subtle";
  className?: string;
  recentValues?: string[];
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  emptyMessage = "No options found.",
  groups = false,
  disabled = false,
  searchPlaceholder = "Search...",
  variant = "default",
  className,
  recentValues = [],
}: SearchableComboboxProps) {
  // Instead of using the Popover component, let's use a simpler Select component
  return (
    <Select 
      value={value} 
      onValueChange={onChange} 
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.label}
              {option.tags && option.tags.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {option.tags[0]}
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
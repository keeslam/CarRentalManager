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
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Organize options by group if necessary
  const groupedOptions = React.useMemo(() => {
    if (!groups) return { undefined: filteredOptions };
    
    const grouped: Record<string, ComboboxOption[]> = {};
    
    // Add "Recent" group if there are recent values
    if (recentValues.length > 0) {
      grouped["Recent"] = options.filter(option => 
        recentValues.includes(option.value)
      );
    }
    
    filteredOptions.forEach((option) => {
      const group = option.group || "Other";
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(option);
    });
    
    return grouped;
  }, [filteredOptions, groups, options, recentValues]);

  // Get the display value for the selected item
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant={variant === "default" ? "outline" : "secondary"}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          onClick={() => setOpen(!open)}
        >
          {value && selectedOption ? (
            <div className="flex items-center gap-2 text-left">
              {selectedOption.label}
              {selectedOption.tags && selectedOption.tags.length > 0 && (
                <Badge 
                  variant="outline" 
                  className="ml-2 text-xs font-normal"
                >
                  {selectedOption.tags[0]}
                </Badge>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            onValueChange={setSearchQuery}
            value={searchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <ScrollArea className="h-[280px]">
              {Object.entries(groupedOptions).map(([group, options]) => (
                <CommandGroup key={group} heading={group !== "undefined" ? group : undefined}>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          <Check
                            className={cn(
                              "h-4 w-4",
                              value === option.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </div>
                        {option.description && (
                          <span className="text-sm text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Get grouped options
  const groupedOptions = React.useMemo(() => {
    if (!groups) return { "All Items": filteredOptions };
    
    const grouped: Record<string, ComboboxOption[]> = {};
    
    // Add recent values to top of the list, if any
    if (recentValues && recentValues.length > 0) {
      const recentOptions = options.filter(option => 
        recentValues.includes(option.value)
      );
      if (recentOptions.length > 0) {
        grouped["Recent"] = recentOptions;
      }
    }
    
    // Group the filtered options
    filteredOptions.forEach(option => {
      const group = option.group || "Other";
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(option);
    });
    
    return grouped;
  }, [filteredOptions, groups, options, recentValues]);

  // Find the selected option for display
  const selectedOption = options.find(option => option.value === value);
  
  // Handle when user presses Enter in search field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      onChange(filteredOptions[0].value);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
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
          <div className="flex items-center truncate">
            {selectedOption ? (
              <span className="flex items-center gap-2 truncate">
                {selectedOption.label}
                {selectedOption.tags && selectedOption.tags.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-xs font-normal">
                    {selectedOption.tags[0]}
                  </Badge>
                )}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[350px] md:w-[450px]" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder={searchPlaceholder} 
              onValueChange={setSearchQuery}
              value={searchQuery}
              className="h-9 flex-1"
              onKeyDown={handleKeyDown}
            />
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <ScrollArea className="h-[400px] md:h-[500px]">
              {Object.entries(groupedOptions).map(([group, groupOptions]) => (
                <CommandGroup key={group} heading={group !== "All Items" ? group : undefined}>
                  {groupOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex flex-col">
                          <span className="font-semibold">{option.label}</span>
                          {option.description && (
                            <span className="text-xs text-muted-foreground mt-0.5 max-w-[300px] line-clamp-2">
                              {option.description}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            {option.tags && option.tags.length > 0 && option.tags[0] && (
                              <Badge variant="outline" className="text-xs">
                                {option.tags[0]}
                              </Badge>
                            )}
                            {value === option.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
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
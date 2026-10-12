"use client";
import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangePickerProps {
  date?: DateRange;
  setDate?: (range: DateRange | undefined) => void;
  onSelect?: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
  disabledFutureDates?: boolean;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  date,
  setDate,
  onSelect,
  className,
  placeholder = "Seleccionar rango",
  disabledFutureDates = true,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    setDate?.(range);
    onSelect?.(range);
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "h-9 w-full md:w-auto inline-flex items-center justify-start gap-1.5 rounded-lg border border-border bg-background px-2.5 text-left text-sm font-normal min-w-[220px] hover:bg-muted transition-all outline-none",
          className
        )}
      >
        <CalendarIcon size={14} className="mr-2 text-gray-700 shrink-0" />
        {date?.from ? (
          date.to ? (
            <span className="truncate">
              {format(date.from, "dd/MM/yyyy")} – {format(date.to, "dd/MM/yyyy")}
            </span>
          ) : (
            <span>{format(date.from, "dd/MM/yyyy")}</span>
          )
        ) : (
          <span className="text-gray-700">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          selected={date}
          onSelect={handleSelect}
          disabled={disabledFutureDates ? (d) => d > new Date() : undefined}
          numberOfMonths={2}
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

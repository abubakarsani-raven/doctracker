"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Date + time picker composed the way shadcn documents for "Time Picker":
 * Calendar in a Popover, plus a native `input type="time"`.
 * See https://ui.shadcn.com/docs/components/date-picker#time-picker
 */

function toTimeValue(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "09:00";
  return format(date, "HH:mm");
}

function combineDateAndTime(
  date: Date | undefined,
  time: string,
): Date | undefined {
  if (!date) return undefined;
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return date;
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  dateLabel?: string;
  timeLabel?: string;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  dateLabel = "Date",
  timeLabel = "Time",
  placeholder = "Pick a date",
  className,
}: DateTimePickerProps) {
  const [time, setTime] = React.useState(() => toTimeValue(value));

  React.useEffect(() => {
    setTime(toTimeValue(value));
  }, [value]);

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      onChange(undefined);
      return;
    }
    onChange(combineDateAndTime(selected, time));
  };

  const handleTimeChange = (nextTime: string) => {
    setTime(nextTime || "00:00");
    if (!value) return;
    onChange(combineDateAndTime(value, nextTime || "00:00"));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="space-y-2">
        <Label>{dateLabel}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              data-empty={!value}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, "PPP") : <span>{placeholder}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="datetime-time">{timeLabel}</Label>
        <div className="relative">
          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="datetime-time"
            type="time"
            step={60}
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled || !value}
            className="bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
        </div>
        {!value && (
          <p className="text-xs text-muted-foreground">
            Pick a date first, then set the time.
          </p>
        )}
      </div>

      {value ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Selected: </span>
          <span className="font-medium">{format(value, "PPp")}</span>
        </p>
      ) : null}
    </div>
  );
}

"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

/**
 * A searchable select.
 *
 * This keeps the shadcn `Select` API exactly — `Select`, `SelectTrigger`,
 * `SelectValue`, `SelectContent`, `SelectItem` and friends behave the same from
 * a caller's point of view — but is built on Popover + cmdk instead of Radix
 * Select, so every dropdown in the app gets a filter box for free. Doing it here
 * rather than at each call site is what stops the two patterns from drifting
 * apart as new screens are added.
 *
 * The list shows at most six rows and scrolls past that, so a dropdown never
 * takes over the screen no matter how many records are behind it.
 */

/** How many rows are visible before the list starts scrolling. */
const MAX_VISIBLE_ITEMS = 6
/** Height of a single row (py-1.5 + text-sm), in rem. */
const ITEM_ROW_HEIGHT_REM = 2.25
const LIST_MAX_HEIGHT = `${MAX_VISIBLE_ITEMS * ITEM_ROW_HEIGHT_REM}rem`

/** Show the filter box only once a list is long enough to need one. */
const SEARCH_THRESHOLD = 7

interface SelectItemRecord {
  /** The item's own children, replayed in the trigger when it is selected. */
  node: React.ReactNode
  /** Flattened text, used for filtering. */
  text: string
}

interface SelectContextValue {
  value: string | undefined
  select: (value: string) => void
  items: Map<string, SelectItemRecord>
  itemCount: number
  disabled: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error(`<${component}> must be used inside <Select>`)
  }
  return context
}

/** Flatten arbitrary children into plain text so the filter can match on it. */
function toText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(toText).filter(Boolean).join(" ")
  if (React.isValidElement(node)) {
    return toText((node.props as { children?: React.ReactNode })?.children)
  }
  return ""
}

/**
 * Walk the subtree for `SelectItem`s. The trigger has to render the selected
 * item's label even while the list is closed, so the labels are collected from
 * the element tree rather than read out of the open popover.
 */
function collectItems(
  node: React.ReactNode,
  out: Map<string, SelectItemRecord>,
) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return

    const type = child.type as { __isSelectItem?: boolean }
    const props = child.props as {
      value?: string
      children?: React.ReactNode
    }

    if (type?.__isSelectItem && props.value !== undefined) {
      out.set(String(props.value), {
        node: props.children,
        text: toText(props.children),
      })
      return
    }

    if (props?.children) collectItems(props.children, out)
  })
}

interface SelectProps {
  value?: string
  defaultValue?: string
  /**
   * Declared as a method rather than a property so TypeScript checks the
   * parameter bivariantly, matching the Radix original. Call sites narrow this
   * to their own union (`(v: "user" | "department") => void`) and must keep
   * compiling unchanged.
   */
  onValueChange?(value: string): void
  disabled?: boolean
  open?: boolean
  onOpenChange?(open: boolean): void
  children?: React.ReactNode
  /** Accepted for API parity with the Radix original; unused. */
  name?: string
  required?: boolean
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  open: openProp,
  onOpenChange,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [internalOpen, setInternalOpen] = React.useState(false)

  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const isOpenControlled = openProp !== undefined
  const open = isOpenControlled ? openProp : internalOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isOpenControlled, onOpenChange],
  )

  const items = React.useMemo(() => {
    const map = new Map<string, SelectItemRecord>()
    collectItems(children, map)
    return map
  }, [children])

  const select = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
      setOpen(false)
    },
    [isControlled, onValueChange, setOpen],
  )

  const context = React.useMemo<SelectContextValue>(
    () => ({
      value: currentValue,
      select,
      items,
      itemCount: items.size,
      disabled,
    }),
    [currentValue, select, items, disabled],
  )

  return (
    <SelectContext.Provider value={context}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        {children}
      </Popover>
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <CommandGroup data-slot="select-group" className={className} {...props} />
}

function SelectValue({
  placeholder,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  placeholder?: React.ReactNode
}) {
  const { value, items } = useSelectContext("SelectValue")
  const selected = value !== undefined ? items.get(value) : undefined

  return (
    <span
      data-slot="select-value"
      className={cn("truncate", className)}
      {...props}
    >
      {selected ? (
        selected.node
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled: disabledProp,
  ...props
}: React.ComponentProps<"button"> & {
  size?: "sm" | "default"
}) {
  const { value, disabled } = useSelectContext("SelectTrigger")

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        data-slot="select-trigger"
        data-size={size}
        data-placeholder={value === undefined || value === "" ? "" : undefined}
        disabled={disabled || disabledProp}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
  )
}

function SelectContent({
  className,
  children,
  align = "start",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  ...props
}: Omit<React.ComponentProps<typeof PopoverContent>, "children"> & {
  children?: React.ReactNode
  searchPlaceholder?: string
  emptyMessage?: string
  /** Accepted for API parity with the Radix original; unused. */
  position?: "item-aligned" | "popper"
}) {
  const { itemCount } = useSelectContext("SelectContent")
  const showSearch = itemCount >= SEARCH_THRESHOLD

  // `position` is destructured above purely so it is not forwarded to the DOM.
  const { position: _position, ...contentProps } = props as Record<string, unknown>

  return (
    <PopoverContent
      data-slot="select-content"
      align={align}
      className={cn(
        "w-(--radix-popover-trigger-width) min-w-32 p-0",
        className,
      )}
      {...(contentProps as React.ComponentProps<typeof PopoverContent>)}
    >
      <Command>
        {showSearch && <CommandInput placeholder={searchPlaceholder} />}
        <CommandList style={{ maxHeight: LIST_MAX_HEIGHT }}>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          {children}
        </CommandList>
      </Command>
    </PopoverContent>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof CommandItem>, "value" | "onSelect"> & {
  value: string
}) {
  const { value: selectedValue, select } = useSelectContext("SelectItem")
  const isSelected = selectedValue === value

  // cmdk lowercases the value it hands back and needs each entry to be unique,
  // so the real value is closed over instead of being read from the callback.
  const searchValue = `${toText(children)} ${value}`.trim()

  return (
    <CommandItem
      data-slot="select-item"
      value={searchValue}
      disabled={disabled}
      onSelect={() => select(value)}
      className={cn(
        "[&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        {isSelected && <CheckIcon className="size-4" />}
      </span>
      {children}
    </CommandItem>
  )
}

// Lets `collectItems` recognise the element without importing it circularly.
SelectItem.__isSelectItem = true

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparator>) {
  return (
    <CommandSeparator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

/**
 * The Radix original rendered scroll affordances at the edges of the list. The
 * cmdk list scrolls natively, so these remain only so existing imports keep
 * resolving.
 */
function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

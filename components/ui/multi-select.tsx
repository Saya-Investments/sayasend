'use client'

import * as React from 'react'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type MultiSelectOption = {
  value: string
  label?: string
}

type MultiSelectProps = {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  emptyText?: string
}

// Selector de múltiples valores construido con Popover + checkboxes. Comparte el
// estilo del <SelectTrigger> para que se vea igual que los filtros de un solo
// valor. Muestra los valores elegidos como badges dentro del disparador.
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una o varias opciones',
  disabled = false,
  id,
  className,
  emptyText = 'Sin opciones disponibles',
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const remove = (optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  const labelFor = (optionValue: string) =>
    options.find((option) => option.value === optionValue)?.label ?? optionValue

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((selected) => (
                <Badge
                  key={selected}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {labelFor(selected)}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Quitar ${labelFor(selected)}`}
                    onClick={(event) => remove(selected, event)}
                    className="rounded-sm opacity-70 hover:opacity-100"
                  >
                    <XIcon className="size-3" />
                  </span>
                </Badge>
              ))
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] max-h-72 overflow-y-auto p-1"
      >
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          options.map((option) => {
            const checked = value.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                {option.label ?? option.value}
              </button>
            )
          })
        )}
      </PopoverContent>
    </Popover>
  )
}

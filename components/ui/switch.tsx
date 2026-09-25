"use client"

import * as React from "react"
import { cn } from "@/lib/cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // after:-inset-* expands the invisible hit area to 44px minimum
        // below md without growing the visible track (spec 4.1 tap targets).
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-150 ease-out outline-none after:absolute after:-inset-x-3.5 after:-inset-y-[13px] md:after:inset-0 focus-visible:ring-2 focus-visible:ring-[var(--brand-from)] aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[state=checked]:bg-[var(--brand-from)] data-[state=unchecked]:bg-elevated data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-text ring-0 transition-transform duration-150 ease-out group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

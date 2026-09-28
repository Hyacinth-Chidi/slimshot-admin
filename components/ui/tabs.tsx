"use client"

import * as React from "react"
import { cn } from "@/lib/cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-surface p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // 44px below md, per the responsive strategy; compact at md+.
        "inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted md:h-8",
        "transition-colors duration-150 ease-out hover:text-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-elevated data-[state=active]:text-text",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }

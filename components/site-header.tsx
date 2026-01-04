"use client"

import * as React from "react"
import { Search, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useMobileNav } from "@/components/mobile-nav"

export function SiteHeader() {
  const { openMobileNav } = useMobileNav()

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-4 bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden cursor-pointer gap-2 -ml-1"
        onClick={openMobileNav}
      >
        <Menu className="h-5 w-5" />
        <span className="text-sm font-medium">Menu</span>
      </Button>
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
      <div className="relative flex-1 max-w-2xl hidden md:block">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by DIN or drug name..."
          className="pl-8 h-9"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span>Synced 5m ago</span>
      </div>
    </header>
  )
}

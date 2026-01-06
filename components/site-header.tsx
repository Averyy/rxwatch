"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Search, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useMobileNav } from "@/components/mobile-nav"

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  // Check if same day
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // Otherwise show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SiteHeader() {
  const { openMobileNav } = useMobileNav()
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncText, setSyncText] = useState('Checking...')

  // Fetch last sync time on mount and every minute
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setLastSyncedAt(data.lastSyncedAt);
        }
      } catch (err) {
        console.log('Health check failed:', err);
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Update display text every 30 seconds (for "Xm ago" to stay fresh)
  useEffect(() => {
    function updateText() {
      setSyncText(formatSyncTime(lastSyncedAt));
    }

    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

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
          placeholder="Search all drugs and shortage reports..."
          className="pl-8 h-9"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span>Synced {syncText}</span>
      </div>
    </header>
  )
}

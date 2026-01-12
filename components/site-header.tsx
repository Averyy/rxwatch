"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useMobileNav } from "@/components/mobile-nav"
import { DrugSearch } from "@/components/drug-search"

export function SiteHeader() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Navigation')
  const tSearch = useTranslations('Search')
  const { openMobileNav } = useMobileNav()
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncText, setSyncText] = useState('')

  // Format sync time with translations
  const formatSyncTime = useCallback((dateStr: string | null): string => {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    // Check if same day
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      if (diffMins < 1) return t('justNow');
      if (diffMins < 60) return t('mAgo', { minutes: diffMins });
      return t('hAgo', { hours: diffHours });
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday');
    }

    // Otherwise show the date
    return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric' });
  }, [t, locale]);

  // Hide header on homepage (has its own search)
  const isHomepage = pathname === '/' || pathname === `/${locale}` || pathname === `/${locale}/`

  // Fetch last sync time on mount and every minute
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setLastSyncedAt(data.lastSyncedAt);
        }
      } catch {
        // Health check failed silently - sync indicator will show stale time
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
  }, [lastSyncedAt, formatSyncTime]);

  // On homepage, only show mobile menu button (minimal header)
  if (isHomepage) {
    return (
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-4 bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 md:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-2 -ml-1"
          onClick={openMobileNav}
          aria-expanded={false}
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">{t('menu')}</span>
        </Button>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-4 bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden cursor-pointer gap-2 -ml-1"
        onClick={openMobileNav}
        aria-expanded={false}
        aria-label={t('openMenu')}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">{t('menu')}</span>
      </Button>
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
      <DrugSearch
        variant="header"
        placeholder={tSearch('headerPlaceholder')}
        className="flex-1 max-w-2xl hidden md:block"
      />
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span>{syncText ? t('synced', { time: syncText }) : t('checking')}</span>
      </div>
    </header>
  )
}

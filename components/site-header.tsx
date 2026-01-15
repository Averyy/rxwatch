"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useMobileNav } from "@/components/mobile-nav"
import { DrugSearch } from "@/components/drug-search"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SyncData {
  lastSyncedAt: string | null
  dsc: { lastSyncedAt: string | null; status: string }
  dpd: { lastSyncedAt: string | null; status: string }
}

export function SiteHeader() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Navigation')
  const tSearch = useTranslations('Search')
  const { openMobileNav } = useMobileNav()
  const [syncData, setSyncData] = useState<SyncData | null>(null)
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
          setSyncData(data.sync);
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
      setSyncText(formatSyncTime(syncData?.lastSyncedAt || null));
    }

    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [syncData, formatSyncTime]);

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
      <SidebarTrigger className="-ml-1 mr-2 hidden md:flex" />
      <DrugSearch
        variant="header"
        placeholder={tSearch('headerPlaceholder')}
        className="flex-1 max-w-2xl hidden md:block"
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
              <div className={`h-1.5 w-1.5 rounded-full ${
                syncData?.dsc?.status === 'stale'
                  ? 'bg-yellow-500'
                  : 'bg-primary animate-pulse'
              }`} />
              <span>{syncText ? t('synced', { time: syncText }) : t('checking')}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="text-xs">
            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('syncReports')}:</span>
                <span>{syncData?.dsc?.lastSyncedAt ? formatSyncTime(syncData.dsc.lastSyncedAt) : t('syncNever')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('syncDrugs')}:</span>
                <span>{syncData?.dpd?.lastSyncedAt ? formatSyncTime(syncData.dpd.lastSyncedAt) : t('syncNever')}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
  )
}

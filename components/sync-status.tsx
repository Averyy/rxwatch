"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"

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

interface SyncStatusProps {
  variant?: "header" | "homepage"
}

export function SyncStatus({ variant = "header" }: SyncStatusProps) {
  const locale = useLocale()
  const t = useTranslations('Navigation')
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

  // Fetch last sync time on mount and every minute
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        // Parse JSON even for 503 (degraded) - it still has valid sync data
        const data = await res.json();
        if (data.sync) {
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

  const isStale = syncData?.dsc?.status === 'stale';
  const label = syncText ? t('synced', { time: syncText }) : t('checking');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 text-muted-foreground cursor-help ${
            variant === "homepage" ? "justify-center text-sm" : "ml-auto text-xs"
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              isStale ? 'bg-yellow-500' : 'bg-primary animate-pulse'
            }`} />
            <span>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align={variant === "homepage" ? "center" : "end"} className="text-xs">
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="opacity-70">{t('syncReports')}:</span>
              <span>{syncData?.dsc?.lastSyncedAt ? formatSyncTime(syncData.dsc.lastSyncedAt) : t('syncNever')}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="opacity-70">{t('syncDrugs')}:</span>
              <span>{syncData?.dpd?.lastSyncedAt ? formatSyncTime(syncData.dpd.lastSyncedAt) : t('syncNever')}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useMobileNav } from "@/components/mobile-nav"
import { DrugSearch } from "@/components/drug-search"
import { SyncStatus } from "@/components/sync-status"

export function SiteHeader() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Navigation')
  const tSearch = useTranslations('Search')
  const { openMobileNav } = useMobileNav()

  // Hide header on homepage (has its own search)
  const isHomepage = pathname === '/' || pathname === `/${locale}` || pathname === `/${locale}/`

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
      <SyncStatus variant="header" />
    </header>
  )
}

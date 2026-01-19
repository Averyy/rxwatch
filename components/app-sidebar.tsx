"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useLocale, useTranslations } from "next-intl"
import {
  Home,
  Pill,
  FileText,
  BarChart3,
  Info,
  Moon,
  Sun,
  Shield,
  Scale,
  AlertTriangle,
  Github,
  ExternalLink,
  Globe,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navMainKeys = [
  { key: "home", url: "/", icon: Home },
  { key: "drugs", url: "/drugs", icon: Pill },
  { key: "reports", url: "/reports", icon: FileText },
  { key: "stats", url: "/stats", icon: BarChart3 },
]

const navSecondaryKeys = [
  { key: "about", url: "/about", icon: Info },
  { key: "privacy", url: "/privacy", icon: Shield },
  { key: "terms", url: "/terms", icon: Scale },
  { key: "github", url: "https://github.com/Averyy/rxwatch", icon: Github, external: true },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("Navigation")
  const tCommon = useTranslations("Common")
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const toggleLanguage = () => {
    const newLocale = locale === "en" ? "fr" : "en"
    // Remove current locale from pathname and add new locale
    const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, "")
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  // Check if path is active (accounting for locale prefix and subpages)
  const isActive = (url: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, "")
    if (url === "/") {
      return pathWithoutLocale === "" || pathWithoutLocale === "/"
    }
    // Match exact path or subpages (e.g., /drugs matches /drugs/12345)
    return pathWithoutLocale === url || pathWithoutLocale.startsWith(url + "/")
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/${locale}`}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
                  <Image
                    src="/logo.png"
                    alt="RxWatch"
                    width={32}
                    height={32}
                    className="size-8 object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">RxWatch Canada</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("subtitle")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMainKeys.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={t(item.key)}
                  >
                    <Link href={`/${locale}${item.url === "/" ? "" : item.url}`}>
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondaryKeys.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={!item.external && isActive(item.url)}
                    tooltip={t(item.key)}
                  >
                    {item.external ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group/ext">
                        <item.icon />
                        <span className="flex items-center gap-1">
                          {t(item.key)}
                          <ExternalLink className="!h-3 !w-3 text-muted-foreground group-hover/ext:text-primary" />
                        </span>
                      </a>
                    ) : (
                      <Link href={`/${locale}${item.url}`}>
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={locale === "en" ? "Français" : "English"}
                  onClick={toggleLanguage}
                  className="cursor-pointer"
                >
                  <Globe />
                  <span>{locale === "en" ? "English" : "Français"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={mounted ? (resolvedTheme === "dark" ? t("lightMode") : t("darkMode")) : t("toggleTheme")}
                  onClick={toggleTheme}
                  className="cursor-pointer"
                  aria-label={t("toggleTheme")}
                >
                  <Sun className="dark:hidden" aria-hidden="true" />
                  <Moon className="hidden dark:block" aria-hidden="true" />
                  <span className="dark:hidden">{t("lightMode")}</span>
                  <span className="hidden dark:inline">{t("darkMode")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 group-data-[collapsible=icon]:hidden">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-foreground">
              <p className="font-medium">{tCommon("notMedicalAdvice")}</p>
              <p className="text-muted-foreground mt-1">
                {tCommon("consultProfessional")}{" "}
                <a
                  href="https://www.healthproductshortages.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  {tCommon("viewOfficialData")} →
                </a>
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

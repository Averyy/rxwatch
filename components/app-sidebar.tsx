"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
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
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navMain = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Drugs",
    url: "/drugs",
    icon: Pill,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: FileText,
  },
  {
    title: "Stats",
    url: "/stats",
    icon: BarChart3,
  },
]

const navSecondary = [
  {
    title: "About",
    url: "/about",
    icon: Info,
  },
  {
    title: "Privacy Policy",
    url: "/privacy",
    icon: Shield,
  },
  {
    title: "Terms of Service",
    url: "/terms",
    icon: Scale,
  },
  {
    title: "GitHub",
    url: "https://github.com/Averyy/rxwatch",
    icon: Github,
    external: true,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { setTheme, theme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
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
                  <span className="truncate text-xs text-muted-foreground">Drug Shortage Intelligence</span>
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
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
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
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={!item.external && pathname === item.url}
                    tooltip={item.title}
                  >
                    {item.external ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    ) : (
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Toggle theme"
                  onClick={toggleTheme}
                  className="cursor-pointer"
                >
                  <Sun className="dark:hidden" />
                  <Moon className="hidden dark:block" />
                  <span className="dark:hidden">Light mode</span>
                  <span className="hidden dark:inline">Dark mode</span>
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
              <p className="font-medium">Not medical advice</p>
              <p className="text-muted-foreground mt-1">
                Always consult your pharmacist or doctor before making changes.{" "}
                <a
                  href="https://www.drugshortagescanada.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  View official data →
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

"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
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
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const navMain = [
  { title: "Home", url: "/", icon: Home },
  { title: "Drugs", url: "/drugs", icon: Pill },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Stats", url: "/stats", icon: BarChart3 },
]

const navSecondary = [
  { title: "About", url: "/about", icon: Info },
  { title: "Privacy Policy", url: "/privacy", icon: Shield },
  { title: "Terms of Service", url: "/terms", icon: Scale },
]

// Context for mobile nav state
const MobileNavContext = React.createContext<{
  isOpen: boolean
  openMobileNav: () => void
  closeMobileNav: () => void
} | null>(null)

export function useMobileNav() {
  const context = React.useContext(MobileNavContext)
  if (!context) {
    throw new Error("useMobileNav must be used within MobileNavProvider")
  }
  return context
}

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const pathname = usePathname()
  const { setTheme, theme } = useTheme()

  const openMobileNav = React.useCallback(() => setIsOpen(true), [])
  const closeMobileNav = React.useCallback(() => setIsOpen(false), [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Mount check for portal
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Close menu on route change
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <MobileNavContext.Provider value={{ isOpen, openMobileNav, closeMobileNav }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
                onClick={closeMobileNav}
              />

              {/* Menu panel */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] bg-background border-r shadow-xl md:hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Pill className="size-4" />
                    </div>
                    <div className="grid text-left text-sm leading-tight">
                      <span className="font-semibold">RxWatch</span>
                      <span className="text-xs text-muted-foreground">Canada</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer"
                    onClick={closeMobileNav}
                  >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-3">Dashboard</p>
                    {navMain.map((item) => (
                      <Link
                        key={item.title}
                        href={item.url}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                          pathname === item.url
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </Link>
                    ))}
                  </div>

                  <div className="my-4 border-t" />

                  <div className="space-y-1">
                    {navSecondary.map((item) => (
                      <Link
                        key={item.title}
                        href={item.url}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                          pathname === item.url
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </Link>
                    ))}
                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Sun className="h-4 w-4 dark:hidden" />
                      <Moon className="h-4 w-4 hidden dark:block" />
                      <span className="dark:hidden">Light mode</span>
                      <span className="hidden dark:inline">Dark mode</span>
                    </button>
                  </div>
                </nav>

                {/* Footer warning */}
                <div className="p-4 border-t">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium">Not medical advice</p>
                        <p className="text-muted-foreground mt-1">
                          Always consult your pharmacist or doctor.{" "}
                          <a
                            href="https://www.drugshortagescanada.ca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-primary"
                          >
                            View official data
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </MobileNavContext.Provider>
  )
}

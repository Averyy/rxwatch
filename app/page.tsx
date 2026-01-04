import { AlertTriangle, Clock, TrendingDown, CheckCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Home() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Canadian Drug Shortage Intelligence
        </h1>
        <p className="text-muted-foreground">
          Watch your medications. Get alerted. Find alternatives.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Shortages
            </CardTitle>
            <div className="rounded-full bg-destructive/10 p-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive icon-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-number">1,703</div>
            <p className="text-xs text-muted-foreground">
              Currently in shortage
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Anticipated
            </CardTitle>
            <div className="rounded-full bg-yellow-500/10 p-1.5">
              <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-number">28</div>
            <p className="text-xs text-muted-foreground">
              Expected shortages
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              To Be Discontinued
            </CardTitle>
            <div className="rounded-full bg-orange-500/10 p-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-number">153</div>
            <p className="text-xs text-muted-foreground">
              Pending discontinuation
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Resolved (30d)
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-number">89</div>
            <p className="text-xs text-muted-foreground">
              Recently resolved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1 card-hover">
          <CardHeader>
            <CardTitle>Recent Shortage Reports</CardTitle>
            <CardDescription>
              Latest updates from Drug Shortages Canada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Placeholder items */}
              {[
                { name: "Metformin 500mg", status: "active_confirmed", company: "Apotex Inc." },
                { name: "Amoxicillin 250mg/5mL", status: "anticipated_shortage", company: "Teva Canada" },
                { name: "Lisinopril 10mg", status: "resolved", company: "Sandoz Canada" },
                { name: "Atorvastatin 20mg", status: "active_confirmed", company: "Pharmascience" },
                { name: "Omeprazole 20mg", status: "resolved", company: "Apotex Inc." },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.company}</p>
                  </div>
                  <Badge
                    className="badge-shine"
                    variant={
                      item.status === "active_confirmed" ? "destructive" :
                      item.status === "anticipated_shortage" ? "secondary" :
                      "outline"
                    }
                  >
                    {item.status === "active_confirmed" ? "Shortage" :
                     item.status === "anticipated_shortage" ? "Anticipated" :
                     "Resolved"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 card-hover">
          <CardHeader>
            <CardTitle>Recent Discontinuations</CardTitle>
            <CardDescription>
              Drugs being permanently removed from market
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Placeholder items */}
              {[
                { name: "Brand X 100mg", status: "to_be_discontinued", company: "Generic Corp" },
                { name: "Drug Y Injection", status: "discontinued", company: "Pharma Inc." },
                { name: "Med Z Cream", status: "reversed", company: "Health Co." },
                { name: "Tablet A 50mg", status: "to_be_discontinued", company: "MedCorp" },
                { name: "Capsule B 25mg", status: "discontinued", company: "RxPharm" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.company}</p>
                  </div>
                  <Badge
                    className="badge-shine"
                    variant={
                      item.status === "discontinued" ? "destructive" :
                      item.status === "to_be_discontinued" ? "secondary" :
                      "outline"
                    }
                  >
                    {item.status === "to_be_discontinued" ? "Pending" :
                     item.status === "discontinued" ? "Discontinued" :
                     "Reversed"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

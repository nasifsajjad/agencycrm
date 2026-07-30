"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  KanbanSquare,
  Briefcase,
  FolderKanban,
  ListChecks,
  Megaphone,
  FileText,
  FileCheck2,
  Clock,
  CalendarDays,
  DollarSign,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronsLeft,
  Plus,
  Command as CommandIcon,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/format";

export interface WorkspaceCtxLite {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  userId: string;
  membershipId: string;
  roles: string[];
  isOwner: boolean;
  permissions: string[];
}

export interface AppShellProps {
  ctx: WorkspaceCtxLite;
  user: { id: string; email: string; displayName?: string | null };
  workspaces: { id: string; name: string; slug: string }[];
  notifications: { id: string; type: string; title: string; body?: string | null; entityId?: string | null; entityType?: string | null }[];
  children: React.ReactNode;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  group: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard, group: "Overview" },
  { label: "My work", href: "/my-work", icon: ListChecks, group: "Overview" },
  { label: "Search", href: "/search", icon: Search, group: "Overview" },

  { label: "Leads", href: "/crm/leads", icon: UserCircle, permission: "crm.read", group: "CRM" },
  { label: "Contacts", href: "/crm/contacts", icon: Users, permission: "crm.read", group: "CRM" },
  { label: "Companies", href: "/crm/companies", icon: Building2, permission: "crm.read", group: "CRM" },
  { label: "Deals", href: "/crm/deals", icon: KanbanSquare, permission: "crm.read", group: "CRM" },
  { label: "Activities", href: "/crm/activities", icon: Clock, permission: "crm.read", group: "CRM" },

  { label: "Clients", href: "/clients", icon: Briefcase, permission: "clients.read", group: "Delivery" },
  { label: "Projects", href: "/projects", icon: FolderKanban, permission: "projects.read", group: "Delivery" },
  { label: "Tasks", href: "/tasks", icon: ListChecks, permission: "tasks.read", group: "Delivery" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, permission: "campaigns.read", group: "Delivery" },
  { label: "Approvals", href: "/approvals", icon: FileCheck2, permission: "approvals.read", group: "Delivery" },

  { label: "Time", href: "/time", icon: Clock, permission: "time.read_own", group: "Operations" },
  { label: "Capacity", href: "/capacity", icon: CalendarDays, permission: "time.read_all", group: "Operations" },
  { label: "Finance", href: "/finance", icon: DollarSign, permission: "finance.read", group: "Operations" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports.read", group: "Operations" },

  { label: "Settings", href: "/settings/general", icon: Settings, permission: "settings.read", group: "Admin" },
];

export function AppShell({ ctx, user, workspaces, notifications, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Keyboard shortcut for command palette
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const base = `/w/${ctx.workspaceSlug}`;
  const isActive = (href: string) => {
    const target = href === "" ? base : `${base}${href}`;
    if (href === "") return pathname === base;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const filteredNav = NAV.filter((n) => !n.permission || ctx.permissions.includes(n.permission) || ctx.isOwner);
  const groups = Array.from(new Set(filteredNav.map((n) => n.group)));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden border-r border-border/60 bg-sidebar text-sidebar-foreground md:flex md:flex-col",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <SidebarContent
          ctx={ctx}
          workspaces={workspaces}
          nav={filteredNav}
          groups={groups}
          collapsed={collapsed}
          isActive={isActive}
          onCollapse={() => setCollapsed((v) => !v)}
          onSwitchWorkspace={(slug) => router.push(`/w/${slug}`)}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent
            ctx={ctx}
            workspaces={workspaces}
            nav={filteredNav}
            groups={groups}
            collapsed={false}
            isActive={isActive}
            onCollapse={() => setMobileOpen(false)}
            onSwitchWorkspace={(slug) => {
              router.push(`/w/${slug}`);
              setMobileOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Breadcrumbs pathname={pathname} workspaceSlug={ctx.workspaceSlug} />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-flex">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`${base}/notifications`} aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
                    {notifications.length}
                  </span>
                )}
              </Link>
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{initials(user.displayName) || initials(user.email)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm sm:inline">{user.displayName ?? user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials(user.displayName) || initials(user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{user.displayName ?? "Account"}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`${base}/settings/general`}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app">
                    <UserIcon className="mr-2 h-4 w-4" /> Switch workspace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOutAction();
                  }}
                  className="text-danger"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Command palette */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        ctx={ctx}
        nav={filteredNav}
      />
    </div>
  );
}

function SidebarContent({
  ctx,
  workspaces,
  nav,
  groups,
  collapsed,
  isActive,
  onCollapse,
  onSwitchWorkspace,
}: {
  ctx: WorkspaceCtxLite;
  workspaces: { id: string; name: string; slug: string }[];
  nav: NavItem[];
  groups: string[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onCollapse: () => void;
  onSwitchWorkspace: (slug: string) => void;
}) {
  const base = `/w/${ctx.workspaceSlug}`;
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          {!collapsed && <span className="text-sm">AgencyOS</span>}
        </Link>
      </div>

      {/* Workspace switcher */}
      <div className={cn("p-2", collapsed && "px-1.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn("w-full justify-start gap-2 px-2", collapsed && "justify-center px-0")}>
              <span className="grid h-7 w-7 place-items-center rounded bg-foreground/5 text-xs font-medium">
                {ctx.workspaceName.slice(0, 2).toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium">{ctx.workspaceName}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{ctx.roles.join(", ") || "Member"}</div>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60" side="right">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => onSwitchWorkspace(w.slug)}>
                <span className="grid h-6 w-6 place-items-center rounded bg-foreground/5 text-[10px] font-medium">
                  {w.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{w.name}</span>
                {w.slug === ctx.workspaceSlug && <span className="ml-auto text-xs text-muted-foreground">•</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus className="mr-2 h-3.5 w-3.5" /> Create workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick create */}
      <div className={cn("px-2", collapsed && "px-1.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn("w-full gap-2", collapsed && "px-0")} size="sm">
              <Plus className="h-3.5 w-3.5" />
              {!collapsed && "Create"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" side="right">
            <DropdownMenuItem asChild>
              <Link href={`${base}/crm/contacts?new=1`}>
                <Users className="mr-2 h-4 w-4" /> New contact
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${base}/crm/deals?new=1`}>
                <KanbanSquare className="mr-2 h-4 w-4" /> New deal
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${base}/projects?new=1`}>
                <FolderKanban className="mr-2 h-4 w-4" /> New project
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${base}/tasks?new=1`}>
                <ListChecks className="mr-2 h-4 w-4" /> New task
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${base}/clients?new=1`}>
                <Briefcase className="mr-2 h-4 w-4" /> New client
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group}
              </div>
            )}
            <div className="space-y-0.5">
              {nav.filter((n) => n.group === group).map((item) => {
                const active = isActive(item.href);
                const href = item.href === "" ? base : `${base}${item.href}`;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border p-2", collapsed && "px-1.5")}>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start gap-2 text-muted-foreground", collapsed && "justify-center px-0")}
          onClick={onCollapse}
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </Button>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname, workspaceSlug }: { pathname: string; workspaceSlug: string }) {
  const segments = pathname.split("/").filter(Boolean);
  // remove "w" and workspaceSlug
  const idx = segments.indexOf("w");
  const crumbs = idx >= 0 ? segments.slice(idx + 2) : [];
  const labels: Record<string, string> = {
    "crm": "CRM",
    "leads": "Leads",
    "contacts": "Contacts",
    "companies": "Companies",
    "deals": "Deals",
    "activities": "Activities",
    "clients": "Clients",
    "projects": "Projects",
    "tasks": "Tasks",
    "campaigns": "Campaigns",
    "approvals": "Approvals",
    "time": "Time",
    "capacity": "Capacity",
    "finance": "Finance",
    "reports": "Reports",
    "settings": "Settings",
    "general": "General",
    "members": "Members",
    "teams": "Teams",
    "roles": "Roles",
    "audit": "Audit log",
    "customization": "Customization",
    "integrations": "Integrations",
    "import-export": "Import / Export",
    "notifications": "Notifications",
    "my-work": "My work",
    "search": "Search",
  };
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-hidden">
      <span className="font-medium text-foreground">{workspaceSlug}</span>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          <span className="text-muted-foreground/40">/</span>
          <span className={cn(i === crumbs.length - 1 && "text-foreground")}>{labels[c] ?? c}</span>
        </React.Fragment>
      ))}
    </nav>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  ctx,
  nav,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: WorkspaceCtxLite;
  nav: NavItem[];
}) {
  const router = useRouter();
  const base = `/w/${ctx.workspaceSlug}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search records or jump to…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {nav.map((item) => (
                <CommandItem
                  key={`${item.group}-${item.label}`}
                  value={`${item.label} ${item.group} navigate`}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(item.href === "" ? base : `${base}${item.href}`);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Quick actions">
              <CommandItem
                value="create contact"
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`${base}/crm/contacts?new=1`);
                }}
              >
                <Users className="mr-2 h-4 w-4" /> New contact
              </CommandItem>
              <CommandItem
                value="create deal"
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`${base}/crm/deals?new=1`);
                }}
              >
                <KanbanSquare className="mr-2 h-4 w-4" /> New deal
              </CommandItem>
              <CommandItem
                value="create project"
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`${base}/projects?new=1`);
                }}
              >
                <FolderKanban className="mr-2 h-4 w-4" /> New project
              </CommandItem>
              <CommandItem
                value="create task"
                onSelect={() => {
                  onOpenChange(false);
                  router.push(`${base}/tasks?new=1`);
                }}
              >
                <ListChecks className="mr-2 h-4 w-4" /> New task
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

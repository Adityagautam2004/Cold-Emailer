"use client";

import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  Send,
  Settings,
  FileText,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/require-user";
import { Dialog } from "@/components/ui/dialog";
import { Wordmark } from "@/components/logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-standard",
              active ? "bg-surface text-text" : "text-muted hover:bg-surface-hover hover:text-text"
            )}
          >
            {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
            <Icon size={16} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return <Wordmark size={22} />;
}

function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted transition-standard hover:bg-surface-hover hover:text-text"
    >
      <LogOut size={16} aria-hidden />
      Sign out
    </button>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: Pick<CurrentUser, "name" | "email">;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the drawer automatically on navigation rather than requiring the user to tap the
  // backdrop — the common expectation for a mobile nav drawer.
  useEffect(() => setMobileNavOpen(false), [pathname]);

  const currentLabel = NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label;

  return (
    <div className="flex min-h-screen bg-ink text-text">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line md:flex">
        <div className="border-b border-line px-5 py-5">
          <BrandMark />
        </div>
        <SidebarNav pathname={pathname} />
        <div className="border-t border-line px-3 py-4">
          <SignOutButton />
        </div>
      </aside>

      <Dialog
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[80vw] rounded-none rounded-r-xl"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-5 py-5">
            <BrandMark />
          </div>
          <SidebarNav pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          <div className="border-t border-line px-3 py-4">
            <SignOutButton />
          </div>
        </div>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 rounded-md p-1.5 text-muted transition-standard hover:bg-surface hover:text-text md:hidden"
          >
            <Menu size={20} aria-hidden />
          </button>
          <span className="truncate text-sm font-medium text-text md:hidden">{currentLabel ?? "Dispatch"}</span>
          <span className="hidden truncate text-sm font-medium text-text md:block">{currentLabel}</span>
          <span className="ml-auto shrink-0 truncate font-mono text-xs text-muted">{user.email}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

"use client";

import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Send,
  Settings,
  FileText,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/require-user";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  user,
  children,
}: {
  user: Pick<CurrentUser, "name" | "email">;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-ink text-text">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line">
        <div className="border-b border-line px-5 py-5">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold">Dispatch</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-standard",
                  active ? "bg-surface text-text" : "text-muted hover:bg-surface hover:text-text"
                )}
              >
                <Icon size={16} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-3 py-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted transition-standard hover:bg-surface hover:text-text"
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-line px-6">
          <span className="font-mono text-xs text-muted">{user.email}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}

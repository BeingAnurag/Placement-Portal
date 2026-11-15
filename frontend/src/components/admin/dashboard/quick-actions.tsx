import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  ClipboardCheck,
  FileCheck2,
  Megaphone,
  Plus,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuickActionKey } from "./types";

const ACTIONS: Record<QuickActionKey, { label: string; href: string; icon: React.ComponentType }> = {
  "record-placement": { label: "Record placements", href: "/admin/placement-records/add", icon: Trophy },
  "add-event": { label: "Add event", href: "/admin/events/add", icon: Plus },
  announce: { label: "Announcement", href: "/admin/announcements/company-event", icon: Megaphone },
  "add-company": { label: "Add company", href: "/admin/companies/add", icon: Building2 },
  calendar: { label: "Calendar", href: "/admin/calendar", icon: CalendarPlus },
  "review-nocs": { label: "Review NOCs", href: "/admin/noc-requests", icon: FileCheck2 },
  "review-applications": { label: "Applications", href: "/admin/applications", icon: ClipboardCheck },
};

/**
 * Shortcuts to the screens the office opens most. Only the ones the viewer's
 * permissions allow are rendered: the destination screens enforce their own
 * access, so this is about not offering a link that bounces.
 */
export function QuickActions({ actions }: { actions: QuickActionKey[] }) {
  if (!actions.length) return null;

  return (
    <nav className="dash-actions" aria-label="Quick actions">
      {actions.map((key, index) => {
        const { label, href, icon: Icon } = ACTIONS[key];
        return (
          <Button key={key} asChild size="sm" variant={index === 0 ? "default" : "outline"}>
            <Link href={href}>
              <Icon />
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

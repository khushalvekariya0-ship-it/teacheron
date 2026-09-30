import {
  Bell, BookOpen, Briefcase, CalendarDays, ClipboardList, Coins, CreditCard, FileCheck2, Flag, Gavel, Heart, Home, Inbox,
  LayoutDashboard, LineChart, MessagesSquare, NotebookPen, Receipt, ScrollText, Search, Settings,
  ShieldCheck, SlidersHorizontal, Star, Tag, ToggleLeft, UserRound, Users, Wallet, BadgeCheck, Clock, Bookmark, Newspaper,
  MapPin,
} from "lucide-react";
import type * as React from "react";
import type { Permission, Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "messages" | "notifications";
  /** Admin area: item only shown when the user has this permission. */
  permission?: Permission;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const learnerCommon = {
  main: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Find tutors", href: "/tutors", icon: Search },
    { label: "My requirements", href: "/dashboard/requirements", icon: ClipboardList },
    { label: "Messages", href: "/dashboard/messages", icon: MessagesSquare, badge: "messages" as const },
  ],
  lessons: [
    { label: "Bookings", href: "/dashboard/bookings", icon: BookOpen },
    { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
    { label: "Learning progress", href: "/dashboard/progress", icon: LineChart },
    { label: "Homework", href: "/dashboard/homework", icon: NotebookPen },
  ],
  saved: [
    { label: "Favorites", href: "/dashboard/favorites", icon: Heart },
    { label: "Saved searches", href: "/dashboard/saved-searches", icon: Bookmark },
  ],
  account: [
    { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
    { label: "Reviews", href: "/dashboard/reviews", icon: Star },
    { label: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: "notifications" as const },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ],
};

export const NAV_BY_ROLE: Record<Extract<Role, "student" | "parent" | "tutor">, NavSection[]> = {
  student: [
    { items: learnerCommon.main },
    { title: "Lessons", items: learnerCommon.lessons },
    { title: "Saved", items: learnerCommon.saved },
    { title: "Account", items: learnerCommon.account },
  ],
  parent: [
    { items: learnerCommon.main },
    { title: "Family", items: [{ label: "Children", href: "/dashboard/children", icon: Users }] },
    { title: "Lessons", items: learnerCommon.lessons },
    { title: "Saved", items: learnerCommon.saved },
    { title: "Account", items: learnerCommon.account },
  ],
  tutor: [
    {
      items: [
        { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
        { label: "My profile", href: "/dashboard/profile", icon: UserRound },
        { label: "Messages", href: "/dashboard/messages", icon: MessagesSquare, badge: "messages" },
      ],
    },
    {
      title: "Find work",
      items: [
        { label: "Student jobs", href: "/dashboard/jobs", icon: Briefcase },
        { label: "My applications", href: "/dashboard/applications", icon: Inbox },
        { label: "Saved searches", href: "/dashboard/saved-searches", icon: Bookmark },
      ],
    },
    {
      title: "Teaching",
      items: [
        { label: "Bookings", href: "/dashboard/bookings", icon: BookOpen },
        { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { label: "Availability", href: "/dashboard/availability", icon: Clock },
        { label: "Students & progress", href: "/dashboard/progress", icon: LineChart },
        { label: "Homework", href: "/dashboard/homework", icon: NotebookPen },
        { label: "Reviews", href: "/dashboard/reviews", icon: Star },
      ],
    },
    {
      title: "Business",
      items: [
        { label: "Earnings", href: "/dashboard/earnings", icon: Wallet },
        { label: "Subscription", href: "/dashboard/subscription", icon: Tag },
        { label: "Lead credits", href: "/dashboard/credits", icon: Coins },
        { label: "Verification", href: "/dashboard/verification", icon: BadgeCheck },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: "notifications" },
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ],
    },
  ],
};

export const ADMIN_NAV: NavSection[] = [
  { items: [{ label: "Overview", href: "/admin", icon: Home }] },
  {
    title: "People",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, permission: "users.read" },
      { label: "Tutors", href: "/admin/tutors", icon: UserRound, permission: "users.read" },
      { label: "Verification", href: "/admin/verification", icon: FileCheck2, permission: "tutors.verify" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { label: "Requirements", href: "/admin/requirements", icon: ClipboardList, permission: "users.read" },
      { label: "Bookings", href: "/admin/bookings", icon: BookOpen, permission: "bookings.manage" },
      { label: "Catalog", href: "/admin/catalog", icon: MapPin, permission: "content.manage" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Payments & payouts", href: "/admin/payments", icon: Receipt, permission: "payments.read" },
      { label: "Plans & credits", href: "/admin/monetization", icon: Coins, permission: "settings.manage" },
      { label: "Coupons & promotions", href: "/admin/promotions", icon: Tag, permission: "settings.manage" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { label: "Disputes", href: "/admin/disputes", icon: Gavel, permission: "disputes.manage" },
      { label: "Reports", href: "/admin/reports", icon: Flag, permission: "reports.moderate" },
      { label: "Reviews", href: "/admin/reviews", icon: Star, permission: "reports.moderate" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Content & SEO", href: "/admin/content", icon: Newspaper, permission: "content.manage" },
      { label: "Feature flags", href: "/admin/feature-flags", icon: ToggleLeft, permission: "flags.manage" },
      { label: "Settings", href: "/admin/settings", icon: SlidersHorizontal, permission: "settings.manage" },
      { label: "Security", href: "/admin/security", icon: ShieldCheck },
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText, permission: "audit.read" },
    ],
  },
];

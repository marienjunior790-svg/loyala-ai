import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Gift,
  Star,
  BarChart3,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export const mainNav: NavItem[] = [
  {
    label: 'Vue générale',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'KPIs et activité récente',
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Users,
    description: 'CRM et segmentation',
  },
  {
    label: 'Campagnes WhatsApp',
    href: '/campaigns',
    icon: MessageCircle,
    description: 'Messages et automations',
  },
  {
    label: 'Fidélité',
    href: '/loyalty',
    icon: Gift,
    description: 'Points et récompenses',
  },
  {
    label: 'Avis Google',
    href: '/reviews',
    icon: Star,
    description: 'Réputation en ligne',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Rapports et tendances',
  },
  {
    label: 'Paramètres',
    href: '/settings',
    icon: Settings,
    description: 'Organisation et équipe',
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

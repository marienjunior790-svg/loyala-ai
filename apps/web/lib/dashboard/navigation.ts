import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  PieChart,
  MessageCircle,
  Send,
  Gift,
  Star,
  Package,
  BarChart3,
  Bell,
  CreditCard,
  Shield,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  mobile?: boolean;
}

export const mainNav: NavItem[] = [
  { label: 'Vue générale', href: '/dashboard', icon: LayoutDashboard, description: 'KPIs et activité', mobile: true },
  { label: 'Clients', href: '/clients', icon: Users, description: 'CRM contacts', mobile: true },
  { label: 'Catalogue', href: '/catalogue', icon: Package, description: 'Produits et services', mobile: false },
  { label: 'Segments', href: '/segments', icon: PieChart, description: 'Répartition clients', mobile: false },
  { label: 'Relances', href: '/relances', icon: Send, description: 'Historique WhatsApp', mobile: true },
  { label: 'Campagnes', href: '/campaigns', icon: MessageCircle, description: 'Automations IA', mobile: true },
  { label: 'Fidélité', href: '/loyalty', icon: Gift, description: 'Points et récompenses', mobile: false },
  { label: 'Avis Google', href: '/reviews', icon: Star, description: 'Réputation', mobile: false },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, description: 'Rapports', mobile: false },
  { label: 'Notifications', href: '/notifications', icon: Bell, description: 'Alertes', mobile: false },
  { label: 'Paiement', href: '/billing', icon: CreditCard, description: 'Abonnement', mobile: false },
  { label: 'Administration', href: '/administration', icon: Shield, description: 'Équipe et org', mobile: false },
  { label: 'Paramètres', href: '/settings', icon: Settings, description: 'Configuration', mobile: true },
];

export const mobileNav = mainNav.filter((item) => item.mobile);

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

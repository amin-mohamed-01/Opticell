'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Wrench,
  Database,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useState } from 'react';


const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/reports',   label: 'Reports',   icon: FileText },
  { href: '/settings',  label: 'Settings',  icon: Settings },
  { href: '/help',      label: 'Help',      icon: HelpCircle },
];

const engineerSubItems = [
  { href: '/engineer-report/maintenance',      label: 'Maintenance Report',      icon: Wrench },
  { href: '/engineer-report/maintenance-data', label: 'Maintenance Report Data', icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();

  // Open the Engineer Report submenu automatically if we're on one of its pages
  const isEngineerActive = engineerSubItems.some((s) => pathname === s.href);
  const [engineerOpen, setEngineerOpen] = useState(isEngineerActive);


  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="p-6 border-b border-gray-200 flex items-center gap-3">
        <img src="/logo.png" alt="Opticell Logo" className="w-8 h-8 object-contain" />
        <h1 className="text-2xl font-bold text-gray-900">Opticell</h1>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {/* Regular nav items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all',
                  isActive
                    ? 'bg-blue-100 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* Engineer Report — collapsible group */}
        <div>
          <button
            onClick={() => setEngineerOpen((prev) => !prev)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all',
              isEngineerActive
                ? 'bg-blue-100 text-blue-600 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <ClipboardList className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Engineer Report</span>
            {engineerOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
          </button>

          {/* Sub-items */}
          {engineerOpen && (
            <div className="ml-4 border-l-2 border-blue-100 pl-2">
              {engineerSubItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = pathname === sub.href;
                return (
                  <Link key={sub.href} href={sub.href}>
                    <div
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 mb-1 rounded-lg transition-all text-sm',
                        isSubActive
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <SubIcon className="w-4 h-4 shrink-0" />
                      <span>{sub.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200">
        {user ? (
          <Link href="/profile" className="flex items-center gap-3 mb-3 rounded-lg p-2 hover:bg-gray-50 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold">
              {(() => {
                const name = profile?.name || user.displayName || 'User';
                const initials = name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return initials;
              })()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile?.name || user.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-gray-500">Not signed in</p>
        )}

        {user && (
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
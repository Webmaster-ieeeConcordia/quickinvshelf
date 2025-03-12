import { useFetcher } from "@remix-run/react";
import { Button } from "~/components/shared/button";
import { SidebarNav } from "./sidebar-nav"; // Make sure this import is present

// Types
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function Sidebar({ collapsed, onToggle, children }: SidebarProps) {
  const fetcher = useFetcher();
  
  // Existing code...

  return (
    <div
      className={`fixed inset-y-0 left-0 z-10 flex flex-col border-r border-gray-200 bg-white transition-all md:relative ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header/Logo section */}
      <div className="flex h-[--header-height] items-center border-b border-gray-200 px-3">
        {/* Logo and toggle button */}
        {/* Keep existing header code */}
      </div>

      {/* Main sidebar content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* If children are provided (like our SidebarNav), render them */}
        {children || <SidebarNav collapsed={collapsed} />}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        {/* Existing footer content */}
      </div>
    </div>
  );
}

import { Fragment } from "react";
import { Link, useLocation } from "@remix-run/react";
import { 
  AssetsIcon, 
  // Import other icons as before
  SwitchIcon as DashboardIcon,
  KitIcon, 
  SettingsIcon, 
  CategoriesIcon,
  TagsIcon,
  AssetLabel
} from "~/components/icons/library";
// Import BookingsIcon separately and wrap it to accept className
import { CalendarPlus } from "lucide-react";
import type { SVGProps } from "react";
import { tw } from "~/utils/tw";

// Create BookingsIcon component that properly accepts className
const BookingsIcon = (props: SVGProps<SVGSVGElement>) => {
  return <CalendarPlus {...props} />;
};

// DiscordLogoIcon definition remains the same
const DiscordLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 127.14 96.36"
      fill="currentColor"
      {...props}
    >
      <path 
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
      />
    </svg>
  );
};

// Import types as needed
import type { FC } from "react";

// Define navigation item type
interface NavigationItem {
  to: string;
  label: string;
  icon?: JSX.Element;
}

// Create a simple hook to replace the missing use-root-loader-data
const useRootLoaderData = () => {
  const location = useLocation();
  
  // Default navigation structure
  const defaultNavigation: NavigationItem[][] = [
    [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/assets", label: "Assets" },
      { to: "/bookings", label: "Bookings" },
      { to: "/kits", label: "Kits" },
      { to: "/categories", label: "Categories" },
      { to: "/tags", label: "Tags" },
      { to: "/labels", label: "Asset Labels" },
      { to: "/settings", label: "Settings" },
    ]
  ];

  return {
    navigation: defaultNavigation,
    currentPath: location.pathname
  };
};

// Add this constant for the Discord login link
const DISCORD_OAUTH_URL = "/auth/discord";

export const SidebarNav: FC<{
  collapsed: boolean;
}> = ({ collapsed }) => {
  const { navigation, currentPath } = useRootLoaderData();

  return (
    <nav className="flex flex-col gap-1 mt-9">
      {navigation.map((section: NavigationItem[], index: number) => (
        <Fragment key={index}>
          {section.map((item: NavigationItem) => {
            const isActive = currentPath === item.to;
            
            // Render Discord login button above Asset Labels
            if (item.label === "Asset Labels") {
              return (
                <div key={item.to} className="flex flex-col gap-1">
                  {/* Discord Login Button - displayed above Asset Labels */}
                  <a 
                    href={DISCORD_OAUTH_URL}
                    className={tw(
                      "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                      collapsed ? "justify-center" : "",
                      "text-white bg-[#5865F2] hover:bg-[#4752C4]"
                    )}
                    title="Login with Discord"
                  >
                    <div className="flex w-5 items-center justify-center">
                      <DiscordLogoIcon className="h-4 w-4 text-white" />
                    </div>
                    {!collapsed && <span>Login with Discord</span>}
                  </a>
                  
                  {/* Asset Labels navigation item */}
                  <Link
                    to={item.to}
                    className={tw(
                      "group flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex w-5 items-center justify-center">
                      <AssetLabel className="h-5 w-5" />
                    </div>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </div>
              );
            }
            
            // Regular navigation items
            return (
              <Link
                key={item.to}
                to={item.to}
                className={tw(
                  "group flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <div className="flex w-5 items-center justify-center">
                  {item.icon ? (
                    item.icon
                  ) : item.label === "Dashboard" ? (
                    <DashboardIcon className="h-5 w-5" />
                  ) : item.label === "Assets" ? (
                    <AssetsIcon className="h-5 w-5" />
                  ) : item.label === "Bookings" ? (
                    <BookingsIcon className="h-5 w-5" />
                  ) : item.label === "Kits" ? (
                    <KitIcon className="h-5 w-5" />
                  ) : item.label === "Settings" ? (
                    <SettingsIcon className="h-5 w-5" />
                  ) : item.label === "Categories" ? (
                    <CategoriesIcon className="h-5 w-5" />
                  ) : item.label === "Tags" ? (
                    <TagsIcon className="h-5 w-5" />
                  ) : null}
                </div>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
};

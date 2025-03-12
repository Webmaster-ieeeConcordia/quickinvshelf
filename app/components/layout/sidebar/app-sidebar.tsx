import { ShelfSidebarLogo } from "~/components/marketing/logos";
import { useSidebarNavItems } from "~/hooks/use-sidebar-nav-items";
import { SidebarNoticeCard } from "./notice-card";
import OrganizationSelector from "./organization-selector";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "./sidebar";
import SidebarNav from "./sidebar-nav";
import SidebarUserMenu from "./sidebar-user-menu";
import { useContext } from "react";
import { Link, useLoaderData } from "@remix-run/react";
import { DiscordLogoIcon } from "~/components/icons/library";
import { DISCORD_OAUTH_URL } from "~/routes/auth/discord/constants";

type AppSidebarProps = React.ComponentProps<typeof Sidebar>;

// Simple hook to replace the missing use-root-loader-data
const useRootLoaderData = () => {
  // Use a standard loader data hook
  const data: any = useLoaderData();
  
  return {
    user: data?.user,
    // Check if the user ID starts with "guest-" to determine if it's a guest
    isGuest: data?.user?.id?.startsWith('guest-') || false
  };
};

export default function AppSidebar(props: AppSidebarProps) {
  const { state } = useSidebar();
  const { topMenuItems, bottomMenuItems } = useSidebarNavItems();
  const { user, isGuest } = useRootLoaderData();
  
  // Use the state from useSidebar instead of accessing collapsed from context
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={isCollapsed ? "px-0" : ""}>
        <div className="my-2 flex items-center">
          <ShelfSidebarLogo minimized={isCollapsed} />
        </div>

        <OrganizationSelector />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav items={topMenuItems} />
        {isGuest && (
          <a 
            href={DISCORD_OAUTH_URL}
            className={`mt-4 mx-3 flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752C4] ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Login with Discord"
          >
            <div className="flex w-5 items-center justify-center">
              <DiscordLogoIcon className="h-4 w-4 text-white" />
            </div>
            {!isCollapsed && <span>Login with Discord</span>}
          </a>
        )}
      </SidebarContent>

      <SidebarFooter>
        {state !== "collapsed" && <SidebarNoticeCard />}
        <SidebarNav className="p-0" items={bottomMenuItems} />
        <SidebarUserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

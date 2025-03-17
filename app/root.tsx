import { useEffect, useState } from "react";
import type { User } from "@prisma/client";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { withSentry } from "@sentry/remix";
import nProgressStyles from "nprogress/nprogress.css?url";
import { ErrorContent } from "./components/errors";
import BlockInteractions from "./components/layout/maintenance-mode";
import { SidebarTrigger } from "./components/layout/sidebar/sidebar";
import { Clarity } from "./components/marketing/clarity";
import { config } from "./config/shelf.config";
import { useNprogress } from "./hooks/use-nprogress";
import fontsStylesheetUrl from "./styles/fonts.css?url";
import globalStylesheetUrl from "./styles/global.css?url";
import nProgressCustomStyles from "./styles/nprogress.css?url";
import styles from "./tailwind.css?url";
import { ClientHintCheck, getClientHint } from "./utils/client-hints";
import { getBrowserEnv } from "./utils/env";
import { data } from "./utils/http.server";
import { useNonce } from "./utils/nonce-provider";
import { PwaManagerProvider } from "./utils/pwa-manager";
import { splashScreenLinks } from "./utils/splash-screen-links";
import { Toaster } from "~/components/shared/toast";
import { createGuestSession } from "~/modules/auth/service.server";
import { setSelectedOrganizationIdCookie } from "~/modules/organization/context.server";
import { setCookie } from "~/utils/cookies.server";
import { db } from "~/database/db.server";
import { makeShelfError } from "~/utils/error";
import { OAuthFragmentHandler } from "~/components/auth/OAuthFragment";



export interface RootData {
  env: typeof getBrowserEnv;
  user: User;
}

export const handle = {
  breadcrumb: () => <SidebarTrigger />,
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: fontsStylesheetUrl },
  { rel: "stylesheet", href: globalStylesheetUrl },
  { rel: "manifest", href: "/static/manifest.json" },
  { rel: "apple-touch-icon", href: config.faviconPath },
  { rel: "icon", href: config.faviconPath },
  { rel: "stylesheet", href: nProgressStyles },
  { rel: "stylesheet", href: nProgressCustomStyles },
  ...splashScreenLinks,
];

export const meta: MetaFunction = () => [
  {
    title: "ieeeconcordia",
  },
];

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const referer = request.headers.get('Referer') || '';
    const isReturningFromAuth = (referer.includes('/oauth/callback') || 
                               url.searchParams.has('auth'));
    
    // Skip guest session creation entirely if coming from OAuth flow
    if (isReturningFromAuth) {
      try {
        const session = context.getSession();
        return json(data({ 
          isGuest: session.userId?.startsWith('guest-') || false,
          maintenanceMode: false, 
          env: getBrowserEnv() 
        }));
      } catch (error) {
        console.error("[DEBUG] Error getting session after auth:", error);
        return json(data({ 
          isGuest: false,
          authError: "Authentication error. Please try again.",
          maintenanceMode: false, 
          env: getBrowserEnv() 
        }));
      }
    }
    if (!context.isAuthenticated) {
      const guestSession = await createGuestSession();
      if (guestSession) {
        context.setSession({
          ...guestSession,
          accessToken: guestSession.accessToken || "defaultAccessToken",
          refreshToken: guestSession.refreshToken || "defaultRefreshToken",
        });
        const guestUser = await db.user.findUnique({
          where: { id: guestSession.userId },
          include: { organizations: true }
        });
        const orgId = guestUser?.organizations[0]?.id;
        return json(
          data({ 
            isGuest: true,
            maintenanceMode: false,
            env: getBrowserEnv()
          }), 
          { headers: [setCookie(await setSelectedOrganizationIdCookie(orgId || ""))] }
        );
      } else {
        // DB unreachable: return guest info without session creation
        console.error("Guest session creation failed; proceeding as guest with limited features.");
        return json(
          data({
            maintenanceMode: false,
            guestError: "Could not create a guest session. Please login to get full access.",
            env: getBrowserEnv()
          })
        );
      }
    }

    try {
      // Attempt to get user data
      return json(data({ 
        isGuest: false, 
        maintenanceMode: false, 
        env: getBrowserEnv() 
      }));
    } catch (userError) {
      // If user data can't be found, create a new guest session
      const newGuestSession = await createGuestSession();
      if (newGuestSession) {
        context.setSession({
          ...newGuestSession,
          accessToken: newGuestSession.accessToken || "defaultAccessToken",
          refreshToken: newGuestSession.refreshToken || "defaultRefreshToken",
        });
        return json(data({ 
          isGuest: true,
          maintenanceMode: false,
          env: getBrowserEnv()
        }));
      }
    }

    // If all else fails, return error
    throw new Error("Could not create guest session or find user data");

  } catch (cause) {
    const reason = makeShelfError(cause, { userId: context.getSession().userId });
    throw json(Error(reason.message), { status: reason.status });
  }
};

export const shouldRevalidate = () => false;

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const nonce = useNonce();
  const [hasCookies, setHasCookies] = useState(true);

  useEffect(() => {
    setHasCookies(navigator.cookieEnabled);
  }, []);

  return (
    <html lang="en" className="overflow-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <ClientHintCheck nonce={nonce} />
        <style data-fullcalendar />
        <Meta />
        <Links />
        <Clarity />
      </head>
      <body>
        <noscript>
          <BlockInteractions
        title="JavaScript is disabled"
        content="This website requires JavaScript to be enabled to function properly. Please enable JavaScript or change browser and try again."
        icon="x"
          />
        </noscript>

        {hasCookies ? (
          children
        ) : (
          <BlockInteractions
        title="Cookies are disabled"
        content="This website requires cookies to be enabled to function properly. Please enable cookies and try again."
        icon="x"
          />
        )}

        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
        __html: `window.env = ${JSON.stringify(getBrowserEnv())}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

function App() {
  useNprogress();
  const { maintenanceMode } = useLoaderData<typeof loader>();

  return maintenanceMode ? (
    <BlockInteractions
      title={"Maintenance is being performed"}
      content={
        "Apologies, we're down for scheduled maintenance. Please try again later."
      }
      cta={{
        to: "https://www.shelf.nu/blog-categories/updates-maintenance",
        text: "Learn more",
      }}
      icon="tool"
    />
  ) : (
    <>
      <OAuthFragmentHandler />
      <PwaManagerProvider>
        <div>
          <Outlet />
          <Toaster />
        </div>
      </PwaManagerProvider>
    </>
  );
}

export default withSentry(App);

export const ErrorBoundary = () => <ErrorContent />;

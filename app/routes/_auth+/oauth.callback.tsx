import { useEffect, useState } from "react";
import { OrganizationType } from "@prisma/client";
import type { User } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { db } from "~/database/db.server"; // Ensure db is correctly imported for manual database updates
import { getOAuthSession } from "~/modules/auth/service.server";
import { setSelectedOrganizationIdCookie } from "~/modules/organization/context.server";
import { getOrganizationByUserId, createOrganization } from "~/modules/organization/service.server";
import { createUser, findUserByEmail, getUserByID } from "~/modules/user/service.server";
import { setCookie } from "~/utils/cookies.server";
import { ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";
import { randomUsernameFromEmail } from "~/utils/user";

type OAuthCallbackResponse = {
  redirectTo?: string;
  error?: { message: string };
};

export const loader: LoaderFunction = async ({ context }) => {
  if (context.isAuthenticated) {
    return redirect("/assets");
  }
  return null;
};

// oauth callback action
export const action: ActionFunction = async ({ request, context }) => {
  try {
    const body = await request.formData();
    const access_token = body.get("access_token")?.toString();
    const refresh_token = body.get("refresh_token")?.toString();
    const expires_in = parseInt(body.get("expires_in")?.toString() || "0", 10);
    const expires_at = body.get("expires_at")?.toString();

    if (!access_token || !refresh_token || isNaN(expires_in)) {
      throw new ShelfError({
        cause: new Error("Missing or invalid OAuth parameters."),
        message: "Invalid OAuth response",
        label: "OAuthCallback",
        status: 400,
      });
    }

    const authSession = await getOAuthSession({
      access_token,
      refresh_token,
      expires_in,
      expires_at: expires_at ? parseInt(expires_at, 10) : undefined,
    });

    if (!authSession.user?.email || !authSession.user?.user_metadata?.sub) {
      throw new ShelfError({
        cause: new Error("Missing user data in auth session"),
        message: "Unable to retrieve user information",
        label: "OAuthCallback",
        status: 400,
      });
    }

    const discordUserId = authSession.user.user_metadata.sub;
    const discordToken = access_token;

    // Check if user has exec role
    const hasExecRole = await checkDiscordExecRole(discordToken);
    if (!hasExecRole) {
      throw new ShelfError({
        cause: new Error("User does not have required Discord role"),
        message: "You must be an IEEE Concordia exec to access this application",
        label: "OAuthCallback", 
        status: 403
      });
    }

    let user = await findUserByEmail(authSession.user.email);

    if (!user) {
      user = await createUser({
        userId: discordUserId,
        email: authSession.user.email,
        username: randomUsernameFromEmail(authSession.user.email),
        firstName: authSession.user_metadata.global_name || authSession.user_metadata.name || authSession.user.email.split('@')[0],
        lastName: null,
        isSSO: true,
        createdWithInvite: false,
      });

      // Set the user's tier to tier_2 in the database
      await db.user.update({
        where: { id: user.id },
        data: { tierId: "tier_2" }, // Replace "tier_2" with the actual ID for tier_2 in your database
      });
    }

    // Set session
    await context.setSession({
      accessToken: access_token,
      refreshToken: refresh_token, // refreshtoken
      expiresIn: expires_in,
      expiresAt: expires_at ? parseInt(expires_at, 10) : Date.now() + expires_in * 1000,
      userId: discordUserId,
      email: authSession.user.email,
    });

    // Get or create organization
    let organization;
    try {
      organization = await getOrganizationByUserId({
        userId: discordUserId,  
        orgType: OrganizationType.TEAM, // Changed from PERSONAL to TEAM to match createOrganization
      });
    } catch (error) {
      // If organization not found, create it
      organization = await createOrganization({
        name: `${user.firstName || authSession.user.email.split("@")[0]}'s Workspace`,
        userId: discordUserId, // Using Discord ID directly
        currency: "USD",
        image: null,
      });
    }

    // Set organization cookie
    const organizationCookie = await setSelectedOrganizationIdCookie(organization.id);

    // Redirect to assets page
    return redirect("/assets", {
      headers: [setCookie(organizationCookie)],
    });
  } catch (cause) {
    Logger.error({
      cause,
      message: "Error handling OAuth callback",
      label: "OAuthCallback",
    });

    return json(
      { error: { message: "Authentication failed. Please try again." } },
      { status: cause instanceof ShelfError ? cause.status : 500 }
    );
  }
};

async function checkDiscordExecRole(accessToken: string): Promise<boolean> {
  try {
    // Get user's Discord guild member info
    const guildId = process.env.DISCORD_GUILD_ID; // Add to .env
    const response = await fetch(
      `https://discord.com/api/users/@me/guilds/${guildId}/member`, 
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Discord roles');
    }

    const data = await response.json();
    return data.roles.includes("1239606005889761412"); // Exec role ID
  } catch (error) {
    console.error("Discord role check failed:", error);
    return false;
  }
}

export default function OAuthCallbackPage() {
  const fetcher = useFetcher<OAuthCallbackResponse>();
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (!hasSubmitted) {
      const fragment = window.location.hash.substring(1);
      const params = new URLSearchParams(fragment);

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = params.get("expires_in");
      const expiresAt = params.get("expires_at");

      if (!accessToken || !refreshToken || !expiresIn) {
        setError("Missing required OAuth parameters");
        return;
      }

      const formData = new FormData();
      formData.append("access_token", accessToken);
      formData.append("refresh_token", refreshToken);
      formData.append("expires_in", expiresIn);
      if (expiresAt) {
        formData.append("expires_at", expiresAt);
      }

      fetcher.submit(formData, { method: "POST" });
      setHasSubmitted(true);
    }
  }, [hasSubmitted, fetcher]);

  useEffect(() => {
    if (fetcher.data?.redirectTo) {
      window.location.href = fetcher.data.redirectTo;
    } else if (fetcher.data?.error) {
      setError(fetcher.data.error.message);
    }
  }, [fetcher.data]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      {error ? (
        <>
          <h1 className="text-lg font-semibold text-red-600">Login Error</h1>
          <p className="mt-2 text-sm text-red-500">{error}</p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Return to Login
          </button>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold">Completing Login...</h1>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we complete your login.
          </p>
        </>
      )}
    </div>
  );
}
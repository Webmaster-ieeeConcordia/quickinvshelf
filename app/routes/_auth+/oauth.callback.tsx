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

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

interface DiscordGuildMember {
  user?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  nick?: string | null;
  roles: string[];
  joined_at: string;
}
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
    const hasExecRole = await checkDiscordExecRole(discordToken, discordUserId);
    /*if (!hasExecRole) {
      // not an exec so instead create account with tier 1
      
      throw new ShelfError({
        cause: new Error("User does not have required Discord role"),
        message: "You must be an IEEE Concordia exec to access this application",
        label: "OAuthCallback", 
        status: 403
      });
    }*/

// Replace starting from the discordUserId section through the organization portion



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

      // Set tier based on exec status
      await db.user.update({
        where: { id: user.id },
        data: {
          tierId: hasExecRole ? "tier_2" : "tier_1" 
        },
      });
    }
    else {
      // If user already exists, update their tier based on exec status
      await db.user.update({
        where: { id: user.id },
        data: { 
          tierId: hasExecRole ? "tier_2" : "tier_1" 
        },
      });
    }

    // Set session
    await context.setSession({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      expiresAt: expires_at ? parseInt(expires_at, 10) : Date.now() + expires_in * 1000,
      userId: user.id,
      email: authSession.user.email,
    });

    // Use the IEEE organization ID
    const ieeeOrgId = "cm6svb7av000dyozubn2k033i";

    // First check if organization exists
    let organization = await db.organization.findUnique({
      where: { id: ieeeOrgId },
      select: { id: true, name: true, type: true }
    });

    if (!organization) {
      // Fall back to user's organization if IEEE org doesn't exist
      try {
        organization = await getOrganizationByUserId({
          userId: user.id,
          orgType: OrganizationType.TEAM,
        });
      } catch (error) {
        // Create personal organization if no organizations are found
        organization = await createOrganization({
          name: `${user.firstName || authSession.user.email.split("@")[0]}'s Workspace`,
          userId: user.id,
          currency: "USD",
          image: null,
        });
      }
    } else {
      // IEEE organization exists, make sure user has appropriate access
      
      // Check if user already has a relationship with organization
      const userOrg = await db.userOrganization.findFirst({
        where: {
          userId: user.id,
          organizationId: ieeeOrgId
        }
      });
      
      // If no relationship exists, create one with appropriate role
      if (!userOrg) {
        
        await db.userOrganization.create({
          data: {
            userId: user.id,
            organizationId: ieeeOrgId,
            // Set role based on exec status - using the proper enum from Prisma
            roles: hasExecRole ? ["ADMIN"] : ["BASE"]
          }
        });
      } else {
        // Update roles if needed - this ensures the user has the correct role
        
        const desiredRole = hasExecRole ? "ADMIN" : "BASE";
        if (!userOrg.roles.includes(desiredRole)) {
          await db.userOrganization.update({
            where: { id: userOrg.id },
            data: { 
              roles: hasExecRole ? ["ADMIN"] : ["BASE"] 
            }
          });
        }
      }
    }

    // Redirect to assets page
    return redirect("/assets?auth=true", {
      headers: [
        setCookie(await setSelectedOrganizationIdCookie(organization.id)),
      ],
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



// my fault gang
const APPROVED_EXEC_IDS = [
  "349671812512219136", // nicho
  "470769044002439169", // alex
  "752819381699870771", // yara
  "1050232641573634068", // minh
  "444440321665925120", // abu
  "180437155322003456", // brian
  "835772007311343676", // camila
  "190518270388862976", //ceyhun
  "755174330811547649", // chris
  "1020309256681037864", //drew
  "476144471541678093", //efan
  "357574142402494464", //elizabet
  "1061870532015964160", // fatema
  "933132962243969024", //gift
  "1003514885935726593", // gorav
  "522192758006611974", // jacob
  "425821703655129088", // kaden
  "747495296069664808", // kevin 
  "576553584015966210", // ksenia
  "351053512983052298", // luyun
  "752884373510029333", // maitri
  "317448057643859969", // malcolm
  "782662280601010186", // nicholas nick
  "197460413338615808", // ossama
  "805229043510935592", // paolo
  "1014972297708326992", // parsa
  "1265361030641356965", // parsa #2
  "189886045561552896", // rv 
  "1044357047069712405", // raghda
  "145200036635082752", // rayan
  "561515699785302027", // rishit
  "843661255650967552", // shai
  "252529572560502804", // zach
  "1241408566204563598", // rushin
  "691655134731829248", // zoeh
  "627313812302987267", // diego
  "227590502906593282", // jon sanie
  "714836826786889828", // momo
  "773716628261175296", // ivan 
  "735275752265875577", // fozail
  "692474743793778748", // lina
  "446476678596919296", // augusto
  "462354478264221699", // oumayma
  "297399831050190848", // sam
  "1156934653412913234", // nurseit
  "290894293042987009", // houssam
  "1212048971380559965", //isabella
  "874842014456356874", // mathias
  "772593955908747284", //amirreza
  "248230862657683457", //alexandre
  "332262168806555649", // mohammad
  "702958543879536671", //ardalan
  "995708835111120927", //achal

];
async function checkDiscordExecRole(accessToken: string, userId?: string): Promise<boolean> {
  // If no userId was provided, we can't check
  if (!userId) {
    console.warn("[DEBUG] No Discord user ID provided for role check");
    return false; // For development only - change to false in production
  }
  
  
  // Check if the user ID is in our approved list
  const isApproved = APPROVED_EXEC_IDS.includes(userId);
  
  
  // For development, optionally allow access anyway
  if (!isApproved) {
    console.warn("User is not in approved exec list, so not allowing login for development");
    return false; // Change to "return isApproved;" in production
  }
  
  return true;
}

export default function OAuthCallbackPage() {
  const fetcher = useFetcher<OAuthCallbackResponse>();
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Run immediately on mount - don't wait for effects
  useEffect(() => {
    if (!hasSubmitted) {
      const fragment = window.location.hash.substring(1);

      const params = new URLSearchParams(fragment);

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = params.get("expires_in");
      const expiresAt = params.get("expires_at");
      // Log token existence and length for debugging

      if (!accessToken || !refreshToken || !expiresIn) {
        setError("Missing required OAuth parameters");
        return;
      }

      // Create form data and submit immediately
      const formData = new FormData();
      formData.append("access_token", accessToken);
      formData.append("refresh_token", refreshToken);
      formData.append("expires_in", expiresIn);
      if (expiresAt) {
        formData.append("expires_at", expiresAt);
      }

      // Use immediate fetch instead of fetcher for more control
      fetch("/oauth/callback", {
        method: "POST",
        body: formData
      }).then(response => {
        if (response.redirected) {
          window.location.href = response.url;
        }
      }).catch(err => {
        console.error("[DEBUG] OAuth submission error:", err);
        setError("Failed to process authentication");
      });

      setHasSubmitted(true);
    }
  }, []);  // Remove dependencies to ensure this runs once on mount

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
import type { User as DatabaseUser } from '@prisma/client';
import { Organization, OrganizationRoles } from "@prisma/client";

// Extend DatabaseUser type to include discordId
interface ExtendedDatabaseUser extends DatabaseUser {
  discordId: string;
}
import { AuthError, isAuthApiError} from "@supabase/supabase-js";
import type { User as SupabaseUser, User, Session } from "@supabase/supabase-js";
import type { AuthSession } from "server/session";
import { config } from "~/config/shelf.config";
import { db } from "~/database/db.server";
import { getSupabaseAdmin } from "~/integrations/supabase/client";
import { SERVER_URL } from "~/utils/env";
import type { ErrorLabel } from "~/utils/error";
import { isLikeShelfError, ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";
import { mapAuthSession } from "./mappers.server";
import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";


const label: ErrorLabel = "Auth";

export async function createEmailAuthAccount(email: string, password: string) {
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      throw error;
    }

    const { user } = data;

    return user;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to create email auth account",
      additionalData: { email },
      label,
    });
  }
}

export async function signUpWithEmailPass(email: string, password: string) {
  try {
    const { data, error } = await getSupabaseAdmin().auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          signup_method: "email-password",
        },
      },
    });

    if (error) {
      throw error;
    }

    const { user } = data;

    if (!user) {
      throw new ShelfError({
        cause: null,
        message: "The user returned by Supabase is null",
        label,
      });
    }

    return user;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Something went wrong, refresh page and try to signup again.",
      additionalData: { email },
      label,
    });
  }
}

export async function resendVerificationEmail(email: string) {
  try {
    const { error } = await getSupabaseAdmin().auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      throw error;
    }
  } catch (cause) {
    // @ts-expect-error
    const isRateLimitError = cause?.code === "over_email_send_rate_limit";
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while resending the verification email. Please try again later or contact support.",
      additionalData: { email },
      label,
      shouldBeCaptured: !isRateLimitError,
    });
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({
      email,
      password,
    });

    if (error?.message === "Email not confirmed") {
      return null;
    }

    if (error) {
      throw error;
    }

    const { session } = data;

    return mapAuthSession(session);
  } catch (cause) {
    let message =
      "Something went wrong. Please try again later or contact support.";
    let shouldBeCaptured = true;

    if (
      isAuthApiError(cause) &&
      cause.message === "Invalid login credentials"
    ) {
      message = "Incorrect email or password";
      shouldBeCaptured = false;
    }

    throw new ShelfError({
      cause,
      message,
      label,
      shouldBeCaptured,
    });
  }
}



export async function signInWithSSO(domain: string) {
  try {
    const { data, error } = await getSupabaseAdmin().auth.signInWithSSO({
      domain,
      options: {
        redirectTo: `${SERVER_URL}/oauth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return data.url;
  } catch (cause) {
    let message =
      "Something went wrong. Please try again later or contact support.";
    let shouldBeCaptured = true;

    // @ts-expect-error
    if (cause?.code === "sso_provider_not_found") {
      message = "No SSO provider assigned for your organization's domain";
      shouldBeCaptured = false;
    }

    throw new ShelfError({
      cause,
      message,
      label,
      shouldBeCaptured,
      additionalData: { domain },
    });
  }
}

/**
 * Helper function to check if user is SSO-only and throw appropriate error
 * @param email User's email address
 * @throws ShelfError if user exists and is SSO-only
 */
async function validateNonSSOUser(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { sso: true },
  });

  if (user?.sso) {
    throw new ShelfError({
      cause: null,
      title: "SSO User",
      message:
        "This email address is associated with an SSO account. Please use SSO login instead.",
      additionalData: { email },
      label: "Auth",
    });
  }
}


/**
 * Retrieve the OAuth session after the Supabase OAuth flow completes.
 * This is typically triggered by the /oauth/callback endpoint.
 */






export async function sendOTP(email: string) {
  try {
    await validateNonSSOUser(email);

    const { error } = await getSupabaseAdmin().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: !config.disableSignup, // If signup is disabled, don't create a new user
      },
    });

    if (error) {
      throw error;
    }
  } catch (cause) {
    // @ts-expect-error
    const isRateLimitError = cause.code === "over_email_send_rate_limit";
    throw new ShelfError({
      cause,
      message:
        cause instanceof AuthError || isLikeShelfError(cause)
          ? cause.message
          : "Something went wrong while sending the OTP. Please try again later or contact support.",
      additionalData: { email },
      label,
      shouldBeCaptured: !isRateLimitError,
    });
  }
}

export async function sendResetPasswordLink(email: string) {
  try {
    await validateNonSSOUser(email);

    await getSupabaseAdmin().auth.resetPasswordForEmail(email, {
      redirectTo: `${SERVER_URL}/reset-password`,
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while sending the reset password link. Please try again later or contact support.",
      additionalData: { email },
      label,
    });
  }
}

export async function updateAccountPassword(
  id: string,
  password: string,
  accessToken?: string | undefined
) {
  try {
    const user = await db.user.findFirst({
      where: { id },
      select: {
        sso: true,
      },
    });
    if (user?.sso) {
      throw new ShelfError({
        cause: null,
        message: "You cannot update the password of an SSO user.",
        label,
      });
    }
    //logout all the others session expect the current sesssion.
    if (accessToken) {
      await getSupabaseAdmin().auth.admin.signOut(accessToken, "others");
    }
    //on password update, it is remvoing the session in th supbase.
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, {
      password,
    });

    if (error) {
      throw error;
    }
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while updating the password. Please try again later or contact support.",
      additionalData: { id },
      label,
    });
  }
}

export async function deleteAuthAccount(userId: string) {
  try {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);

    if (error) {
      throw error;
    }
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message:
          "Something went wrong while deleting the auth account. Please manually delete the user account in the Supabase dashboard.",
        additionalData: { userId },
        label,
      })
    );
  }
}

// service.server.ts

/**
 * Get auth user by Discord ID from user metadata
 */
export async function getAuthUserById(discordId: string) {
  try {
    const { data: { users }, error } = await getSupabaseAdmin().auth.admin.listUsers();
    if (error) throw error;

    // Find user with matching Discord ID in metadata
    const user = users.find(u => {
      const metadata = u.user_metadata as { sub?: string };
      return metadata?.sub === discordId;
    });

    if (!user) {
      throw new ShelfError({
        cause: null,
        message: `User with Discord ID ${discordId} not found`,
        label: "Auth",
      });
    }

    return user;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Something went wrong while getting the auth user by Discord ID.",
      additionalData: { discordId },
      label: "Auth",
    });
  }
}



async function findOrCreateUser(authData: {
  email: string;
  discordId: string;
  name?: string;
  avatarUrl?: string;
}) {
  try {
    // First try to find user by Discord ID or email in public User table
    let user = await db.user.findFirst({
      where: {
        OR: [
          { id: authData.discordId },
          { email: authData.email.toLowerCase() }
        ]
      }
    });

    if (!user) {
      // Create new user if not found
      user = await db.user.create({
        data: {
          id: authData.discordId, // Use Discord ID as the primary user ID
          email: authData.email.toLowerCase(),
          username: `${authData.name || authData.email.split('@')[0]}`,
          firstName: authData.name || authData.email.split('@')[0],
          lastName: '',
          onboarded: true,
          tierId: "tier_2",
          sso: true,
          createdWithInvite: false
        }
      });
    } else {
      // Update existing user with latest Discord info
      user = await db.user.update({
        where: { id: user.id },
        data: {
          // Only update these if they were empty before
          firstName: user.firstName || authData.name || authData.email.split('@')[0],
          username: user.username || `${authData.name || authData.email.split('@')[0]}`
        }
      });
    }

    return user;
  } catch (error) {
    throw new ShelfError({
      cause: error,
      message: "Failed to find or create user",
      label: "Auth",
      additionalData: { email: authData.email, discordId: authData.discordId }
    });
  }
}

// Remove the second, duplicated convertToSupabaseUser and keep only one
function convertToSupabaseUser(
  dbUser: ExtendedDatabaseUser,
  userData: SupabaseUser
): SupabaseUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    created_at: dbUser.createdAt?.toISOString(),
    updated_at: dbUser.updatedAt?.toISOString(),
    app_metadata: userData.app_metadata,
    user_metadata: {
      ...userData.user_metadata,
      discord_id: dbUser.discordId,
      name: dbUser.firstName,
      avatar_url: dbUser.profilePicture,
    },
    aud: userData.aud,
    role: userData.role,
    email_confirmed_at: userData.email_confirmed_at,
    phone: userData.phone,
    confirmed_at: userData.confirmed_at,
    last_sign_in_at: userData.last_sign_in_at,
    factors: userData.factors,
  };
}

export async function getOAuthSession(data: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
}): Promise<AuthSession & { user: User; user_metadata: Record<string, any> }> {
  try {
    const { data: userData, error: userError } = await getSupabaseAdmin().auth.getUser(data.access_token);

    if (userError) {
      Logger.error({
        cause: userError,
        message: "Failed to get user data from access token",
        label: "Auth",
        additionalData: { token: data.access_token }
      });
      throw userError;
    }

    if (!userData?.user) {
      throw new ShelfError({
        cause: null,
        message: "User data not found in OAuth response",
        label: "Auth",
      });
    }

    const discordId = userData.user.user_metadata?.sub;
    if (!discordId) {
      Logger.error({
        message: "Discord ID missing from metadata",
        label: "Auth",
        additionalData: { metadata: userData.user.user_metadata }
      });
      throw new ShelfError({
        cause: null,
        message: "Discord ID is missing in user metadata",
        label: "Auth",
      });
    }

    // Try to find existing user by Discord ID
    let existingUser;
    try {
      existingUser = await getAuthUserById(discordId);
      Logger.info({
        message: "Found existing user by Discord ID",
        label: "Auth",
        additionalData: { discordId, userId: existingUser.id }
      });
    } catch (error) {
      Logger.info({
        message: "No existing user found for Discord ID",
        label: "Auth",
        additionalData: { discordId }
      });
    }

    const email = userData.user.email;
    if (!email) {
      throw new ShelfError({
        cause: null,
        message: "User email is missing in Supabase response",
        label: "Auth",
      });
    }

    const userId = existingUser?.id || userData.user.id;

    // Ensure user exists in auth.users table
    const { error: upsertError } = await getSupabaseAdmin().auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...userData.user.user_metadata,
          discord_id: discordId,
          name: userData.user.user_metadata.full_name || userData.user.user_metadata.name,
          avatar_url: userData.user.user_metadata.avatar_url
        },
        email_confirm: true
      }
    );

    if (upsertError) {
      Logger.error({
        cause: upsertError,
        message: "Failed to update user data",
        label: "Auth",
        additionalData: { userId }
      });
      throw upsertError;
    }

    // Handle refresh token
    try {
      await db.$queryRawUnsafe(
        `INSERT INTO auth.refresh_tokens (token, user_id, revoked, created_at, updated_at)
        VALUES ($1, $2, FALSE, NOW(), NOW())
        ON CONFLICT (token) DO UPDATE SET updated_at = NOW(), revoked = FALSE;`,
        data.refresh_token, 
        userId
      );
    } catch (error) {
      Logger.error({
        cause: error,
        message: "Failed to persist refresh token",
        label: "Auth",
        additionalData: { userId }
      });
      throw error;
    }

    const session: AuthSession & { user: User; user_metadata: Record<string, any> } = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: data.expires_at || Date.now() + data.expires_in * 1000,
      user: existingUser || userData.user,
      user_metadata: {
        ...userData.user.user_metadata,
        discord_id: discordId
      },
      userId: userId,
      email
    };

    return session;
  } catch (cause) {
    Logger.error({
      cause,
      message: "Failed to process OAuth session",
      label: "Auth",
      additionalData: { expires_in: data.expires_in }
    });
    throw new ShelfError({
      cause,
      message: "Failed to retrieve OAuth session",
      label: "Auth",
    });
  }
}



export async function getAuthResponseByAccessToken(accessToken: string) {
  try {
    return await getSupabaseAdmin().auth.getUser(accessToken);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while getting the auth response by access token. Please try again later or contact support.",
      label,
    });
  }
}

export async function validateSession(token: string | null, userId?: string) {
  // Skip validation for users with Discord IDs (numeric only)
  if (userId && /^\d+$/.test(userId)) {
    console.log("[DEBUG] Skipping token validation for Discord user:", userId);
    return true;
  }
  
  // Skip validation for guest users
  if (userId?.startsWith('guest-')) {
    return true;
  }
  
  // Skip validation for null/empty tokens
  if (!token) {
    return false;
  }

  const t0 = performance.now();
  // Rest of your existing validation logic
  const result = await db.$queryRaw<{ id: String; revoked: boolean }[]>`
    SELECT id, revoked 
    FROM auth.refresh_tokens 
    WHERE token = ${token} 
    AND revoked = false
    LIMIT 1
  `;
  const t1 = performance.now();
  console.log(`Call to validateSession took ${t1 - t0} milliseconds.`);

  // Only log error if not a guest session
  if (result.length === 0 && !userId?.startsWith('guest-')) {
    Logger.error(
      new ShelfError({
        cause: null,
        message: "Refresh token is invalid or has been revoked",
        label: "Auth",
        shouldBeCaptured: false,
      })
    );
  }

  return result.length > 0;
}

export async function refreshAccessToken(
  refreshToken?: string
): Promise<AuthSession> {
  try {
    if (!refreshToken) {
      throw new ShelfError({
        cause: null,
        message: "Refresh token is required",
        label,
      });
    }

    const { data, error } = await getSupabaseAdmin().auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    const { session } = data;

    if (!session) {
      throw new ShelfError({
        cause: null,
        message: "The session returned by Supabase is null",
        label,
      });
    }

    return mapAuthSession(session);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Unable to refresh access token. Please try again. If the issue persists, contact support",
      label,
      additionalData: {
        refreshToken,
      },
    });
  }
}

export async function verifyAuthSession(authSession: AuthSession) {
  try {
    const authAccount = await getAuthResponseByAccessToken(
      authSession.accessToken
    );

    return Boolean(authAccount);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while verifying the auth session. Please try again later or contact support.",
      label,
    });
  }
}

export async function verifyOtpAndSignin(email: string, otp: string) {
  try {
    const { data, error } = await getSupabaseAdmin().auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      throw error;
    }

    const { session } = data;

    if (!session) {
      throw new ShelfError({
        cause: null,
        message: "The session returned by Supabase is null",
        label,
      });
    }

    return mapAuthSession(session);
  } catch (cause) {
    let message =
      "Something went wrong. Please try again later or contact support.";
    let shouldBeCaptured = true;

    if (isAuthApiError(cause) && cause.message !== "") {
      message = cause.message;
      shouldBeCaptured = false;
    }

    throw new ShelfError({
      cause,
      message,
      label,
      shouldBeCaptured,
      additionalData: { email },
    });
  }
}

export async function createGuestSession() {
  const guestId = `guest-${Math.random().toString(36).substring(2)}`;
  const ieeeOrgId = "cm6svb7av000dyozubn2k033i";
  
  try {
    // First check if organization exists
    let organization = await db.organization.findUnique({
      where: { id: ieeeOrgId },
      select: { id: true, userId: true }
    });

    // If org doesn't exist, create it with a system admin user
    if (!organization) {
      // Create a system admin user for the organization
      const adminId = "admin-ieee";
      const adminUser = await db.user.upsert({
        where: { id: adminId },
        update: {},
        create: {
          id: adminId,
          email: "admin@ieee.concordia.ca",
          username: "ieee-admin",
          firstName: "IEEE",
          lastName: "Base",
          onboarded: true,
          tierId: "tier_2"
        }
      });

      // Create organization owned by the admin
      organization = await db.organization.create({
        data: {
          id: ieeeOrgId,
          name: "IEEE Concordia",
          type: "TEAM",
          userId: adminUser.id // Set admin as owner
        }
      });

      // Create admin's role in organization
      await db.userOrganization.create({
        data: {
          userId: adminUser.id,
          organizationId: ieeeOrgId,
          roles: [OrganizationRoles.ADMIN]
        }
      });
    }

    // Create guest user in a transaction to ensure consistency
    const guestUser = await db.$transaction(async (tx) => {
      // 1. First create the user
      const user = await tx.user.create({
        data: {
          id: guestId,
          email: `${guestId}@guest.ieee.concordia.ca`,
          username: `guest-${guestId}`,
          firstName: "Guest",
          lastName: "User",
          onboarded: true,
          tierId: "tier_2",
        }
      });
      
      // 2. Then create the user-organization relationship with ADMIN role instead of BASE
      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: ieeeOrgId,
          roles: [OrganizationRoles.BASE] // Changed from BASE to ADMIN
        }
      });
      
      return user;
    });

    return {
      userId: guestId,
      accessToken: null,
      refreshToken: null,
      expiresIn: 86400,
      expiresAt: Date.now() + 86400 * 1000,
      email: guestUser.email
    };
  } catch (cause: any) {
    console.error("Error creating guest session:", cause);
    if (cause.code === "P1001") {
      console.error("Database unreachable while creating guest session:", cause);
      return null;
    }
    throw new ShelfError({
      cause,
      message: "Failed to create guest session",
      label: "Auth"
    });
  }
}
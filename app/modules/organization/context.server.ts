import { createCookie } from "@remix-run/node";
import {
  destroyCookie,
  parseCookie,
  serializeCookie,
} from "~/utils/cookies.server";
import { NODE_ENV, SESSION_SECRET } from "~/utils/env";
import type { ErrorLabel } from "~/utils/error";
import { ShelfError } from "~/utils/error";
import { db } from "~/database/db.server";
import { OrganizationRoles } from "@prisma/client"; // add this import if not present
import { createGuestSession } from "~/modules/auth/service.server";

import { getUserOrganizations } from "./service.server";

const label: ErrorLabel = "Organization";

const selectedOrganizationIdCookie = createCookie("selected-organization-id", {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secrets: [SESSION_SECRET],
  secure: NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365, // 1 year
});

type SelectedOrganizationId = string;

async function getSelectedOrganizationIdCookie(request: Request) {
  return parseCookie<SelectedOrganizationId>(
    selectedOrganizationIdCookie,
    request
  );
}

export function setSelectedOrganizationIdCookie<
  T extends SelectedOrganizationId,
>(value: T) {
  return serializeCookie<T>(selectedOrganizationIdCookie, value);
}

export function destroySelectedOrganizationIdCookie() {
  return destroyCookie(selectedOrganizationIdCookie);
}

/**
 * This function is used to get the selected organization for the user.
 * It checks if the user is part of the current selected organization
 * It always defaults to the personal organization if the user is not part of the current selected organization.
 * @throws If the user is not part of any organization
 */
export async function getSelectedOrganisation({
  userId,
  request,
}: {
  userId: string;
  request: Request;
}) {
  try {
    // For guest users, make sure they have the IEEE organization
    if (userId?.startsWith('guest-')) {
      const ieeeOrgId = "cm6svb7av000dyozubn2k033i";
      
      try {
        // Verify the guest user exists
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { id: true }
        });
        
        // Instead of throwing if not found, create a new guest session
        if (!user) {
          console.log(`[DEBUG] Guest user ${userId} not found, creating new guest session`);
          const guestSession = await createGuestSession();
          if (guestSession) {
            return await getSelectedOrganisation({ userId: guestSession.userId, request });
          }
          throw new ShelfError({
            cause: null,
            message: "Failed to create a new guest session",
            label: "Organization",
            status: 401,
            additionalData: { userId }
          });
        }
        
        // Check if the IEEE organization exists
        const org = await db.organization.findUnique({
          where: { id: ieeeOrgId },
        });
        
        if (!org) {
          throw new ShelfError({
            cause: null,
            message: "IEEE organization does not exist",
            label: "Organization",
            status: 401,
            additionalData: { userId, orgId: ieeeOrgId }
          });
        }
        
        // Check if user has relationship with this org
        const userOrg = await db.userOrganization.findUnique({
          where: { 
            userId_organizationId: {
              userId,
              organizationId: ieeeOrgId
            }
          },
          include: { organization: true }
        });
        
        if (userOrg) {
          return {
            organizationId: org.id,
            organizations: [org],
            currentOrganization: org,
            userOrganizations: [userOrg]
          };
        } else {
          // Create relationship if missing - but carefully in a transaction
          const newUserOrg = await db.$transaction(async (tx) => {
            // Verify user exists inside transaction
            const txUser = await tx.user.findUnique({
              where: { id: userId },
            });
            
            if (!txUser) {
              throw new ShelfError({
                cause: null,
                message: "Guest user disappeared",
                label: "Organization",
                status: 401,
              });
            }
            
            return await tx.userOrganization.create({
              data: {
                userId,
                organizationId: ieeeOrgId,
                roles: [OrganizationRoles.ADMIN] // Changed from BASE to ADMIN
              },
              include: { organization: true }
            });
          });
          
          return {
            organizationId: org.id,
            organizations: [org],
            currentOrganization: org,
            userOrganizations: [newUserOrg]
          };
        }
      } catch (guestError) {
        // If any error occurs with a guest user, recreate the session
        throw new ShelfError({
          cause: guestError,
          message: "Guest session expired. Creating a new guest session.",
          label: "Organization",
          status: 401, // Use 401 to trigger a new session
          additionalData: { userId }
        });
      }
    }
    
    // Regular flow for non-guest users
    const userOrganizations = await db.userOrganization.findMany({
      where: { userId },
      include: { organization: true },
    });

    if (userOrganizations.length === 0) {
      throw new ShelfError({
        cause: null,
        message: userId?.startsWith('guest-') 
          ? "No organization available for guest. Please refresh the page."
          : "You don't have access to any organization.",
        label: "Organization",
        status: 403,
        additionalData: { userId }
      });
    }

    // Get selected organization ID from cookie
    const selectedOrganizationId = await getSelectedOrganizationIdCookie(request);
    
    // Find organization that matches the cookie
    const selectedUserOrganization = userOrganizations.find(
      (userOrganization) =>
        userOrganization.organization.id === selectedOrganizationId
    );

    // If no matching organization or none is selected, use the first one
    return {
      organizationId: selectedUserOrganization?.organization.id || userOrganizations[0].organization.id,
      organizations: userOrganizations.map((uo) => uo.organization),
      currentOrganization: selectedUserOrganization?.organization || userOrganizations[0].organization,
      userOrganizations,
    };
  } catch (cause) {
    if (userId?.startsWith('guest-')) {
      // For guest users, throw special error that will trigger recreation
      throw new ShelfError({
        cause,
        message: "Guest session expired. Creating a new guest session.",
        label: "Organization",
        status: 401, // Use 401 to trigger a new session
        additionalData: { userId }
      });
    }
    
    throw new ShelfError({
      cause,
      message: "Failed to get selected organization",
      label: "Organization",
      additionalData: { userId, request: request.url },
    });
  }
}

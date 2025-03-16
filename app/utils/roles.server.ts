import type { SsoDetails } from "@prisma/client";
import { Organization, OrganizationRoles, Roles, UserOrganization } from "@prisma/client";
import { db } from "~/database/db.server";
import { getSelectedOrganisation } from "~/modules/organization/context.server";
import { ShelfError } from "./error";
import type { PermissionAction, PermissionEntity } from "./permissions/permission.data";
import { validatePermission } from "./permissions/permission.validator.server";

// Define interfaces for the different parameter types
interface AsyncPermissionParams {
  userId: string;
  request: Request;
  entity: PermissionEntity;
  action: PermissionAction;
}
interface RequireAdminReturn {
  organizations: Organization[];
  organizationId: string;
  currentOrganization: Organization;
  userOrganizations: UserOrganization[];
}

interface RequirePermissionReturn {
  organizations: Organization[];
  organizationId: string;
  currentOrganization: Organization;
  role: OrganizationRoles;
  isSelfServiceOrBase: boolean;
  userOrganizations: UserOrganization[];
}

// Overload signatures
export function requirePermission(params: AsyncPermissionParams): Promise<RequirePermissionReturn>;
export function requirePermission(userPermissions: string[] | undefined, requiredPermission: string): boolean;


// Implementation
export function requirePermission(
  paramsOrPermissions: AsyncPermissionParams | string[] | undefined,
  requiredPermission?: string
): Promise<RequirePermissionReturn> | boolean {
  // Check if first argument matches async params shape
  if (paramsOrPermissions && typeof paramsOrPermissions === 'object' && 'userId' in paramsOrPermissions) {
    // Async version
    const params = paramsOrPermissions as AsyncPermissionParams;
    return (async () => {
      const { organizationId, userOrganizations, organizations, currentOrganization } =
        await getSelectedOrganisation({ userId: params.userId, request: params.request });

      const mappedUserOrganizations = userOrganizations.map((uo) => ({
        id: uo.organization.id,
        userId: uo.organization.userId,
        createdAt: uo.organization.createdAt,
        updatedAt: uo.organization.updatedAt,
        organizationId: uo.organization.id,
        roles: uo.roles,
      }));

      const roles = mappedUserOrganizations.find(
        (uo) => uo.organizationId === organizationId
      )?.roles;

      await validatePermission({
        roles,
        action: params.action,
        entity: params.entity,
        organizationId,
        userId: params.userId,
      });

      const role = roles ? roles[0] : OrganizationRoles.BASE;

      return {
        organizations,
        organizationId,
        currentOrganization,
        role,
        isSelfServiceOrBase: role === OrganizationRoles.SELF_SERVICE || role === OrganizationRoles.BASE,
        userOrganizations: mappedUserOrganizations,
      };
    })();
  }

  // Sync version
  if (typeof requiredPermission === 'string') {
    const permissions = paramsOrPermissions as string[] ?? [];
    return permissions.includes(requiredPermission);
  }

  throw new Error('Invalid parameters passed to requirePermission');
}
export async function requireAdmin(
  userId: string,
  request: Request
): Promise<RequireAdminReturn> {
  const { organizationId, userOrganizations, organizations, currentOrganization } =
    await getSelectedOrganisation({ userId, request });

  const mappedUserOrganizations = userOrganizations.map((uo) => ({
    id: uo.organization.id,
    userId: uo.organization.userId,
    createdAt: uo.organization.createdAt,
    updatedAt: uo.organization.updatedAt,
    organizationId: uo.organization.id,
    roles: uo.roles,
  }));

  const roles = mappedUserOrganizations.find(
    (uo) => uo.organizationId === organizationId
  )?.roles;

  if (!roles || !roles.includes(OrganizationRoles.ADMIN)) {
    throw new ShelfError({
      cause: null,
      message: "Requires admin privileges",
      label: "Permission",
      status: 403,
    });
  }

  return {
    organizations,
    organizationId,
    currentOrganization,
    userOrganizations: mappedUserOrganizations,
  };
}
/** Gets the role needed for SSO login from the groupID returned by the SSO claims */
export function getRoleFromGroupId(
  ssoDetails: SsoDetails,
  groupIds: string[]
): OrganizationRoles {
  // We prioritize the admin group. If for some reason the user is in both groups, they will be an admin
  if (ssoDetails.adminGroupId && groupIds.includes(ssoDetails.adminGroupId)) {
    return OrganizationRoles.ADMIN;
  } else if (
    ssoDetails.selfServiceGroupId &&
    groupIds.includes(ssoDetails.selfServiceGroupId)
  ) {
    return OrganizationRoles.SELF_SERVICE;
  } else if (
    ssoDetails.baseUserGroupId &&
    groupIds.includes(ssoDetails.baseUserGroupId)
  ) {
    return OrganizationRoles.BASE;
  } else {
    throw new ShelfError({
      cause: null,
      title: "Group ID not found",
      message:
        "The group your user is assigned to is not connected to shelf. Please contact an administrator for more information",
      label: "Auth",
      additionalData: { ssoDetails, groupIds },
    });
  }
}

export async function requireOrgRole(
  userId: string,
  organizationId: string,
  roles: OrganizationRoles[]
): Promise<UserOrganization> {
  const userOrganization = await db.userOrganization.findFirst({
    where: {
      userId,
      organizationId,
    },
  });

  if (!userOrganization) {
    throw new ShelfError({
      cause: null,
      message: "User not found in organization",
      label: "Permission",
      status: 403,
    });
  }

  if (!roles.some((role) => userOrganization.roles.includes(role))) {
    throw new ShelfError({
      cause: null,
      message: "Insufficient permissions",
      label: "Permission",
      status: 403,
    });
  }

  return userOrganization;
}

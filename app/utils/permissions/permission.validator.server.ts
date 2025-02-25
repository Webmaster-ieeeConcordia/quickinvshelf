import type { OrganizationRoles } from "@prisma/client";
import { db } from "~/database/db.server";
import { ShelfError } from "~/utils/error";
import type { PermissionAction, PermissionEntity } from "./permission.data";
import { permissions } from "./permission.data";

export interface PermissionCheckProps {
  organizationId: string;
  roles?: OrganizationRoles[];
  userId: string;
  action: PermissionAction;
  entity: PermissionEntity;
}

export async function validatePermission({
  roles,
  action,
  entity,
  organizationId,
  userId,
}: {
  roles?: OrganizationRoles[];
  action: PermissionAction;
  entity: PermissionEntity;
  organizationId: string;
  userId: string;
}) {
  if (!roles?.length) {
    throw new ShelfError({
      cause: null,
      message: "You have no permission to perform this action",
      label: "Permission",
      title: "Unauthorized",
      status: 403,
      additionalData: { roles, action, entity, organizationId, userId },
      shouldBeCaptured: false,
    });
  }

  const allowedRoles = permissions[entity][action];
  const hasPermission = roles.some((role) => allowedRoles.includes(role));

  if (!hasPermission) {
    throw new ShelfError({
      cause: null,
      message: "You have no permission to perform this action",
      label: "Permission",
      title: "Unauthorized",
      status: 403,
      additionalData: { roles, action, entity, organizationId, userId },
      shouldBeCaptured: false,
    });
  }
}

export async function hasPermission({
  roles,
  action,
  entity,
  organizationId,
  userId,
}: {
  roles?: OrganizationRoles[];
  action: PermissionAction;
  entity: PermissionEntity;
  organizationId: string;
  userId: string;
}) {
  try {
    await validatePermission({ roles, action, entity, organizationId, userId });
    return true;
  } catch {
    return false;
  }
}

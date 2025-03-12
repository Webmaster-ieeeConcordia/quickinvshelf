import { OrganizationRoles } from "@prisma/client";

export enum PermissionAction {
  create = "create",
  read = "read",
  update = "update",
  delete = "delete",
  checkout = "checkout",
  checkin = "checkin",
  export = "export",
  import = "import",
  custody = "custody"
}

export enum PermissionEntity {
  asset = "asset",
  category = "category",
  booking = "booking",
  customField = "customField",
  dashboard = "dashboard",
  kit = "kit",
  location = "location",
  subscription = "subscription",
  teamMember = "teamMember",
  tag = "tag"
}

// Add this new type to define the structure
export type PermissionMap = {
  [key in PermissionEntity]?: PermissionAction[];
};

// Add this new Role2PermissionMap export
export const Role2PermissionMap: { [key in OrganizationRoles]?: PermissionMap } = {
  [OrganizationRoles.OWNER]: {
    asset: Object.values(PermissionAction),
    category: Object.values(PermissionAction),
    booking: Object.values(PermissionAction),
    customField: Object.values(PermissionAction),
    dashboard: Object.values(PermissionAction),
    kit: Object.values(PermissionAction),
    location: Object.values(PermissionAction),
    subscription: Object.values(PermissionAction),
    teamMember: Object.values(PermissionAction),
    tag: Object.values(PermissionAction),
  },
  [OrganizationRoles.ADMIN]: {
    asset: Object.values(PermissionAction),
    category: Object.values(PermissionAction),
    booking: Object.values(PermissionAction),
    customField: Object.values(PermissionAction),
    dashboard: Object.values(PermissionAction),
    kit: Object.values(PermissionAction),
    location: Object.values(PermissionAction),
    subscription: Object.values(PermissionAction),
    teamMember: Object.values(PermissionAction),
    tag: Object.values(PermissionAction),
  },
  [OrganizationRoles.BASE]: {
    asset: [PermissionAction.read],
    category: [PermissionAction.read],
    kit: [PermissionAction.read],
    location: [PermissionAction.read],
    teamMember: [PermissionAction.read],
    tag: [PermissionAction.read],
  },
  [OrganizationRoles.SELF_SERVICE]: {
    asset: [PermissionAction.read, PermissionAction.custody],
    booking: [PermissionAction.create, PermissionAction.read],
  },
};

// Define permission mappings for each entity
export const permissions: Record<PermissionEntity, Record<PermissionAction, OrganizationRoles[]>> = {
  asset: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER, OrganizationRoles.SELF_SERVICE],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER, OrganizationRoles.SELF_SERVICE]
  },
  dashboard: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  // Add similar permission mappings for other entities...
  booking: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER, OrganizationRoles.SELF_SERVICE],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER, OrganizationRoles.SELF_SERVICE],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  category: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  customField: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  kit: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  location: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  subscription: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  teamMember: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  },
  tag: {
    create: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    read: [OrganizationRoles.ADMIN, OrganizationRoles.BASE, OrganizationRoles.OWNER],
    update: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    delete: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkout: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    checkin: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    export: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    import: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER],
    custody: [OrganizationRoles.ADMIN, OrganizationRoles.OWNER]
  }
};

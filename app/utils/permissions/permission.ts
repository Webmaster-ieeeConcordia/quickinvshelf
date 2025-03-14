import { PermissionAction, PermissionEntity } from "./permission.data";

// Add missing properties to PermissionEntity
Object.assign(PermissionEntity, {
  custody: "custody",
  scan: "scan",
  note: "note", 
  teamMemberProfile: "teamMemberProfile",
  generalSettings: "generalSettings",
  assetReminders: "assetReminders",
  assetIndexSettings: "assetIndexSettings",
  qr: "qr",
  workspace: "workspace"
});

// Add missing properties to PermissionAction
Object.assign(PermissionAction, {
  manageAssets: "manageAssets"
});
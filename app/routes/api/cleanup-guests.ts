import { json } from "@remix-run/node";
import { cleanupGuestUsers } from "~/modules/asset-index-settings/service.server";
/**
 * This endpoint will be called by Vercel Cron job
 * to clean up expired guest users
 */
export async function loader() {
  try {
    const result = await cleanupGuestUsers();
    return json({ 
      success: true, 
      deletedCount: result?.deletedCount || 0,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error("[ERROR] Guest cleanup cron job failed:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
import { addMinutes } from "date-fns";
import { db } from "~/database/db.server";
import { getSupabaseAdmin } from "~/integrations/supabase/client";
import { ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";
import { scheduler } from "~/utils/scheduler.server"; 

const GUEST_CLEANUP_INTERVAL_MINUTES = 60;
const GUEST_EXPIRATION_MINUTES = 1 * 60; // 24 hours

/**
 * Cleans up guest users that haven't been active for a while
 */
export async function registerGuestCleanupWorker() {
  console.log("[DEBUG] Registering guest cleanup worker");
  
  try {
    // Fix: PgBoss schedule method expects a string as the second parameter, not an object
    await scheduler.schedule(
      "guest-cleanup-worker",                // job name
      JSON.stringify({}),                    // job data as JSON string
      {
        repeatEvery: `${GUEST_CLEANUP_INTERVAL_MINUTES} minutes`,
      }
    );
    
    // Register the handler for this job
    await scheduler.work('guest-cleanup-worker', cleanupGuestUsers);
    
    console.log("[DEBUG] Scheduled new cleanup job");
  } catch (error) {
    console.error("[DEBUG] Failed to register guest cleanup worker:", error);
    Logger.error(
      new ShelfError({
        cause: error,
        message: "Failed to register guest cleanup worker",
        label: "Auth",
      })
    );
  }
}

/**
 * Find and delete guest users that have expired
 */
async function cleanupGuestUsers() {
  try {
    console.log("[DEBUG] Running guest cleanup job");
    
    // Find guest users older than expiration time
    const cutoffDate = addMinutes(new Date(), -GUEST_EXPIRATION_MINUTES);
    
    const guestsToDelete = await db.user.findMany({
      where: {
        id: { startsWith: "guest-" },
        createdAt: { lt: cutoffDate },
      },
      select: { id: true, email: true },
    });
    
    if (guestsToDelete.length === 0) {
      console.log("[DEBUG] No expired guest users to clean up");
      return;
    }
    
    console.log(`[DEBUG] Found ${guestsToDelete.length} expired guest users to clean up`);
    
    for (const guest of guestsToDelete) {
      await deleteGuestUser(guest.id, guest.email);
    }
  } catch (error) {
    Logger.error(
      new ShelfError({
        cause: error,
        message: "Failed to clean up guest users",
        label: "Auth",
      })
    );
  }
}

/**
 * Delete a guest user from both the database and auth
 */
async function deleteGuestUser(guestId: string, email: string) {
  try {
    // Only try to delete from auth if NOT a guest user
    // (Guest users don't have Supabase Auth entries)
    if (!guestId.startsWith('guest-')) {
      try {
        await getSupabaseAdmin().auth.admin.deleteUser(guestId);
      } catch (error) {
        console.log("[DEBUG] Failed to delete from auth:", error);
        Logger.error({
          message: "Failed to delete guest from auth",
          additionalData: { guestId, email, error },
        });
      }
    }
    
    // Delete user from database
    await db.user.delete({
      where: { id: guestId },
    });
    
    console.log("[DEBUG] Successfully deleted guest user", guestId);
  } catch (error) {
    Logger.error({
      message: "Failed to delete guest user",
      additionalData: { guestId, email, error },
    });
  }
}

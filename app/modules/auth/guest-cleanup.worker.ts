import { db } from "~/database/db.server";
import { Logger } from "~/utils/logger";
import { QueueNames, scheduler } from "~/utils/scheduler.server";
import { ShelfError } from "~/utils/error";
import { getSupabaseAdmin } from "~/integrations/supabase/client";
import type { Job } from 'pg-boss';

const GUEST_TTL_HOURS = 1; //  1h our ~1 minute for testing
const CLEANUP_INTERVAL = 5*60000; // 5 min60 seconds in milliseconds
const JOB_NAME = 'guest-cleanup-job';

async function deleteGuestUser(guestId: string, email: string) {
  try {
    console.log("[DEBUG] Starting delete process for guest:", { guestId, email });

    // First check if user still exists
    const user = await db.user.findUnique({
      where: { id: guestId },
      include: {
        userOrganizations: true,
        teamMembers: true
      }
    });

    if (!user) {
      console.log("[DEBUG] User already deleted:", { guestId });
      return true;
    }

    // Delete in correct order to avoid foreign key constraints
    if (user.userOrganizations.length > 0) {
      console.log("[DEBUG] Deleting user organizations...");
      await db.userOrganization.deleteMany({
        where: { userId: guestId }
      });
    }

    if (user.teamMembers.length > 0) {
      console.log("[DEBUG] Deleting team members...");
      await db.teamMember.deleteMany({
        where: { userId: guestId }
      });
    }

    // Delete user from database
    console.log("[DEBUG] Deleting user from database...");
    await db.user.delete({
      where: { id: guestId }
    });

    // Try to delete from Supabase auth
    try {
      console.log("[DEBUG] Deleting from Supabase auth...");
      const { error: authError } = await getSupabaseAdmin().auth.admin.deleteUser(guestId);
      if (authError) {
        if (authError.message.includes("User not found")) {
          console.log("[DEBUG] User not found in auth (already deleted)");
        } else {
          console.error("[DEBUG] Auth deletion error:", authError);
          throw authError;
        }
      }
    } catch (authError) {
      console.error("[DEBUG] Failed to delete from auth:", authError);
      // Don't fail the whole operation if auth deletion fails
      Logger.error({
        message: "Failed to delete guest from auth",
        additionalData: { guestId, email, error: authError }
      });
    }

    console.log("[DEBUG] Successfully deleted guest user");
    return true;
  } catch (error) {
    console.error("[DEBUG] Delete error details:", error);
    Logger.error({
      message: "Failed to delete guest user",
      additionalData: { guestId, email, error }
    });
    throw error; // Re-throw to properly handle the error
  }
}

export async function registerGuestCleanupWorker() {
  console.log("[DEBUG] Starting guest cleanup worker registration");

  try {
    // Register the worker - with better error handling
    console.log("[DEBUG] Registering cleanup worker");
    
    // First register work handler
    await scheduler.work(JOB_NAME, async (job: Job) => {
      console.log("[DEBUG] Running cleanup job", { jobId: job.id, data: job.data });
      try {
        // Calculate cutoff time
        const cutoffTime = new Date(Date.now() - GUEST_TTL_HOURS * 60 * 60 * 1000);
        console.log("[DEBUG] Looking for guests created before:", cutoffTime);

        // Find expired guest users
        const expiredGuests = await db.user.findMany({
          where: {
            email: { endsWith: '@guest.ieee.concordia.ca' },
            createdAt: { lt: cutoffTime }
          },
          select: { id: true, email: true, createdAt: true }
        });

        console.log("[DEBUG] Guest search results:", {
          count: expiredGuests.length,
          guests: expiredGuests.map(g => ({
            id: g.id,
            email: g.email,
            createdAt: g.createdAt
          }))
        });
        
        // Delete each expired guest
        for (const guest of expiredGuests) {
          try {
            await deleteGuestUser(guest.id, guest.email);
          } catch (error) {
            console.error("[DEBUG] Failed to delete guest:", { guest, error });
            // Continue with next guest even if one fails
          }
        }

        return true;
      } catch (error) {
        console.error("[DEBUG] Cleanup job failed:", error);
        throw error;
      }
    });

    console.log("[DEBUG] Worker registered, scheduling recurring job");

    // Then schedule recurring work with proper type handling
    const scheduleJob = async () => {
      try {
        await scheduler.send(JOB_NAME, {
          type: 'cleanup',
          timestamp: new Date().toISOString()
        });
        console.log("[DEBUG] Scheduled new cleanup job");
      } catch (error) {
        console.error("[DEBUG] Failed to schedule cleanup job:", error);
      }
    };

    // Schedule initial job and set up interval
    await scheduleJob();
    setInterval(scheduleJob, CLEANUP_INTERVAL);

    console.log("[DEBUG] Guest cleanup worker fully registered");
    return true;
  } catch (error) {
    console.error("[DEBUG] Failed to register guest cleanup worker:", error);
    throw error;
  }
}

export async function triggerGuestCleanup() {
  console.log("[DEBUG] Manually triggering guest cleanup");
  return scheduler.send(JOB_NAME, {
    type: 'manualCleanup',
    timestamp: new Date().toISOString()
  });
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { emitter } from "~/utils/emitter/emitter.server";
import { ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";
import { json, redirect } from "@remix-run/node";


export function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  
  // Check if this is a Discord user (numeric ID) or guest user
  const isDiscordUser = authSession?.userId && /^\d+$/.test(authSession.userId);
  const isGuestUser = authSession?.userId?.startsWith('guest-');
  
  // CRITICAL FIX: Bypass the built-in auth check for Discord users
  // For Discord users, we need to bypass the authentication check
  // that would otherwise redirect to login
  if (!context.isAuthenticated) {
    // Allow Discord users despite failing regular auth
    if (isDiscordUser) {
      console.log("[DEBUG] Allowing Discord user to bypass auth check:", authSession.userId);
    } 
    // Allow guest users to connect
    else if (isGuestUser) {
      console.log("[DEBUG] Allowing guest user to bypass auth check:", authSession.userId);
    }
    // All other non-authenticated users get redirected
    else {
      return redirect("/login");
    }
  }
  
  return eventStream(request.signal, function setup(send) {
    /** Notification is a stringified json object with the shape {@link Notification} */
    function handle(notification: string) {
      /** We only send the notification if the logged in userId is the same as the senderId.
       * We do this to prevent other users receiving notifications
       */
      try {
        const parsedNotification = JSON.parse(notification);
        
        // For Discord users, we need to match the Discord ID
        if (isDiscordUser && authSession.userId === parsedNotification.senderId) {
          send({ event: "new-notification", data: notification });
          return;
        }
        
        // For guest and regular users, use the normal check
        if (authSession.userId === parsedNotification.senderId) {
          send({ event: "new-notification", data: notification });
          return;
        }
      } catch (cause) {
        /**
         * node:92658) UnsupportedWarning: The provided connection header is not valid, the value will be dropped from the header and will never be in use.
         * This is 'expected'
         * sse wants 0 headers lol (they are removed in Remix Express). Can't do that for Hono since reading response consume the ReadableStream :/
         */
        if (
          cause instanceof Error &&
          cause.message.match(/Controller is already closed/)
        ) {
          return;
        }

        Logger.error(
          new ShelfError({
            cause,
            message: "Failed to send SSE notification",
            additionalData: { 
              userId: authSession.userId,
              isDiscordUser,
              isGuestUser
            },
            label: "Notification",
          })
        );
      }
    }
    
    emitter.on("notification", handle);

    return function clear() {
      emitter.off("notification", handle);
    };
  });
}
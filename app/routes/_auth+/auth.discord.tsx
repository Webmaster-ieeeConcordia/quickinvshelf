import { useEffect } from "react";
import type { ActionFunction } from "@remix-run/node"; // Removed unused LoaderFunction
import { useNavigate } from "@remix-run/react";
import { createClient } from "@supabase/supabase-js";

// Fixed the action function to be properly async and return something
export const action: ActionFunction = async () => 
   null // Add proper return since the function is async
;

export default function AuthDiscord() {
  const navigate = useNavigate();
  
  const getSupabaseClient = () => {
    const supabaseUrl = "https://hpomwaswotwqhvqitjwl.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwb213YXN3b3R3cWh2cWl0andsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1NDUyNzAsImV4cCI6MjA1MjEyMTI3MH0.KPLlbsfDvq-i1J6nEh50qXmG2j7fYnzdGCDA46gwrUo";
    
    // Using a logger function to handle console logs (can be removed in production)
    const logger = (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(message, data);
      }
    };

    logger("Initializing Supabase with:", {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey
    });
  
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are missing.");
    }
  
    return createClient(supabaseUrl, supabaseAnonKey);
  };

  useEffect(() => {
    const logger = (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(message, data);
      }
    };
    const initiateDiscordAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const redirectTo = `${window.location.origin}/oauth/callback`;
  
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: {
            redirectTo,
            scopes: "identify email guilds",
          },
        });
  
        if (error) {
          logger("OAuth Error:", error);
          return navigate("/login?error=oauth");
        }
  
        if (!data?.url) {
          logger("No OAuth URL generated");
          return navigate("/login?error=no-url");
        }
  
        logger("Generated OAuth URL:", data.url);
        window.location.href = data.url;
      } catch (error) {
        logger("Unexpected error:", error);
        navigate("/login?error=unexpected");
      }
    };
  
    void initiateDiscordAuth(); // Added void operator to handle the Promise
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-lg font-semibold">Redirecting to Discord...</h1>
      <p className="text-sm text-gray-500">
        Please wait while we connect you to Discord for authentication.
      </p>
    </div>
  );
}
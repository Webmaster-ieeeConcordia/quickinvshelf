import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";

export function OAuthFragmentHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's an access_token in the URL hash
    if (window.location.hash && window.location.hash.includes('access_token')) {
      console.log('[DEBUG] Found OAuth tokens in URL hash, processing...');
      
      const fragment = window.location.hash.substring(1);
      const params = new URLSearchParams(fragment);
      
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresIn = params.get('expires_in');
      const expiresAt = params.get('expires_at');
      
      if (accessToken && refreshToken && expiresIn) {
        // Create form data
        const formData = new FormData();
        formData.append('access_token', accessToken);
        formData.append('refresh_token', refreshToken);
        formData.append('expires_in', expiresIn);
        if (expiresAt) formData.append('expires_at', expiresAt);
        
        // Post directly to the callback endpoint
        fetch('/oauth/callback', {
          method: 'POST',
          body: formData
        }).then(response => {
          console.log('[DEBUG] Auth token processing result:', response.status);
          if (response.redirected) {
            window.location.href = response.url;
          } else {
            // Remove hash and reload page
            window.location.href = window.location.pathname;
          }
        }).catch(err => {
          console.error('[DEBUG] Auth processing error:', err);
          // Remove hash from URL and reload
          window.location.href = window.location.pathname;
        });
      }
    }
  }, []);

  return null;
}
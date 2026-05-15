const FALLBACK_API_KEY = process.env.GROQ_API_KEY_FALLBACK;

/**
 * Enhanced fetch wrapper for Groq API that handles automatic fallback
 * if the primary API key is rate-limited or fails.
 */
export async function groqFetch(url: string, options: RequestInit) {
  const primaryApiKey = process.env.GROQ_API_KEY;
  const fallbackApiKey = process.env.GROQ_API_KEY_FALLBACK || FALLBACK_API_KEY;

  // Clone options to avoid mutating the original object
  const requestOptions = { ...options };
  
  // Ensure headers exist
  requestOptions.headers = {
    ...requestOptions.headers,
    'Authorization': `Bearer ${primaryApiKey}`,
  };

  let response = await fetch(url, requestOptions);

  // If primary fails with rate limit (429), auth error (401), or server error (5xx)
  if (!response.ok && (response.status === 429 || response.status === 401 || response.status >= 500)) {
    const errorText = await response.text();
    console.warn(`[Groq Fetch] Primary key failed (${response.status}). Error: ${errorText.substring(0, 100)}...`);
    
    console.log("[Groq Fetch] Attempting fallback with secondary API key...");
    
    const fallbackOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${fallbackApiKey}`,
        'Content-Type': 'application/json',
      }
    };

    response = await fetch(url, fallbackOptions);
    
    if (response.ok) {
      console.log("[Groq Fetch] Fallback successful.");
    } else {
      console.error(`[Groq Fetch] Fallback also failed (${response.status}).`);
    }
  }

  return response;
}

import type { APIRoute } from 'astro';

/**
 * Handles user logout by clearing the session cookie
 * POST: Terminates user session and redirects to home page
 */
export const POST: APIRoute = async ({ redirect }) => {
  try {
    // Create response with redirect
    const response = redirect('/?logout=success');
    
    // Clear the session cookie by setting it to expire immediately
    response.headers.set(
      'Set-Cookie',
      'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    );

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, we should still clear the cookie and redirect
    const response = redirect('/?error=logout_failed');
    response.headers.set(
      'Set-Cookie',
      'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    );
    
    return response;
  }
};

/**
 * GET method for logout (for convenience, though POST is preferred)
 */
export const GET: APIRoute = async ({ redirect }) => {
  // Redirect GET requests to use POST method
  return redirect('/', 302);
};
import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { createClient } from '../../../db/supabase';
import { createAuthSession, getSessionCookieOptions } from '../../../lib/auth';
import { ValidationError, AuthenticationError } from '../../../types';
import type { User } from '../../../types';

const oauth2Client = new google.auth.OAuth2(
  import.meta.env.GOOGLE_CLIENT_ID,
  import.meta.env.GOOGLE_CLIENT_SECRET,
  `${import.meta.env.NEXTAUTH_URL}/api/auth/google`
);

/**
 * Handles Google OAuth authentication flow
 * GET: Redirects to Google OAuth consent screen
 * POST: Handles OAuth callback and creates/updates user session
 */
export const GET: APIRoute = async ({ url, redirect }) => {
  try {
    // Generate the OAuth URL with required scopes
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      include_granted_scopes: true,
    });

    return redirect(authUrl);
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to initiate authentication',
        message: 'Unable to connect to Google OAuth service'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return redirect('/?error=oauth_denied');
    }

    if (!code) {
      throw new ValidationError('Authorization code is required');
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user information from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.id || !googleUser.email || !googleUser.name) {
      throw new AuthenticationError('Incomplete user information from Google');
    }

    // Create or update user in Supabase
    const supabase = createClient();
    
    // First, try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleUser.id)
      .single();

    let user: User;

    if (existingUser && !findError) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          email: googleUser.email,
          name: googleUser.name,
          avatar_url: googleUser.picture || null,
          updated_at: new Date().toISOString(),
        })
        .eq('google_id', googleUser.id)
        .select()
        .single();

      if (updateError || !updatedUser) {
        console.error('Error updating user:', updateError);
        throw new AuthenticationError('Failed to update user information');
      }

      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          google_id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          avatar_url: googleUser.picture || null,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        throw new AuthenticationError('Failed to create user account');
      }

      user = newUser;
    }

    // Create authentication session
    const session = createAuthSession(
      user,
      tokens.access_token || '',
      3600 // 1 hour
    );

    // Set secure session cookie
    const cookieOptions = getSessionCookieOptions(
      import.meta.env.NODE_ENV === 'production'
    );

    const response = redirect('/?auth=success');
    
    // Set session cookie
    response.headers.set(
      'Set-Cookie',
      `session=${JSON.stringify(session)}; ${Object.entries(cookieOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`
    );

    return response;

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof ValidationError) {
      return redirect('/?error=invalid_request');
    }
    
    if (error instanceof AuthenticationError) {
      return redirect('/?error=auth_failed');
    }

    return redirect('/?error=server_error');
  }
};
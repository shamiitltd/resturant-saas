import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Supabase admin credentials missing' },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Find user by email
    const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json(
        { error: listError.message || 'Failed to list users' },
        { status: 500 }
      );
    }

    const targetUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (!targetUser) {
      return NextResponse.json(
        { error: `No registered account found with email ${cleanEmail}` },
        { status: 404 }
      );
    }

    // 2. Update user's password directly via Supabase Admin
    const { error: updateError } = await admin.auth.admin.updateUserById(
      targetUser.id,
      { password }
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update user password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password for ${cleanEmail} has been updated successfully!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error during password reset' },
      { status: 500 }
    );
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Tangani preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Hanya menerima POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // 1. Ambil token dari header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    // 2. Buat Supabase client dengan token user (untuk cek role admin)
    const supabaseAdminUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseAdminUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 3. Dapatkan data user dari token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized: invalid token");

    // 4. Cek apakah user memiliki role admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.role !== "admin") throw new Error("Forbidden: admin only");

    // 5. Parsing request body
    const { email, new_password } = await req.json();
    if (!email || !new_password || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Email and password (min 6 chars) required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 6. Gunakan admin client dengan service_role key untuk mengubah password
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseAdminUrl, serviceRoleKey);

    // Cari user berdasarkan email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw new Error("Failed to list users: " + listError.message);
    const targetUser = users.find((u) => u.email === email);
    if (!targetUser) throw new Error(`User with email ${email} not found`);

    // Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
      password: new_password,
    });
    if (updateError) throw new Error("Failed to update password: " + updateError.message);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Error in reset-user-password:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
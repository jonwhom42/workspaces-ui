const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('*')
    .limit(10);

  console.log('Workspaces error:', workspacesError);
  console.log('Workspaces data:', workspaces);

  const { data: memberships, error: membershipsError } = await supabase
    .from('workspace_members')
    .select('*')
    .limit(20);

  console.log('Memberships error:', membershipsError);
  console.log('Memberships data:', memberships);
}

main().catch((error) => {
  console.error('Unexpected debug error', error);
  process.exit(1);
});

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type StaffPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function messageUrl(type: 'success' | 'error', message: string) {
  return `/admin/staff?${type}=${encodeURIComponent(message)}`;
}

type AuthUserRow = {
  id: string;
  email: string;
  created_at: string | null;
  role: string;
};

export default async function AdminStaffPage({
  searchParams,
}: StaffPageProps) {
  const currentProfile = await requireRole(['admin']);
  const params = searchParams ? await searchParams : undefined;
  const success = params?.success ?? '';
  const error = params?.error ?? '';

  const supabaseAdmin = getSupabaseAdmin();

  const { data: authListData, error: authListError } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (authListError) {
    throw new Error(`Failed to load staff users: ${authListError.message}`);
  }

  const authUsers = authListData?.users ?? [];
  const authUserIds = authUsers.map((user) => user.id);

  const { data: profiles, error: profilesError } = authUserIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, email, role, created_at')
        .in('id', authUserIds)
    : { data: [], error: null as null | { message: string } };

  if (profilesError) {
    throw new Error(`Failed to load staff profiles: ${profilesError.message}`);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const rows: AuthUserRow[] = authUsers
    .map((user) => {
      const profile = profileMap.get(user.id);

      return {
        id: user.id,
        email: user.email ?? profile?.email ?? '',
        created_at: profile?.created_at ?? user.created_at ?? null,
        role: profile?.role ?? 'desk',
      };
    })
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

  async function createStaffUserAction(formData: FormData) {
    'use server';

    await requireRole(['admin']);

    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') ?? '').trim();
    const role = String(formData.get('role') ?? '').trim();

    if (!email) {
      redirect(messageUrl('error', 'Email is required.'));
    }

    if (!password || password.length < 8) {
      redirect(
        messageUrl('error', 'Password must be at least 8 characters long.')
      );
    }

    if (role !== 'desk' && role !== 'admin') {
      redirect(messageUrl('error', 'Please choose a valid role.'));
    }

    const admin = getSupabaseAdmin();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      redirect(
        messageUrl('error', error?.message || 'Failed to create staff user.')
      );
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: data.user.id,
        email,
        role,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      redirect(
        messageUrl(
          'error',
          `User created, but profile update failed: ${profileError.message}`
        )
      );
    }

    revalidatePath('/admin/staff');
    redirect(messageUrl('success', `Created ${role} user for ${email}.`));
  }

  async function updateRoleAction(formData: FormData) {
    'use server';

    await requireRole(['admin']);

    const userId = String(formData.get('userId') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const role = String(formData.get('role') ?? '').trim();

    if (!userId) {
      redirect(messageUrl('error', 'Missing user ID.'));
    }

    if (role !== 'desk' && role !== 'admin') {
      redirect(messageUrl('error', 'Please choose a valid role.'));
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin.from('profiles').upsert(
      {
        id: userId,
        email,
        role,
      },
      { onConflict: 'id' }
    );

    if (error) {
      redirect(
        messageUrl('error', `Failed to update role: ${error.message}`)
      );
    }

    revalidatePath('/admin/staff');
    redirect(messageUrl('success', `Updated role for ${email} to ${role}.`));
  }

  async function resetPasswordAction(formData: FormData) {
    'use server';

    await requireRole(['admin']);

    const userId = String(formData.get('userId') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const newPassword = String(formData.get('newPassword') ?? '').trim();

    if (!userId) {
      redirect(messageUrl('error', 'Missing user ID.'));
    }

    if (!newPassword || newPassword.length < 8) {
      redirect(
        messageUrl(
          'error',
          'New temporary password must be at least 8 characters long.'
        )
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      redirect(
        messageUrl('error', `Failed to reset password: ${error.message}`)
      );
    }

    revalidatePath('/admin/staff');
    redirect(
      messageUrl(
        'success',
        `Temporary password updated for ${email}.`
      )
    );
  }

  async function deleteStaffUserAction(formData: FormData) {
    'use server';

    const actingProfile = await requireRole(['admin']);

    const userId = String(formData.get('userId') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();

    if (!userId) {
      redirect(messageUrl('error', 'Missing user ID.'));
    }

    if (userId === actingProfile.id) {
      redirect(messageUrl('error', 'You cannot delete your own admin account.'));
    }

    const admin = getSupabaseAdmin();

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      redirect(
        messageUrl(
          'error',
          `Failed to delete auth user: ${authDeleteError.message}`
        )
      );
    }

    const { error: profileDeleteError } = await admin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      redirect(
        messageUrl(
          'error',
          `Auth user deleted, but profile cleanup failed: ${profileDeleteError.message}`
        )
      );
    }

    revalidatePath('/admin/staff');
    redirect(messageUrl('success', `Deleted user ${email}.`));
  }

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          marginBottom: '24px',
        }}
      >
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '13px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6775b4',
            fontWeight: 700,
          }}
        >
          Local Social Booking & PMS
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: '30px',
            lineHeight: 1.15,
            color: '#0f172a',
          }}
        >
          Staff Management
        </h1>

        <p
          style={{
            marginTop: '10px',
            color: '#475569',
            lineHeight: 1.6,
            maxWidth: '760px',
          }}
        >
          Create, manage, reset passwords, and delete admin or desk users.
        </p>

        {success ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            {success}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
            }}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#0f172a' }}>Create Staff User</h2>

        <form action={createStaffUserAction}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 0.8fr auto',
              gap: '14px',
              alignItems: 'end',
            }}
          >
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="frontdesk@riversendstay.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
              >
                Temporary Password
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                placeholder="At least 8 characters"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="role"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
              >
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue="desk"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                }}
              >
                <option value="desk">Desk</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                padding: '12px 18px',
                borderRadius: '999px',
                border: 'none',
                background: '#6775b4',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create User
            </button>
          </div>
        </form>
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#0f172a' }}>Existing Staff</h2>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '900px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Change Role</th>
                <th style={thStyle}>Reset Password</th>
                <th style={thStyle}>Delete</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((user) => {
                const isSelf = user.id === currentProfile.id;

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{user.email || '(no email)'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{user.id}</div>
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: user.role === 'admin' ? '#ede9fe' : '#ecfeff',
                          color: user.role === 'admin' ? '#5b21b6' : '#155e75',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString()
                        : '—'}
                    </td>

                    <td style={tdStyle}>
                      <form action={updateRoleAction} style={{ display: 'flex', gap: '8px' }}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="email" value={user.email} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          disabled={isSelf}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                          }}
                        >
                          <option value="desk">Desk</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isSelf}
                          style={secondaryButtonStyle}
                        >
                          Save
                        </button>
                      </form>
                    </td>

                    <td style={tdStyle}>
                      <form action={resetPasswordAction} style={{ display: 'flex', gap: '8px' }}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="email" value={user.email} />
                        <input
                          name="newPassword"
                          type="text"
                          placeholder="New temp password"
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            minWidth: '180px',
                          }}
                        />
                        <button type="submit" style={secondaryButtonStyle}>
                          Reset
                        </button>
                      </form>
                    </td>

                    <td style={tdStyle}>
                      <form action={deleteStaffUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="email" value={user.email} />
                        <button
                          type="submit"
                          disabled={isSelf}
                          style={{
                            ...dangerButtonStyle,
                            opacity: isSelf ? 0.5 : 1,
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '18px', color: '#64748b' }}>
                    No staff users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  fontSize: '13px',
  color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 10px',
  verticalAlign: 'top',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontWeight: 700,
  cursor: 'pointer',
};

const dangerButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '999px',
  border: 'none',
  background: '#dc2626',
  color: '#ffffff',
  fontWeight: 700,
};
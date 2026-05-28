import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decryptSession } from '@/lib/auth';
import UnifiedAdminDashboard from '@/components/UnifiedAdminDashboard';
import type { DepartmentId } from '@/lib/types';

export default async function UnifiedAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  const session = token ? await decryptSession(token) : null;

  if (!session || !session.authenticated) {
    redirect('/admin/login');
  }

  const allowed: DepartmentId[] = session.allowed_departments?.length
    ? session.allowed_departments
    : (session.department ? [session.department] : []);

  if (allowed.length === 0) {
    redirect('/admin/login');
  }

  return <UnifiedAdminDashboard allowedDepartments={allowed} />;
}

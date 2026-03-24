import { redirect } from 'next/navigation';
import { auth } from '../../../src/lib/auth/server';

export const revalidate = 0;

export default async function SignOutPage() {
    await auth.signOut();
    redirect('/');
}

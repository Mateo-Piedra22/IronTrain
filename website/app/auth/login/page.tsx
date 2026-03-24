import { redirect } from 'next/navigation';

export const revalidate = 0;

export default function LoginRedirectPage() {
    redirect('/auth/sign-in');
}

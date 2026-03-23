import { auth } from '../../../../src/lib/auth/server';

export const { GET, POST } = auth.handler() as any;

import { auth } from '../../../../src/lib/auth/server';

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();

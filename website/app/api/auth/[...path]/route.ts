import { authHandler } from '../../../../src/lib/auth/server';

export const { GET, POST, PUT, DELETE, PATCH } = authHandler.handler();

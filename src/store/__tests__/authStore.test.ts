import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../authStore';

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'irontrain://auth/callback'),
  parse: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const webBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const linking = Linking as jest.Mocked<typeof Linking>;
const mockJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isLoading: true, error: null });
    jest.clearAllMocks();
  });

  it('restores a valid session from secure storage', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    secureStore.getItemAsync.mockResolvedValue('token-123');
    mockJwtDecode.mockReturnValue({ id: 'user-1', email: 'a@b.com', exp: futureExp });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.token).toBe('token-123');
    expect(state.user?.id).toBe('user-1');
    expect(state.user?.email).toBe('a@b.com');
    expect(state.isLoading).toBe(false);
  });

  it('clears expired tokens from secure storage', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    secureStore.getItemAsync.mockResolvedValue('expired-token');
    mockJwtDecode.mockReturnValue({ id: 'user-2', email: 'b@b.com', exp: pastExp });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('irontrain_auth_token');
  });

  it('stores token and user on successful login', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const authResult: WebBrowser.WebBrowserAuthSessionResult = {
      type: 'success',
      url: 'irontrain://auth/callback?token=token-xyz',
    };
    const parsedUrl: Linking.ParsedURL = {
      scheme: 'irontrain',
      path: 'auth/callback',
      hostname: null,
      queryParams: { token: 'token-xyz' }
    };
    webBrowser.openAuthSessionAsync.mockResolvedValue(authResult);
    linking.parse.mockReturnValue(parsedUrl);
    mockJwtDecode.mockReturnValue({ id: 'user-3', email: 'c@b.com', exp: futureExp });

    await useAuthStore.getState().login();

    const state = useAuthStore.getState();
    expect(state.token).toBe('token-xyz');
    expect(state.user?.id).toBe('user-3');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('irontrain_auth_token', 'token-xyz');
  });
});

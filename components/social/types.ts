import { ThemeColors } from '@/src/theme';
import { ReactNode } from 'react';
import { createSocialStyles } from './social.styles';

export type SocialColors = ThemeColors;
export type SocialStyles = ReturnType<typeof createSocialStyles>;
export type SocialHeaderRenderer = () => ReactNode;
export type SocialMainSection = 'feed' | 'network' | 'profile';
export type SocialNetworkSection = 'ranking' | 'friends' | 'discover';
export type SocialFeedTypeFilter = 'all' | 'pr' | 'workout' | 'routine';

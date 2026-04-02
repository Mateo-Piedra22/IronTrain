import { SocialColors, SocialHeaderRenderer, SocialStyles } from '@/components/social/types';
import { SocialSearchUser } from '@/src/services/SocialService';
import { feedbackSelection } from '@/src/social/feedback';
import { FlashList } from '@shopify/flash-list';
import { Search, Sparkles, X } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SearchTabProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onSearch: () => void;
    searchResults: SocialSearchUser[];
    onSendRequest: (friendId: string) => void;
    loading: boolean;
    colors: SocialColors;
    styles: SocialStyles;
}

const SearchResultItem = React.memo(({ user, onSendRequest, colors, styles }: { user: SocialSearchUser, onSendRequest: (id: string) => void, colors: SocialColors, styles: SocialStyles }) => {
    return (
        <View style={[styles.friendRow, { marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>{(user.displayName || user.username || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{user.displayName || 'Sin nombre'}</Text>
                    <Text style={styles.friendStatus}>{user.username ? `@${user.username}` : 'Sin username público'}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.btnSmallAccept}
                onPress={() => {
                    feedbackSelection();
                    onSendRequest(user.id);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.btnSmallText}>Agregar</Text>
            </TouchableOpacity>
        </View>
    );
});

export const SearchTab = React.memo(({
    searchQuery,
    setSearchQuery,
    onSearch,
    searchResults,
    onSendRequest,
    loading,
    colors,
    styles,
    renderHeader,
    refreshing,
    onRefresh
}: SearchTabProps & { renderHeader?: SocialHeaderRenderer, refreshing?: boolean, onRefresh?: () => void }) => {

    const renderItem = useCallback(({ item }: { item: SocialSearchUser }) => (
        <SearchResultItem
            user={item}
            onSendRequest={onSendRequest}
            colors={colors}
            styles={styles}
        />
    ), [onSendRequest, colors, styles]);

    const trimmedQuery = searchQuery.trim();
    const canSearch = trimmedQuery.length >= 2;

    const listHeader = useMemo(() => (
        <View>
            {renderHeader && renderHeader()}
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color={colors.primary.DEFAULT} />
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', flex: 1 }}>
                    Buscá por nombre o @username (mínimo 2 caracteres) para enviar solicitud rápido.
                </Text>
            </View>
            <View style={styles.searchBox}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
                    <Search size={16} color={colors.textMuted} />
                </View>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por ID o username..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                        feedbackSelection();
                        onSearch();
                    }}
                />
                {!!trimmedQuery && (
                    <TouchableOpacity
                        style={[styles.archiveToggle, { minHeight: 34, marginRight: 8 }]}
                        onPress={() => {
                            feedbackSelection();
                            setSearchQuery('');
                        }}
                    >
                        <X size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.searchBtn, (!canSearch || loading) && { opacity: 0.5 }]}
                    onPress={() => {
                        feedbackSelection();
                        onSearch();
                    }}
                    disabled={loading || !canSearch}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.searchBtnText}>Buscar</Text>
                </TouchableOpacity>
            </View>
            {!loading && !!trimmedQuery && !canSearch && (
                <Text style={[styles.friendStatus, { marginBottom: 12 }]}>Ingresá al menos 2 caracteres.</Text>
            )}
            {loading && (
                <Text style={[styles.friendStatus, { marginBottom: 12 }]}>Buscando atletas...</Text>
            )}
            {!!trimmedQuery && !loading && canSearch && (
                <Text style={[styles.friendStatus, { marginBottom: 12 }]}>Resultados encontrados: {searchResults.length}</Text>
            )}
            {searchResults.length === 0 && trimmedQuery.length > 0 && !loading && canSearch && (
                <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 6 }}>
                    <Text style={styles.emptyText}>Sin resultados para "{trimmedQuery}"</Text>
                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                        Probá con menos texto o buscando solo por @username.
                    </Text>
                </View>
            )}
        </View>
    ), [renderHeader, styles, colors.border, colors.surface, colors.surfaceLighter, colors.textMuted, colors.primary.DEFAULT, searchQuery, setSearchQuery, onSearch, loading, searchResults.length, trimmedQuery, canSearch]);

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={searchResults}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={listHeader}
                keyboardShouldPersistTaps="handled"
                refreshing={refreshing}
                onRefresh={onRefresh}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});

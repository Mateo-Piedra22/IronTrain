import { SocialSearchUser } from '@/src/services/SocialService';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SearchTabProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onSearch: () => void;
    searchResults: SocialSearchUser[];
    onSendRequest: (friendId: string) => void;
    loading: boolean;
    colors: any;
    styles: any;
}

const SearchResultItem = React.memo(({ user, onSendRequest, styles }: { user: SocialSearchUser, onSendRequest: (id: string) => void, styles: any }) => {
    return (
        <View style={styles.friendRow}>
            <View>
                <Text style={styles.friendName}>{user.displayName || 'Sin nombre'}</Text>
                {user.username && <Text style={styles.friendStatus}>@{user.username}</Text>}
            </View>
            <TouchableOpacity style={styles.btnSmallAccept} onPress={() => onSendRequest(user.id)}>
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
}: SearchTabProps & { renderHeader?: any, refreshing?: boolean, onRefresh?: () => void }) => {

    const renderItem = useCallback(({ item }: { item: SocialSearchUser }) => (
        <SearchResultItem
            user={item}
            onSendRequest={onSendRequest}
            styles={styles}
        />
    ), [onSendRequest, styles]);

    const listHeader = useMemo(() => (
        <View>
            {renderHeader && renderHeader()}
            <View style={styles.searchBox}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por ID o username..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={onSearch}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
                    <Text style={styles.searchBtnText}>Buscar</Text>
                </TouchableOpacity>
            </View>
            {searchResults.length === 0 && searchQuery.trim().length > 0 && !loading && (
                <Text style={styles.emptyText}>Sin resultados para "{searchQuery.trim()}"</Text>
            )}
        </View>
    ), [renderHeader, styles, colors.textMuted, searchQuery, setSearchQuery, onSearch, loading, searchResults.length]);

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

export function buildFriendshipId(userA: string, userB: string): string {
    const [left, right] = [userA, userB].sort();
    return `friendship:${left}:${right}`;
}

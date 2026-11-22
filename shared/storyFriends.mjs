/** Only saved story characters which are not already residents need an arrival. */
export function waitingStoryFriends(characters, residents, managedAdamHome = false) {
 const ids = new Set(residents.map(r => r.id));
 return characters.filter(c => !ids.has(c.id) && !(managedAdamHome && /^adam$/i.test(c.name.trim())));
}
/** Character navigation is offered only for rewards actually saved by the claim. */
export function collectedStoryFriends(pool, characters) {
 const ids = new Set((pool || []).filter(r => r.type === 'character').map(r => r.id));
 return characters.filter(c => ids.has(c.id));
}
export const LIVING_RESIDENT_MESSAGES = new Set(['gk-profile', 'gk-residents-sync', 'gk-resident-drop', 'gk-resident-remove', 'gk-friends-waiting', 'gk-character-profile']);

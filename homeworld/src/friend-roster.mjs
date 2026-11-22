/** A selected friend stays selected; the island-life option may cycle through everyone. */
export function nextFriendWatch(choices, selectedId, index = -1) {
 if (!choices.length) return null;
 if (selectedId) return choices.find(friend => friend.id === selectedId) || null;
 return choices[(index + 1) % choices.length];
}
export function islandFriendRoster(adamUnlocked, residents = []) {
 const friends = adamUnlocked ? [{ id:'adam', name:'Adam', status:'Helping on your island' }] : [];
 for (const friend of residents) {
  if (friends.some(other => other.id === friend.id || other.name.toLowerCase() === friend.name.toLowerCase())) continue;
  friends.push(friend);
 }
 return friends;
}

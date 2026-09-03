const BLOCKED = /\b(hate|kill|stupid|idiot|dumb)\b/i;

function sanitizeKidComment(raw) {
    const comment = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 280);
    if (!comment) return { comment: '' };
    if (/https?:\/\/|www\./i.test(comment)) {
        return { error: 'Please leave a note without links.' };
    }
    if (BLOCKED.test(comment)) {
        return { error: 'Please keep your note kind and kid-safe.' };
    }
    return { comment };
}

module.exports = { sanitizeKidComment };

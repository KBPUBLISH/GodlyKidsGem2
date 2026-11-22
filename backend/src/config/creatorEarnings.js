/**
 * What a creator earns per token spent on their content.
 *
 * The historical default is 54 cents per token, derived from a ~$0.80 average
 * token price: ~$0.68 after the app store's 15%, of which the creator keeps
 * 80%. That number is now configurable rather than baked into the purchase
 * code, and an individual creator can be put on a different rate.
 *
 * Set CREATOR_CENTS_PER_TOKEN to change the platform-wide rate.
 */

const DEFAULT_CENTS_PER_TOKEN = 54;

/** The rate every creator gets unless they have their own. */
function platformCentsPerToken() {
    const configured = Number(process.env.CREATOR_CENTS_PER_TOKEN);
    return Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_CENTS_PER_TOKEN;
}

/** The rate that applies to one creator, honoring a negotiated override. */
function centsPerToken(creator) {
    const override = Number(creator?.centsPerToken);
    return Number.isFinite(override) && override > 0
        ? override
        : platformCentsPerToken();
}

/** What this sale is worth to the creator, in cents. */
function creatorEarningsCents(priceTokens, creator) {
    return Math.round((Number(priceTokens) || 0) * centsPerToken(creator));
}

module.exports = {
    DEFAULT_CENTS_PER_TOKEN,
    platformCentsPerToken,
    centsPerToken,
    creatorEarningsCents,
};

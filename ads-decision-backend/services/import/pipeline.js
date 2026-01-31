const { ingestCsv } = require('../ingestionService');
const { getNormalizer, getTableName } = require('./normalizers');

// Read the platforms once and get their Ids
// So that they dnt have to be read for every row, to get the id from name
async function resolvePlatformId(context) {
    if (!context.platformName || context.platformId) {
        return context;
    }

    const { data: platforms, error } = await supabase
        .from('platforms')
        .select('platform_id, name');

    if (error) {
        throw new Error(`Failed to load platforms: ${error.message}`);
    }

    const platformMap = {};
    for (const p of platforms) {
        platformMap[p.name.toLowerCase()] = p.platform_id;
    }

    const resolvedPlatformId =
        platformMap[context.platformName.toLowerCase()];

    if (!resolvedPlatformId) {
        throw new Error(`Unknown platform: ${context.platformName}`);
    }

    context.platformId = resolvedPlatformId;
    return context;
}


// Orchestrates streaming ingestion with per-table normalization.
// Flow: pipeline -> normalizers -> mappers -> ingestionService
async function runImportPipeline({ tableType, csvPath, context = {} }) {
    const tableName = getTableName(tableType);
    const normalizer = getNormalizer(tableType);

    if (!tableName || !normalizer) {
        throw new Error(`Invalid table type: ${tableType}`);
    }

    // ✅ Resolve platform_id ONCE (before streaming starts)
    context = await resolvePlatformId(context);

    const mapper = async (row) => {
        const normalized = await normalizer(row, context);
        if (!normalized) return null;
        if ((tableType === 'sales' || tableType === 'inventory') && context.sellerId) {
            return { ...normalized, seller_id: context.sellerId };
        }
        return normalized;
    };

    return ingestCsv(csvPath, tableName, mapper);
}

module.exports = { runImportPipeline };

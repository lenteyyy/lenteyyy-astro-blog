export const OLD_ORIGIN = 'https://www.lenteyyy.com';
export const NEW_ORIGIN = 'https://lenteyielts.cn';
export const MIGRATION_TYPE = 'lenteyielts-local-v1';
export const MAX_MIGRATION_BYTES = 4_000_000;
export const validAccount = (account) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(account);
export function allowedMigrationKey(key, account) {
    if (!validAccount(account) || key.length > 350)
        return false;
    if (['ielts-theme', 'ielts-dictation-settings-v1', 'ielts-dictation-wrong-v1'].includes(key))
        return true;
    if ([`ielts-notebook-v1:${account}`, `ielts-study-v1:${account}`, `ielts:jijing:completed:v1:${account}`, `lenteyyy-jijing-building-work-${account}`, `lenteyyy-entry-test-v1-${account}`].includes(key))
        return true;
    if (key.startsWith(`ielts:jijing:paper:v1:${account}:`))
        return /^(?:listening|reading):[a-z0-9,-]+$/.test(key.slice(`ielts:jijing:paper:v1:${account}:`.length));
    const escaped = account.replaceAll('-', '\\-');
    return new RegExp(`^lenteyyy-mock-c(?:15|16|17|18|19|20|21)-t[1-4]-(?:listening|reading|writing)-${escaped}(?:-(?:custom|simulation)-(?:listening|reading|writing)(?:[-,](?:listening|reading|writing)){0,2})?$`).test(key)
        || new RegExp(`^lenteyyy-mock-run-c(?:15|16|17|18|19|20|21)-t[1-4]-(?:single|custom|simulation)-(?:listening|reading|writing)(?:[-,](?:listening|reading|writing)){0,2}-${escaped}$`).test(key);
}
export function validateMigrationEntries(raw, account) {
    if (!validAccount(account) || !Array.isArray(raw) || raw.length > 500)
        throw Error('invalid_migration');
    const seen = new Set();
    let bytes = 0;
    return raw.map(entry => {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || !allowedMigrationKey(entry[0], account) || seen.has(entry[0]) || entry[1].length > 2_000_000)
            throw Error('invalid_migration');
        const [key, value] = entry;
        bytes += new TextEncoder().encode(key + value).length;
        if (bytes > MAX_MIGRATION_BYTES)
            throw Error('oversized_migration');
        if (key === 'ielts-theme') {
            if (!['light', 'dark'].includes(value))
                throw Error('invalid_migration');
        }
        else
            JSON.parse(value);
        seen.add(key);
        return [key, value];
    });
}

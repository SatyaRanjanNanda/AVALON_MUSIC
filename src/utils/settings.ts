import { PrismaClient } from '@prisma/client';
import config from '../config';

export interface GuildSettings {
    prefix: string;
    djRole: string | null;
    autoplay: boolean;
    defaultVolume: number;
    centralEnabled: boolean;
    centralChannelId: string | null;
    centralEmbedId: string | null;
    centralVcChannelId: string | null;
    centralAllowedRoles: string[];
}

export function defaultSettings(): GuildSettings {
    return {
        prefix: config.bot.prefix,
        djRole: null,
        autoplay: false,
        defaultVolume: 100,
        centralEnabled: false,
        centralChannelId: null,
        centralEmbedId: null,
        centralVcChannelId: null,
        centralAllowedRoles: []
    };
}

export class SettingsStore {
    private cache = new Map<string, GuildSettings>();
    private dbAvailable: boolean | null = null;
    private prisma: PrismaClient | null = null;

    private getDb(): PrismaClient {
        if (!this.prisma) {
            this.prisma = new PrismaClient();
        }
        return this.prisma;
    }

    async init(): Promise<void> {
        if (!config.database.url) {
            this.dbAvailable = false;
            console.log('[settings] No DATABASE_URL provided - using in-memory settings.');
            return;
        }
        try {
            await this.getDb().$queryRaw`SELECT 1`;
            this.dbAvailable = true;
            console.log('[settings] Database connection established.');
        } catch (error) {
            this.dbAvailable = false;
            console.log('[settings] Database unavailable - using in-memory settings. ' + ((error as Error)?.message || error));
        }
    }

    private toSettings(row: {
        prefix: string;
        djRole: string | null;
        autoplay: boolean;
        defaultVolume: number;
        centralEnabled: boolean;
        centralChannelId: string | null;
        centralEmbedId: string | null;
        centralVcChannelId: string | null;
        centralAllowedRoles: string[];
    }): GuildSettings {
        return {
            prefix: row.prefix,
            djRole: row.djRole,
            autoplay: row.autoplay,
            defaultVolume: row.defaultVolume,
            centralEnabled: row.centralEnabled,
            centralChannelId: row.centralChannelId,
            centralEmbedId: row.centralEmbedId,
            centralVcChannelId: row.centralVcChannelId,
            centralAllowedRoles: row.centralAllowedRoles || []
        };
    }

    async get(guildId: string): Promise<GuildSettings> {
        const cached = this.cache.get(guildId);
        if (cached) return cached;

        const fallback = defaultSettings();
        this.cache.set(guildId, fallback);

        if (!this.dbAvailable) return fallback;

        try {
            const row = await this.getDb().guildSettings.findUnique({ where: { id: guildId } });
            if (row) {
                const settings = this.toSettings(row);
                this.cache.set(guildId, settings);
                return settings;
            }
            await this.getDb().guildSettings.upsert({
                where: { id: guildId },
                create: { id: guildId },
                update: {}
            });
        } catch (error) {
            this.dbAvailable = false;
        }
        return fallback;
    }

    async set(guildId: string, patch: Partial<GuildSettings>): Promise<GuildSettings> {
        const current = await this.get(guildId);
        const updated = { ...current, ...patch };
        this.cache.set(guildId, updated);

        if (this.dbAvailable) {
            try {
                await this.getDb().guildSettings.upsert({
                    where: { id: guildId },
                    create: {
                        id: guildId,
                        prefix: updated.prefix,
                        djRole: updated.djRole,
                        autoplay: updated.autoplay,
                        defaultVolume: updated.defaultVolume,
                        centralEnabled: updated.centralEnabled,
                        centralChannelId: updated.centralChannelId,
                        centralEmbedId: updated.centralEmbedId,
                        centralVcChannelId: updated.centralVcChannelId,
                        centralAllowedRoles: updated.centralAllowedRoles
                    },
                    update: {
                        prefix: updated.prefix,
                        djRole: updated.djRole,
                        autoplay: updated.autoplay,
                        defaultVolume: updated.defaultVolume,
                        centralEnabled: updated.centralEnabled,
                        centralChannelId: updated.centralChannelId,
                        centralEmbedId: updated.centralEmbedId,
                        centralVcChannelId: updated.centralVcChannelId,
                        centralAllowedRoles: updated.centralAllowedRoles
                    }
                });
            } catch {
                /* keep in-memory */
            }
        }

        return updated;
    }

    async allCentralEnabled(): Promise<{ guildId: string; settings: GuildSettings }[]> {
        if (!this.dbAvailable) {
            const results: { guildId: string; settings: GuildSettings }[] = [];
            for (const [guildId, settings] of this.cache.entries()) {
                if (settings.centralEnabled) results.push({ guildId, settings });
            }
            return results;
        }
        try {
            const rows = await this.getDb().guildSettings.findMany({ where: { centralEnabled: true } });
            return rows.map((row) => ({ guildId: row.id, settings: this.toSettings(row) }));
        } catch {
            return [];
        }
    }
}

const settingsStore = new SettingsStore();
export { settingsStore };
export default settingsStore;
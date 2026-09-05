import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { LavalinkNode } from 'riffy';

dotenv.config();

export interface LavalinkNodeEntry {
    name: string;
    host: string;
    port: number;
    password: string;
    secure: boolean;
}

function loadLavalinkNodes(): LavalinkNode[] {
    const nodes: LavalinkNode[] = [];

    const jsonPath = path.resolve(process.cwd(), 'lavalink-nodes.json');
    if (fs.existsSync(jsonPath)) {
        try {
            const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as LavalinkNodeEntry[];
            for (const entry of entries) {
                nodes.push({
                    name: entry.name || `${entry.host}:${entry.port}`,
                    host: entry.host,
                    port: entry.port,
                    password: entry.password || '',
                    secure: !!entry.secure
                });
            }
        } catch (error) {
            console.error('[config] Invalid lavalink-nodes.json:', error);
        }
    }

    if (nodes.length === 0) {
        const envUrl = (process.env.LAVALINK_URL || '').replace(/['"]/g, '').trim();
        if (envUrl) {
            const [host, portStr] = envUrl.split(':');
            nodes.push({
                name: process.env.LAVALINK_NODE_NAME || 'Env Fallback Node',
                host,
                port: parseInt(portStr || '443', 10),
                password: (process.env.LAVALINK_AUTH || '').replace(/['"]/g, '').trim(),
                secure: (process.env.LAVALINK_SECURE || '').trim().toLowerCase() === 'true'
            });
        }
    }

    if (nodes.length === 0) {
        nodes.push({
            name: 'Fallback Node',
            host: 'de-01.strixnodes.com',
            port: 2010,
            password: 'glace',
            secure: false
        });
    }

    return nodes;
}

export const config = {
    discord: {
        token: process.env.DISCORD_TOKEN || process.env.TOKEN || ''
    },
    bot: {
        prefix: process.env.BOT_PREFIX || '!',
        embedColor: 0x9966ff,
        supportServer: 'https://discord.gg/xQF9f9yUEM',
        ownerIds: (process.env.OWNER_IDS || '1004206704994566164').split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        defaultStatus: '🎵 Ready for music!',
        showNowPlaying: (process.env.SHOW_NOW_PLAYING || 'true').toLowerCase() !== 'false'
    },
    database: {
        url: process.env.DATABASE_URL || ''
    },
    lavalink: {
        nodes: loadLavalinkNodes(),
        defaultSearchPlatform: (process.env.DEFAULT_SEARCH_PLATFORM as 'ytmsearch' | 'ytsearch' | 'scsearch' | 'spsearch') || 'ytmsearch'
    },
    keepAlive: {
        healthUrl: process.env.HEALTH_URL || '',
        healthPort: parseInt(process.env.PORT || '3000', 10)
    }
};

export default config;
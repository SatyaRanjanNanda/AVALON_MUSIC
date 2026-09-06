import type { Client } from 'discord.js';
import type { Player, Riffy, Track } from 'riffy';
import { client, riffy, status } from '../core';
import type { LoopMode, PlayerAppState, PlayerSnapshot, ResolvedTracks } from '../types';
import type { CentralEmbedHandler } from '../utils/centralEmbed';
import type { SettingsStore } from '../utils/settings';
import { buildNowPlayingPanel } from '../utils/panel';
import config from '../config';

export type PlayResult =
    | { type: 'playlist'; tracksCount: number; name: string }
    | { type: 'track'; track: Track }
    | { type: 'error'; message: string };

const FALLBACK_SEARCH_PLATFORMS = ['scsearch', 'ytsearch', 'spsearch', 'amsearch'];
const NODE_REQUEST_TIMEOUT_MS = 15000;

interface FallbackResolveResult {
    loadType: string | null;
    tracks: Track[];
    playlistInfo: { name?: string | null } | null;
    exception?: any;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Lavalink request timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export class PlayerManager {
    private client: Client;
    private central: CentralEmbedHandler;
    private settingsStore: SettingsStore;
    private states = new Map<string, PlayerAppState>();

    constructor(client: Client, central: CentralEmbedHandler, settingsStore: SettingsStore) {
        this.client = client;
        this.central = central;
        this.settingsStore = settingsStore;
    }

    getState(guildId: string): PlayerAppState | null | undefined {
        return this.states.get(guildId);
    }

    getPlayer(guildId: string): Player | undefined {
        return riffy.players.get(guildId);
    }

    private connectedNodes(): any[] {
        return Array.from(riffy.nodeMap.values())
            .filter((n) => n.connected && n.sessionId)
            .sort((a, b) => (a.penalties || 0) - (b.penalties || 0));
    }

    async createPlayer(
        guildId: string,
        voiceChannelId: string,
        textChannelId: string
    ): Promise<Player | null> {
        try {
            let player = this.getPlayer(guildId);

            if (player) {
                if (player.voiceChannel === voiceChannelId) {
                    return player;
                }
                player.setVoiceChannel(voiceChannelId);
                return player;
            }

            const serverSettings = await this.settingsStore.get(guildId);
            if (!this.states.has(guildId)) {
                this.states.set(guildId, { nowPlayingMessageId: null, textChannelId, lastFilter: null });
            }

            let bestNode = Array.from(riffy.nodeMap.values())
                .filter((n) => n.connected)
                .sort((a, b) => (a.penalties || 0) - (b.penalties || 0))[0];

            if (!bestNode) {
                // Fallback to Riffy's built-in leastUsedNodes if manual sort fails
                const leastUsed = (riffy as any).leastUsedNodes;
                if (leastUsed && leastUsed.length > 0) {
                    bestNode = riffy.nodeMap.get(leastUsed[0].name) as any;
                }
            }

            if (!bestNode) {
                throw new Error("No connected Lavalink nodes are available!");
            }

            player = riffy.createPlayer(bestNode as any, {
                guildId,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
                deaf: true,
                defaultVolume: serverSettings.defaultVolume
            });

            return player;
        } catch (error) {
            console.error('Player creation error:', (error as Error)?.message || error);
            return null;
        }
    }

    async playSong(player: Player, query: string, requester: unknown): Promise<PlayResult> {
        try {
            if (!player) return { type: 'error', message: 'Player not available' };

            this.recordLastQuery(player, query, requester);

            const resolve = await this.resolveWithFallback(query, requester);
            const { loadType, tracks, playlistInfo, exception } = resolve;

            if (loadType === 'playlist') {
                for (const track of tracks) {
                    if (track && track.info) {
                        track.info.requester = requester;
                        player.queue.add(track);
                    }
                }
                if (!player.playing && !player.paused) {
                    await player.play();
                }
                return { type: 'playlist', tracksCount: tracks.length, name: playlistInfo?.name || 'Unknown Playlist' };
            }

            if (loadType === 'search' || loadType === 'track') {
                const track = loadType === 'search' ? this.pickBestTrack(tracks, query) : tracks[0];
                if (!track || !track.info) {
                    return { type: 'error', message: 'No results found for that query' };
                }
                track.info.requester = requester;
                player.queue.add(track);
                if (!player.playing && !player.paused) {
                    await player.play();
                }
                return { type: 'track', track };
            }

            const reason =
                exception &&
                typeof exception === 'object' &&
                exception.message
                    ? exception.message
                    : 'No results found for that query. Try a direct YouTube/SoundCloud URL.';
            return { type: 'error', message: reason };
        } catch (error) {
            console.error('Play song error:', (error as Error)?.message || error);
            return { type: 'error', message: 'Failed to play song' };
        }
    }

    private recordLastQuery(player: Player, query: string, requester: unknown): void {
        if (/^https?:\/\//i.test(query.trim())) return;
        const state = this.states.get(player.guildId);
        if (!state) return;
        state.lastQuery = query;
        state.lastRequester = requester;
        state.failsafePending = false;
        state.recoveries = 0;
    }

    private async resolveSoundCloud(query: string, requester: unknown): Promise<Track | null> {
        const searchTerm = query
            .trim()
            .replace(/^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/i, '');
        if (!searchTerm) return null;

        const nodes = this.connectedNodes();
        for (const node of nodes) {
            try {
                const result = await withTimeout(
                    riffy.resolve({ query: searchTerm, source: 'scsearch', requester, node }),
                    NODE_REQUEST_TIMEOUT_MS
                );
                const { loadType, tracks } = result;
                if (loadType === 'track' || (loadType === 'search' && tracks.length > 0)) {
                    const track = loadType === 'track' ? tracks[0] : this.pickBestTrack(tracks, query);
                    if (track?.info?.sourceName === 'soundcloud') return track;
                }
            } catch (error) {
                console.error(`SoundCloud failsafe error on ${node.name}:`, (error as Error)?.message || error);
            }
        }
        return null;
    }

    private async recoverPlayerFailure(player: Player): Promise<void> {
        const state = this.states.get(player.guildId);
        if (!state || !state.failsafePending) return;

        const maxRecoveries = 2;
        const attempt = (state.recoveries || 0) + 1;
        if (attempt > maxRecoveries) {
            state.failsafePending = false;
            console.warn(`⚠️ Giving up on ${player.guildId} after ${maxRecoveries} recovery attempts, keeping bot in VC.`);
            return;
        }

        state.failsafePending = false;
        state.recoveries = attempt;
        console.log(`🔄 Recovery attempt #${attempt} in ${player.guildId}...`);

        if (player.queue.length > 0) {
            console.log(`🔄 ${player.guildId} already has queued tracks, skipping recovery.`);
            return;
        }

        if (state.lastQuery) {
            const requester = state.lastRequester ?? null;
            const scTrack = await this.resolveSoundCloud(state.lastQuery, requester);
            if (scTrack) {
                try {
                    scTrack.info.requester = requester;
                    player.queue.add(scTrack);
                    if (!player.playing && !player.paused) {
                        await player.play().catch(() => undefined);
                    }
                    console.log(`🎵 SoundCloud failsafe playing: ${scTrack.info?.title || 'Unknown'} in ${player.guildId}`);
                    return;
                } catch (error) {
                    console.warn('🔄 SoundCloud failsafe play failed:', (error as Error)?.message || error);
                }
            }
        }

        console.warn(`⚠️ Recovery failed for ${player.guildId}, keeping bot in VC.`);
    }

    private pickBestTrack(tracks: Track[], query: string): Track | undefined {
        if (tracks.length <= 1) return tracks[0];

        const q = query.toLowerCase();
        const tagWords = ['remix', 'instrumental', 'karaoke', 'cover', 'slowed', 'sped up', 'reverb', 'extended', 'nightcore', 'acoustic', 'mashup', 'megamix', '8d audio', 'bass boost', 'relaxing'];
        const tagRegex = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requestedTags = tagWords.filter((tag) => q.includes(tag));
        const penalizedTags = tagWords.filter((tag) => !requestedTags.includes(tag));
        const badTags = new RegExp(`(${penalizedTags.map(tagRegex).join('|')})`);
        const goodTags = /\b(official|official audio|official video|audio)\b/;

        let best: Track | undefined = tracks[0];
        let bestScore = -Infinity;

        for (let i = 0; i < Math.min(tracks.length, 15); i++) {
            const track = tracks[i];
            const title = (track?.info?.title || '').toLowerCase();
            const author = (track?.info?.author || '').toLowerCase();

            let score = 1000 - i * 12;
            if (penalizedTags.length > 0 && badTags.test(title)) score -= 450;
            if (requestedTags.length > 0) {
                const titleTags = requestedTags.filter((tag) => title.includes(tag)).length;
                score += titleTags * 200;
            }
            if (goodTags.test(title)) score += 120;
            if (author && q.length > 3 && (q.includes(author) || author.includes(q))) score += 80;

            const words = q.split(/\s+/).filter((w) => w.length > 3);
            const matched = words.filter((w) => title.includes(w)).length;
            score += matched * 40;
            if (title === q) score += 200;

            if (score > bestScore) {
                bestScore = score;
                best = track;
            }
        }

        return best;
    }

    private async resolveWithFallback(query: string, requester: unknown): Promise<FallbackResolveResult> {
        const trimmed = query.trim();
        if (/^https?:\/\//i.test(trimmed)) {
            try {
                return await withTimeout(riffy.resolve({ query: trimmed, requester }), NODE_REQUEST_TIMEOUT_MS);
            } catch (error) {
                console.error('Direct URL resolve error:', (error as Error)?.message || error);
                return { loadType: 'empty', tracks: [], playlistInfo: { name: '' } };
            }
        }

        const searchTerm = trimmed.replace(
            /^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/i,
            ''
        );
        const platforms = [...new Set([config.lavalink.defaultSearchPlatform, ...FALLBACK_SEARCH_PLATFORMS])];
        const attempts: string[] = [];
        const nodes = this.connectedNodes();

        for (const node of nodes) {
            for (const platform of platforms) {
                try {
                    const result = await withTimeout(
                        riffy.resolve({ query: searchTerm, source: platform, requester, node }),
                        NODE_REQUEST_TIMEOUT_MS
                    );
                    const { loadType, tracks } = result;
                    if (loadType === 'playlist' || ((loadType === 'track' || loadType === 'search') && tracks.length > 0)) {
                        return result;
                    }
                    attempts.push(`${platform}(${node.name}: ${loadType || 'empty'})`);
                    if (loadType === 'error' && result.exception) {
                        const message =
                            typeof result.exception === 'string'
                                ? result.exception
                                : (result.exception as { message?: string })?.message;
                        console.error(`Search error on ${platform} via ${node.name} ("${searchTerm}"): ${message || 'unknown'}`);
                    }
                } catch (error) {
                    attempts.push(`${platform}(${node.name}: error)`);
                    console.error(`Search error on ${platform} via ${node.name}:`, (error as Error)?.message || error);
                }
            }
        }

        return {
            loadType: 'empty',
            tracks: [],
            playlistInfo: { name: '' },
            exception: {
                message: attempts.length > 0 ? `Search failed across all platforms/nodes (${attempts.join(', ')})` : 'Search failed: no platforms attempted'
            }
        };
    }

    async resolve(query: string): Promise<ResolvedTracks> {
        try {
            const response = await this.resolveWithFallback(query, null);
            if (!response || !response.tracks) {
                return { loadType: 'error', tracks: [], name: null };
            }
            const { loadType, tracks, playlistInfo } = response;
            if (loadType === 'playlist') {
                return { loadType: 'playlist', tracks, name: playlistInfo?.name || null };
            }
            if (loadType === 'search' || loadType === 'track') {
                return { loadType, tracks, name: null };
            }
            return { loadType: 'empty', tracks: [], name: null };
        } catch (error) {
            console.error('Resolve error:', (error as Error)?.message || error);
            return { loadType: 'error', tracks: [], name: null };
        }
    }

    private getThumbnailSafely(track: Track): string | null {
        if (typeof track.info.thumbnail === 'string' && track.info.thumbnail.trim() !== '') {
            return track.info.thumbnail;
        }
        if (track.info.identifier && track.info.sourceName === 'youtube') {
            return `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`;
        }
        return null;
    }

    async getPlayerInfo(guildId: string): Promise<PlayerSnapshot | null> {
        try {
            const player = this.getPlayer(guildId);
            if (!player || !player.current || !player.current.info) return null;

            const thumbnail = this.getThumbnailSafely(player.current);

            return {
                title: player.current.info.title || 'Unknown Title',
                author: player.current.info.author || 'Unknown Artist',
                duration: player.current.info.length || 0,
                thumbnail,
                requester: player.current.info.requester ?? null,
                playing: player.playing || false,
                paused: player.paused || false,
                position: player.position || 0,
                volume: player.volume || 50,
                loop: (player.loop as LoopMode) || 'none',
                autoplay: !!player.isAutoplay,
                queueLength: player.queue.size || 0
            };
        } catch (error) {
            console.error('Get player info error:', (error as Error)?.message || error);
            return null;
        }
    }

    async sendNowPlaying(guildId: string, snapshot: PlayerSnapshot): Promise<void> {
        const state = this.states.get(guildId);
        if (!state) return;

        const serverSettings = await this.settingsStore.get(guildId).catch(() => null);
        if (serverSettings?.centralEnabled && serverSettings.centralChannelId === state.textChannelId) return;

        const channel = this.client.channels.cache.get(state.textChannelId);
        if (!channel || !('send' in channel)) return;

        const panel = buildNowPlayingPanel(snapshot);

        if (state.nowPlayingMessageId) {
            const cached = await channel.messages.fetch(state.nowPlayingMessageId).catch(() => null);
            if (cached) {
                await cached.edit(panel).catch(() => undefined);
                return;
            }
        }

        try {
            const message = await channel.send(panel);
            state.nowPlayingMessageId = message.id;
        } catch {
            /* noop */
        }
    }

    async refreshPlayer(guildId: string): Promise<void> {
        const snapshot = await this.getPlayerInfo(guildId);
        if (!snapshot) return;

        const serverSettings = await this.settingsStore.get(guildId);
        await this.central.updateCentralEmbed(guildId, serverSettings, snapshot);

        if (config.bot.showNowPlaying) {
            await this.sendNowPlaying(guildId, snapshot);
        }

        if (status) await status.onTrackStart(guildId);
    }

    async skip(guildId: string): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        player.stop();
        return true;
    }

    async pause(guildId: string, paused?: boolean): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player || !player.current) return false;
        await player.pause(paused ?? !player.paused);
        return true;
    }

    async stop(guildId: string): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        player.queue.clear();
        await this.destroy(guildId);
        return true;
    }

    async updateNowPlaying(guildId: string): Promise<void> {
        await this.refreshPlayer(guildId);
    }

    async setVolume(guildId: string, volume: number): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        const clamped = Math.max(0, Math.min(500, volume));
        player.setVolume(clamped);
        return true;
    }

    async setLoop(guildId: string, mode: LoopMode): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        player.setLoop(mode);
        return true;
    }

    async setAutoplay(guildId: string, enabled: boolean): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        player.isAutoplay = enabled;
        return true;
    }

    async shuffle(guildId: string): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player || player.queue.size < 2) return false;
        player.queue.shuffle();
        return true;
    }

    async clearQueue(guildId: string): Promise<number> {
        const player = this.getPlayer(guildId);
        if (!player) return 0;
        const cleared = player.queue.size;
        player.queue.clear();
        return cleared;
    }

    async removeAt(guildId: string, index: number): Promise<Track | null> {
        const player = this.getPlayer(guildId);
        if (!player) return null;
        if (index < 1 || index > player.queue.size) return null;
        return player.queue.remove(index - 1);
    }

    async jumpTo(guildId: string, index: number): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        const target = player.queue[index - 1];
        if (!target) return false;
        player.queue.splice(index - 1, 1);
        player.queue.unshift(target);
        player.stop();
        await player.play().catch(() => undefined);
        await this.refreshPlayer(guildId);
        return true;
    }

    async moveTrack(guildId: string, from: number, to: number): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        if (from < 1 || from > player.queue.size || to < 1 || to > player.queue.size) return false;
        if (from === to) return false;

        const [moved] = player.queue.splice(from - 1, 1);
        player.queue.splice(to - 1, 0, moved);
        return true;
    }

    async applyFilter(guildId: string, filter: string | null): Promise<boolean> {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        const state = this.states.get(guildId);
        if (state) state.lastFilter = filter;

        try {
            const filters = player.filters;
            switch (filter) {
                case null:
                case 'default':
                    filters.clearFilters();
                    break;
                case 'bassboost':
                    filters.setBassboost(true);
                    break;
                case 'nightcore':
                    filters.setNightcore(true);
                    break;
                case 'vaporwave':
                    filters.setVaporwave(true);
                    break;
                case 'daycore':
                    filters.setTimescale(true, { speed: 0.75, pitch: 0.75, rate: 1 });
                    break;
                case '8d':
                    filters.setRotation(true, { rotationHz: 0.2 });
                    break;
                case 'karaoke':
                    filters.setKaraoke(true);
                    break;
                case 'tremolo':
                    filters.setTremolo(true);
                    break;
                case 'vibrato':
                    filters.setVibrato(true);
                    break;
                case 'slowmo':
                    filters.setTimescale(true, { speed: 0.7, pitch: 0.7, rate: 1 });
                    break;
                case 'pop':
                    filters.setEqualizer([
                        { band: 0, gain: -0.01 },
                        { band: 1, gain: 0.02 },
                        { band: 2, gain: 0.03 },
                        { band: 3, gain: 0.05 },
                        { band: 4, gain: 0.05 },
                        { band: 5, gain: 0.05 },
                        { band: 6, gain: 0.02 },
                        { band: 7, gain: 0.05 },
                        { band: 8, gain: 0 },
                        { band: 9, gain: 0.02 }
                    ]);
                    break;
                case 'soft':
                    filters.setLowPass(true, { smoothing: 20 });
                    break;
                case 'tv':
                    filters.setLowPass(true, { smoothing: 80 });
                    break;
                case 'china':
                    filters.setTimescale(true, { speed: 0.75, pitch: 0.75, rate: 1.5 });
                    break;
                default:
                    return false;
            }
        } catch (error) {
            console.error('Apply filter error:', (error as Error)?.message || error);
            return false;
        }
        return true;
    }

    async handleQueueEnd(player: Player): Promise<void> {
        try {
            const serverSettings = await this.settingsStore.get(player.guildId);
            await this.central.updateCentralEmbed(player.guildId, serverSettings, null);

            const state = this.states.get(player.guildId);
            if (state?.failsafePending) {
                await this.recoverPlayerFailure(player);
                return;
            }

            if (serverSettings.autoplay) {
                player.isAutoplay = true;
            }

            if (player.isAutoplay) {
                await player.autoplay(player).catch(() => undefined);
            }
        } catch (error) {
            console.error('Queue end error:', (error as Error)?.message || error);
        }
    }

    async destroy(guildId: string): Promise<void> {
        const player = this.getPlayer(guildId);
        const state = this.states.get(guildId);

        if (state?.nowPlayingMessageId) {
            const channel = this.client.channels.cache.get(state.textChannelId);
            if (channel && 'messages' in channel) {
                await channel.messages.delete(state.nowPlayingMessageId).catch(() => undefined);
            }
        }

        this.states.delete(guildId);

        if (player) {
            try {
                player.destroy();
            } catch {
                /* noop */
            }
        }

        const serverSettings = await this.settingsStore.get(guildId).catch(() => null);
        if (serverSettings) {
            await this.central.updateCentralEmbed(guildId, serverSettings, null).catch(() => undefined);
        }
        if (status) await status.onPlayerDisconnect(guildId);
    }

    initializeEvents(): void {
        riffy.on('nodeConnect', (node) => {
            console.log(`🎵 Lavalink node "${node.name}" connected (session: ${node.sessionId || 'n/a'})`);
        });

        riffy.on('nodeError', (node, error) => {
            console.error(`🔴 Lavalink node "${node.name}" error: ${error?.message || error}`);
        });

        riffy.on('nodeDisconnect', (node, reason) => {
            console.log(`🟡 Lavalink node disconnected: ${node.name} (reason: ${reason || 'unknown'})`);
        });

        riffy.on('playerMigrated', (player, oldNode, newNode) => {
            console.log(`🔄 Player ${player.guildId} migrated from ${oldNode?.name || 'unknown'} to ${newNode?.name || 'unknown'} (track: ${player.current?.info?.title || 'resuming'})`);
        });

        riffy.on('playerMigrationFailed', async (player, error) => {
            console.error(`🔴 Player ${player.guildId} migration failed: ${error?.message || error}`);
            const state = this.states.get(player.guildId);
            if (state?.lastQuery && !state.failsafePending && player.current?.info?.sourceName !== 'soundcloud') {
                state.failsafePending = true;
            }
            try {
                await this.handleQueueEnd(player);
            } catch (err) {
                console.error('Migration fail cleanup error:', (err as Error)?.message || err);
            }
        });

        riffy.on('trackStart', async (player, track) => {
            try {
                console.log(`🎵 Started playing: ${track?.info?.title || 'Unknown Track'} in ${player.guildId} (node: ${player.node?.name || 'unknown'})`);
                const state = this.states.get(player.guildId);
                if (state) {
                    state.failsafePending = false;
                    state.recoveries = 0;
                }
                const info = await this.getPlayerInfo(player.guildId);
                if (!info) return;

                if (status) await status.onTrackStart(player.guildId);

                const serverSettings = await this.settingsStore.get(player.guildId);
                await this.central.updateCentralEmbed(player.guildId, serverSettings, info);

                if (config.bot.showNowPlaying) {
                    await this.sendNowPlaying(player.guildId, info);
                }
            } catch (error) {
                console.error('Track start error:', (error as Error)?.message || error);
            }
        });

        riffy.on('trackEnd', async (player) => {
            try {
                if (status) await status.onTrackEnd(player.guildId);
            } catch (error) {
                console.error('Track end error (handled):', (error as Error)?.message || error);
            }
        });

        riffy.on('queueEnd', async (player) => {
            console.log(`🎵 Queue ended in ${player.guildId} (node: ${player.node?.name || 'unknown'})`);
            await this.handleQueueEnd(player);
        });

        riffy.on('playerCreate', (player) => {
            console.log(`🎵 Player created for guild ${player.guildId} on node "${player.node?.name || 'unknown'}" (voice: ${player.voiceChannel || 'none'})`);
        });

        riffy.on('playerDisconnect', async (player) => {
            console.log(`🎵 Player disconnected for guild ${player.guildId} (node: ${player.node?.name || 'unknown'})`);
            const serverSettings = await this.settingsStore.get(player.guildId).catch(() => null);
            if (serverSettings) {
                await this.central.updateCentralEmbed(player.guildId, serverSettings, null).catch(() => undefined);
            }
            if (status) await status.onPlayerDisconnect(player.guildId);
        });

        riffy.on('playerDestroy', (player) => {
            console.log(`🎵 Player destroyed for guild ${player.guildId} (node: ${player.node?.name || 'unknown'})`);
            this.states.delete(player.guildId);
        });

        riffy.on('playerMove', (player, oldChannel, newChannel) => {
            if (!newChannel && player && player.playing) {
                player.pause(true);
            }
            void oldChannel;
        });

        riffy.on('trackError', (player, track, payload) => {
            const reason =
                payload?.exception &&
                (typeof payload.exception === 'object'
                    ? payload.exception.message || JSON.stringify(payload.exception)
                    : payload.exception) || 'unknown';
            const code = payload?.exception?.severity ? ` [${payload.exception.severity}]` : '';
            console.error(`🔴 Track error in ${player.guildId} (node: ${player.node?.name || 'unknown'}): ${track?.info?.title || 'Unknown'}${code} -> ${reason}`);

            const state = this.states.get(player.guildId);
            if (
                state &&
                !state.failsafePending &&
                player.queue.length === 0 &&
                player.current
            ) {
                state.failsafePending = true;
                console.log(`🔄 Marking ${player.guildId} for playback recovery after failed track (node: ${player.node?.name || 'unknown'})...`);
                setTimeout(() => {
                    if (!state.failsafePending) return;
                    console.log(`🔄 Recovery timer fired for ${player.guildId} (no queueEnd received)...`);
                    this.recoverPlayerFailure(player).catch(() => undefined);
                }, 1500);
            }
        });
    }
}

export function mentionRequester(requester: unknown): string {
    if (!requester) return 'Unknown';
    if (typeof requester === 'object' && requester !== null && 'id' in requester) {
        const id = (requester as { id: string }).id;
        return `<@${id}>`;
    }
    return String(requester);
}

export default PlayerManager;
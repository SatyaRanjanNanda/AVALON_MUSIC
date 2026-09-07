import type { Client } from 'discord.js';
import type { Player, Riffy, Track } from 'riffy';
import { client, riffy, status } from '../core';
import type { LoopMode, PlayerAppState, PlayerSnapshot, ResolvedTracks } from '../types';
import type { CentralEmbedHandler } from '../utils/centralEmbed';
import type { SettingsStore } from '../utils/settings';
import { buildNowPlayingPanel, buildQueueEndedPanel } from '../utils/panel';
import config from '../config';

export type PlayResult =
    | { type: 'playlist'; tracksCount: number; name: string }
    | { type: 'track'; track: Track }
    | { type: 'error'; message: string };

const FALLBACK_SEARCH_PLATFORMS = ['ytsearch'];
const NODE_REQUEST_TIMEOUT_MS = 12000;
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_RESET_MS = 60_000;
const NOW_PLAYING_REFRESH_MS = 10_000;

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
    private recoveryState = new Map<string, { count: number; resetAt: number }>();

    constructor(client: Client, central: CentralEmbedHandler, settingsStore: SettingsStore) {
        this.client = client;
        this.central = central;
        this.settingsStore = settingsStore;
        this.startLiveTicker();
    }

    private startLiveTicker(): void {
        setInterval(() => {
            this.tickNowPlayingPanels().catch(() => undefined);
        }, NOW_PLAYING_REFRESH_MS);
    }

    private async tickNowPlayingPanels(): Promise<void> {
        const players = Array.from(riffy.players.values());
        for (const player of players) {
            if (!player || !player.current || !player.playing) continue;
            try {
                await this.updateLivePanels(player.guildId);
            } catch {
                /* keep going */
            }
        }
    }

    private async updateLivePanels(guildId: string): Promise<void> {
        const info = await this.getPlayerInfo(guildId);
        if (!info) return;
        const serverSettings = await this.settingsStore.get(guildId).catch(() => null);
        if (serverSettings) {
            await this.central.updateCentralEmbed(guildId, serverSettings, info).catch(() => undefined);
        }
        if (config.bot.showNowPlaying) {
            await this.sendNowPlaying(guildId, info);
        }
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

            this.hardenPlayer(player);

            return player;
        } catch (error) {
            console.error('Player creation error:', (error as Error)?.message || error);
            return null;
        }
    }

    private hardenPlayer(player: Player): void {
        const playerAny = player as any;

        if (!playerAny.__avalonHardened) {
            playerAny.__avalonHardened = true;

            const originalPlay = player.play.bind(player);
            let playingPromise: Promise<unknown> | null = null;

            player.play = async () => {
                if (!player.queue.length) {
                    player.playing = false;
                    console.warn(`🎵 Halt: play() called for guild ${player.guildId} with empty queue.`);
                    return player;
                }
                if (playingPromise) return playingPromise as any;
                playingPromise = originalPlay().finally(() => {
                    playingPromise = null;
                });
                return playingPromise;
            };

            const originalStop = player.stop.bind(player);
            let stopping = false;
            player.stop = () => {
                if (stopping) return player;
                stopping = true;
                const result = originalStop();
                setTimeout(() => { stopping = false; }, 50);
                return result;
            };
        }
    }


    async playSong(player: Player, query: string, requester: unknown): Promise<PlayResult> {
        try {
            if (!player) return { type: 'error', message: 'Player not available' };

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

    // (Removed recordLastQuery)

    private canAttemptRecovery(guildId: string): boolean {
        const now = Date.now();
        const state = this.recoveryState.get(guildId);
        if (!state || now > state.resetAt) {
            this.recoveryState.set(guildId, { count: 1, resetAt: now + RECOVERY_RESET_MS });
            return true;
        }
        if (state.count >= MAX_RECOVERY_ATTEMPTS) {
            console.warn(`🛑 Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached for guild ${guildId}, giving up on track recovery.`);
            return false;
        }
        state.count += 1;
        return true;
    }

    private clearRecoveryState(guildId: string): void {
        this.recoveryState.delete(guildId);
    }

    private async resolveAlternativeTrack(query: string, failedTrack: Track): Promise<Track | null> {
        try {
            const result = await this.resolveWithFallback(query, failedTrack.info.requester);
            if (result.tracks && result.tracks.length > 0) {
                const filteredTracks = result.tracks.filter(t => 
                    t.info.identifier !== failedTrack.info.identifier && 
                    t.info.uri !== failedTrack.info.uri
                );
                if (filteredTracks.length > 0) {
                    return this.pickBestTrack(filteredTracks, query) || null;
                }
            }
        } catch (error) {
            console.warn('Alternative track search error:', (error as Error)?.message || error);
        }
        return null;
    }

    private async recoverFailedTrack(player: Player, failedTrack: Track): Promise<void> {
        if (!this.canAttemptRecovery(player.guildId)) return;

        const query = `${failedTrack.info.title} ${failedTrack.info.author}`;
        console.log(`🔄 Attempting to recover failed track: ${query}`);

        const fallbackTrack = await this.resolveAlternativeTrack(query, failedTrack);
        if (fallbackTrack) {
            console.log(`✅ Recovery successful, found alternative fallback for ${player.guildId}.`);
            
            if (player.current && player.current.info.title !== failedTrack.info.title) {
                player.queue.unshift(player.current);
                player.queue.unshift(fallbackTrack);
            } else {
                player.queue.unshift(fallbackTrack);
                if (!player.playing && !player.paused && player.queue.length > 0) {
                    await player.play().catch(() => undefined);
                }
            }
            return;
        }
        console.warn(`⚠️ Recovery failed for ${player.guildId}, advancing queue.`);
        if (player && player.queue.length > 0) {
            player.stop();
        } else if (config.bot.showNowPlaying && player) {
            await this.sendQueueEndedPanel(player.guildId, '⚠️ Could not play that track and the queue is empty.');
        }
    }

    private pickBestTrack(tracks: Track[], query: string): Track | undefined {
        if (tracks.length <= 1) return tracks[0];

        const q = query.toLowerCase().replace(/^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/, '');
        const tagWords = [
            'remix', 'instrumental', 'karaoke', 'cover', 'slowed', 'sped up', 'reverb', 
            'extended', 'nightcore', 'acoustic', 'mashup', 'megamix', '8d audio', 
            'bass boost', 'bassboosted', 'relaxing', 'live', 'tiktok', 'lofi', 'type beat', 
            'parody', 'reaction', '8d', 'bassed', 'clean', 'loop', 'sample', 'edit', 'speed up'
        ];
        const tagRegex = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requestedTags = tagWords.filter((tag) => q.includes(tag));
        const penalizedTags = tagWords.filter((tag) => !requestedTags.includes(tag));

        const badTags = new RegExp(`\\b(${penalizedTags.map(tagRegex).join('|')})\\b`, 'i');
        const hardBadTags = /\b(instrumental|karaoke|acoustic|cover version|parody|beat only)\b/i;
        const goodTags = /\b(official|official audio|official video|topic|original|audio|music video)\b/i;

        const coreWords = q
            .split(/\s+/)
            .map((w) => w.replace(/[^a-z0-9]/g, ''))
            .filter((w) => w.length >= 3 && !penalizedTags.some((t) => t.replace(/\s/g, '') === w));

        let best: Track | undefined = tracks[0];
        let bestScore = -Infinity;
        let bestMatched = 0;

        for (let i = 0; i < Math.min(tracks.length, 15); i++) {
            const track = tracks[i];
            const title = (track?.info?.title || '').toLowerCase();
            const author = (track?.info?.author || '').toLowerCase();

            let score = 500 - (i * 8);
            if (penalizedTags.length > 0 && badTags.test(title)) score -= 500;
            if (hardBadTags.test(title) || hardBadTags.test(author)) score -= 400;
            if (requestedTags.length > 0) {
                const titleTags = requestedTags.filter((tag) => title.includes(tag)).length;
                score += titleTags * 200;
            }

            if (goodTags.test(title) || goodTags.test(author)) score += 200;
            if (author.includes('vevo') || author.includes('topic')) score += 260;

            const authorWords = author.split(/\s+/).filter((w) => w.length > 2);
            const authorMatches = coreWords.filter((w) => authorWords.some((aw) => aw.includes(w) || w.includes(aw))).length;
            if (authorMatches >= 2) score += 150;
            else if (authorMatches === 1) score += 60;

            const titleWords = title.split(/\s+/);
            const matched = coreWords.filter((w) => titleWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
            score += matched * 90;
            const missing = coreWords.length - matched;
            score -= missing * 160;

            if (title === q) score += 300;
            else if (title.replace(/[^a-z0-9]/g, '').includes(q.replace(/[^a-z0-9]/g, ''))) score += 180;

            if (score > bestScore) {
                bestScore = score;
                best = track;
                bestMatched = matched;
            }
        }

        const goodMatch = coreWords.length === 0 || bestMatched > 0;
        const threshold = coreWords.length > 0 ? 100 : -400;
        return best !== undefined && bestScore > threshold && goodMatch ? best : undefined;
    }

    private async resolveWithFallback(query: string, requester: unknown): Promise<FallbackResolveResult> {
        const trimmed = query.trim();
        if (/^https?:\/\//i.test(trimmed)) {
            const nodes = this.connectedNodes();
            for (const node of nodes) {
                try {
                    const result = await withTimeout(
                        riffy.resolve({ query: trimmed, requester, node }),
                        NODE_REQUEST_TIMEOUT_MS
                    );
                    if (result.loadType !== 'empty' && result.loadType !== 'error') {
                        return result;
                    }
                } catch (error) {
                    console.error('Direct URL resolve error on node:', node.name, (error as Error)?.message || error);
                }
            }
            return { loadType: 'empty', tracks: [], playlistInfo: { name: '' } };
        }

        const prefixMatch = trimmed.match(/^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/i);
        const specifiedPlatform = prefixMatch ? prefixMatch[1].toLowerCase() : null;
        const searchTerm = trimmed.replace(/^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/i, '').trim();

        const basePlatforms = [config.lavalink.defaultSearchPlatform, ...FALLBACK_SEARCH_PLATFORMS];
        const platforms = specifiedPlatform 
            ? [...new Set([specifiedPlatform, ...basePlatforms])]
            : [...new Set(basePlatforms)];
        const attempts: string[] = [];
        const nodes = this.connectedNodes();

        for (const platform of platforms) {
            for (const node of nodes) {
                try {
                    const result = await withTimeout(
                        riffy.resolve({ query: searchTerm, source: platform, requester, node }),
                        NODE_REQUEST_TIMEOUT_MS
                    );
                    const { loadType, tracks } = result;
                    if (loadType === 'playlist') {
                        return result;
                    }
                    if ((loadType === 'track' || loadType === 'search') && tracks.length > 0) {
                        if (loadType === 'track') return result;
                        const best = this.pickBestTrack(tracks, searchTerm);
                        if (!best) {
                            attempts.push(`${platform}(${node.name}: no good match)`);
                            if (specifiedPlatform) {
                                return {
                                    loadType: 'empty',
                                    tracks: [],
                                    playlistInfo: { name: '' },
                                    exception: {
                                        message: `No original match on requested platform "${specifiedPlatform}" (only covers/instrumentals/unrelated results found).`
                                    }
                                };
                            }
                            continue;
                        }
                        
                        // Ensure the best track is the first element in the array so the bot plays it
                        result.tracks = [best, ...result.tracks.filter(t => t !== best)];
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

    async sendQueueEndedPanel(guildId: string, brief = 'The playback has finished.'): Promise<void> {
        const state = this.states.get(guildId);
        if (!state) return;

        const serverSettings = await this.settingsStore.get(guildId).catch(() => null);
        if (serverSettings?.centralEnabled && serverSettings.centralChannelId === state.textChannelId) return;

        const channel = this.client.channels.cache.get(state.textChannelId);
        if (!channel || !('send' in channel)) return;

        const panel = buildQueueEndedPanel(brief);

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

        const lastTrack = player.queue.length === 0 && !!player.current;
        const hadCurrent = lastTrack;
        const serverSettings = await this.settingsStore.get(guildId).catch(() => null);
        const autoplayWillStart = lastTrack && serverSettings?.autoplay === true;

        player.stop();

        if (hadCurrent && lastTrack && !autoplayWillStart && config.bot.showNowPlaying) {
            await this.sendQueueEndedPanel(guildId, '⏭️ Skipped the last track.');
        }
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
        if (player.queue.length > 0) {
            await player.play().catch(() => undefined);
        }
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

            if (serverSettings.autoplay) {
                player.isAutoplay = true;
            }

            if (config.bot.showNowPlaying) {
                await this.sendQueueEndedPanel(
                    player.guildId,
                    serverSettings.autoplay ? 'Switching to Autoplay…' : 'Queue and playlist finished.'
                );
            }

            if (player.isAutoplay && player.connected) {
                await player.autoplay(player).catch(() => undefined);
            }
        } catch (error) {
            console.error('Queue end error:', (error as Error)?.message || error);
        }
    }

    async destroy(guildId: string): Promise<void> {
        this.recoveryState.delete(guildId);
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
            try {
                await this.handleQueueEnd(player);
            } catch (err) {
                console.error('Migration fail cleanup error:', (err as Error)?.message || err);
            }
        });

        riffy.on('trackStart', async (player, track) => {
            try {
                this.clearRecoveryState(player.guildId);
                console.log(`🎵 Started playing: ${track?.info?.title || 'Unknown Track'} in ${player.guildId} (node: ${player.node?.name || 'unknown'})`);
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

            if (track) {
                this.recoverFailedTrack(player, track).catch((err) => {
                    console.error('Recovery error:', (err as Error)?.message || err);
                });
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
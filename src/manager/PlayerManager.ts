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

const FALLBACK_SEARCH_PLATFORMS = ['ytsearch', 'scsearch', 'spsearch'];

interface FallbackResolveResult {
    loadType: string | null;
    tracks: Track[];
    playlistInfo: { name?: string | null } | null;
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

            player = riffy.createConnection({
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

            const resolve = await this.resolveWithFallback(query, requester);
            const { loadType, tracks, playlistInfo } = resolve;

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
                const track = tracks[0];
                if (!track || !track.info) {
                    return { type: 'error', message: 'No results found' };
                }
                track.info.requester = requester;
                player.queue.add(track);
                if (!player.playing && !player.paused) {
                    await player.play();
                }
                return { type: 'track', track };
            }

            return { type: 'error', message: 'No results found' };
        } catch (error) {
            console.error('Play song error:', (error as Error)?.message || error);
            return { type: 'error', message: 'Failed to play song' };
        }
    }

    private async resolveWithFallback(query: string, requester: unknown): Promise<FallbackResolveResult> {
        const trimmed = query.trim();
        if (/^https?:\/\//i.test(trimmed)) {
            return riffy.resolve({ query: trimmed, requester }).catch(() => ({
                loadType: 'empty',
                tracks: [],
                playlistInfo: { name: '' }
            }));
        }

        const platforms = [...new Set([config.lavalink.defaultSearchPlatform, ...FALLBACK_SEARCH_PLATFORMS])];
        let last: FallbackResolveResult = { loadType: 'empty', tracks: [], playlistInfo: { name: '' } };

        for (const platform of platforms) {
            try {
                const result = await riffy.resolve({ query: `${platform}:${trimmed}`, requester });
                last = result;
                const { loadType, tracks } = result;
                if (loadType === 'playlist' || ((loadType === 'track' || loadType === 'search') && tracks.length > 0)) {
                    return result;
                }
            } catch (error) {
                console.error(`Search fallback error on ${platform}:`, (error as Error)?.message || error);
            }
        }
        return last;
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
        if (!player || !player.playing) return false;

        player.stop();
        if (player.queue.size > 0) {
            await player.play().catch(() => undefined);
        } else {
            await this.handleQueueEnd(player);
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

            if (serverSettings.autoplay) {
                player.isAutoplay = true;
            }

            if (player.isAutoplay) {
                await player.autoplay(player).catch(() => player.destroy());
            } else {
                if (status) await status.onPlayerDisconnect(player.guildId);
                player.destroy();
            }
        } catch (error) {
            console.error('Queue end error:', (error as Error)?.message || error);
            try {
                player.destroy();
            } catch {
                /* noop */
            }
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
            console.log(`🎵 Lavalink node "${node.name}" connected`);
        });

        riffy.on('nodeError', (node, error) => {
            console.error(`🔴 Lavalink node "${node.name}" error: ${error?.message || error}`);
        });

        riffy.on('nodeDisconnect', (node) => {
            console.log(`🟡 Lavalink node disconnected: ${node.name}`);
        });

        riffy.on('trackStart', async (player, track) => {
            try {
                console.log(`🎵 Started playing: ${track?.info?.title || 'Unknown Track'} in ${player.guildId}`);
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
            console.log(`🎵 Queue ended in ${player.guildId}`);
            await this.handleQueueEnd(player);
        });

        riffy.on('playerCreate', (player) => {
            console.log(`🎵 Player created for guild ${player.guildId}`);
        });

        riffy.on('playerDisconnect', async (player) => {
            console.log(`🎵 Player disconnected for guild ${player.guildId}`);
            const serverSettings = await this.settingsStore.get(player.guildId).catch(() => null);
            if (serverSettings) {
                await this.central.updateCentralEmbed(player.guildId, serverSettings, null).catch(() => undefined);
            }
            if (status) await status.onPlayerDisconnect(player.guildId);
        });

        riffy.on('playerDestroy', (player) => {
            console.log(`🎵 Player destroyed for guild ${player.guildId}`);
            this.states.delete(player.guildId);
        });

        riffy.on('playerMove', (player, oldChannel, newChannel) => {
            if (!newChannel && player && player.playing) {
                player.pause(true);
            }
            void oldChannel;
        });

        riffy.on('trackError', (player, track) => {
            console.error(`🔴 Track error: ${track?.info?.title || 'Unknown'}: ${player.guildId}`);
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
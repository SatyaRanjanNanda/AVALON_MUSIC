import type { Client } from 'discord.js';
import { riffy } from '../core';
import type { Track } from '../types';
import type { SettingsStore, GuildSettings } from './settings';

export interface MusicConditions {
    hasActivePlayer: boolean;
    isPlaying: boolean;
    isPaused: boolean;
    botVoiceChannel: string | null;
    userVoiceChannel: string | null;
    userInVoice: boolean;
    sameVoiceChannel: boolean;
    centralEnabled: boolean;
    centralVC: string | null;
    isCentralVC: boolean;
    botInCentralVC: boolean;
    fromCentral: boolean;
    canJoinVoice: boolean;
    queueLength: number;
    currentTrack: Track | null;
}

export class ConditionChecker {
    private client: Client;
    private settings: SettingsStore;

    constructor(client: Client, settings: SettingsStore) {
        this.client = client;
        this.settings = settings;
    }

    async checkMusicConditions(
        guildId: string,
        userId: string,
        voiceChannelId: string | null,
        fromCentral = false
    ): Promise<MusicConditions & { settings: GuildSettings }> {
        const guild = this.client.guilds.cache.get(guildId);
        const serverConfig = await this.settings.get(guildId);

        const centralEnabled = serverConfig.centralEnabled;
        const centralVC = serverConfig.centralVcChannelId;

        const botVoiceChannel = guild?.members.me?.voice.channelId ?? null;

        const userVoiceChannel = voiceChannelId ? guild?.members.cache.get(userId)?.voice.channel : null;
        const voicePermissions = userVoiceChannel ? userVoiceChannel.permissionsFor(this.client.user?.id || '') : null;
        const canJoinVoice = !!userVoiceChannel && !!voicePermissions && voicePermissions.has(['Connect', 'Speak']);

        const player = riffy.players.get(guildId);

        return {
            hasActivePlayer: !!player,
            isPlaying: !!player?.playing || false,
            isPaused: !!player?.paused || false,
            botVoiceChannel,
            userVoiceChannel: voiceChannelId,
            userInVoice: !!voiceChannelId,
            sameVoiceChannel: voiceChannelId === botVoiceChannel,
            centralEnabled,
            centralVC: centralVC || null,
            isCentralVC: centralVC === voiceChannelId,
            botInCentralVC: botVoiceChannel === centralVC,
            fromCentral,
            canJoinVoice,
            queueLength: player?.queue.size || 0,
            currentTrack: player?.current || null,
            settings: serverConfig
        };
    }

    async canUseMusic(guildId: string, userId: string): Promise<boolean> {
        const serverConfig = await this.settings.get(guildId);
        if (!serverConfig.djRole) return true;

        const guild = this.client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(userId);
        return !!member?.roles.cache.has(serverConfig.djRole);
    }

    async canUseCentralSystem(guildId: string, userId: string): Promise<boolean> {
        const serverConfig = await this.settings.get(guildId);
        if (!serverConfig.centralEnabled) return false;
        if (!serverConfig.centralAllowedRoles?.length) return true;

        const guild = this.client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(userId);
        return serverConfig.centralAllowedRoles.some((roleId) => !!member?.roles.cache.has(roleId));
    }

    getErrorMessage(conditions: MusicConditions, action: string = 'play'): string | null {
        if (!conditions.userInVoice) {
            return '❌ You need to be in a voice channel to use music commands!';
        }

        if (!conditions.canJoinVoice) {
            return `❌ I don't have permission to join your voice channel!`;
        }

        if (conditions.hasActivePlayer && !conditions.sameVoiceChannel) {
            if (conditions.botInCentralVC && !conditions.fromCentral) {
                if (conditions.centralEnabled && conditions.centralVC) {
                    return `❌ I'm currently in the central music system! Join <#${conditions.centralVC}> or use the central channel to control music.`;
                }
            }

            if (!conditions.botInCentralVC && conditions.fromCentral && conditions.centralVC) {
                return null;
            }

            return `❌ I'm already playing music in a different voice channel!`;
        }

        if (action === 'skip' && !conditions.isPlaying) {
            return '❌ Nothing is currently playing to skip!';
        }

        if (action === 'pause' && !conditions.isPlaying) {
            return '❌ Nothing is currently playing to pause!';
        }

        return null;
    }
}

export default ConditionChecker;
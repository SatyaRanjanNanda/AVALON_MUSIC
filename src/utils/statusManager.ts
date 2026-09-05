import { ActivityType, type Client, type StageChannel, type VoiceChannel } from 'discord.js';
import type { PlayerSnapshot } from '../types';

interface VoiceChannelData {
    originalName: string;
    originalTopic: string | null;
}

type TopicableChannel = VoiceChannel | StageChannel;

export class StatusManager {
    private client: Client;
    private currentInterval: ReturnType<typeof setInterval> | null = null;
    private isPlaying = false;
    private voiceChannelData = new Map<string, VoiceChannelData>();
    private getPlayerInfo: (guildId: string) => Promise<PlayerSnapshot | null | undefined> | PlayerSnapshot | null | undefined;

    constructor(client: Client, getPlayerInfo: (guildId: string) => Promise<PlayerSnapshot | null | undefined> | PlayerSnapshot | null | undefined) {
        this.client = client;
        this.getPlayerInfo = getPlayerInfo;
    }

    async updateStatusAndVoice(guildId: string): Promise<void> {
        try {
            const playerInfo = await this.getPlayerInfo(guildId);

            if (playerInfo && playerInfo.playing) {
                await this.setPlayingStatus(playerInfo.title);
                await this.setVoiceChannelStatus(guildId, playerInfo.title);
            } else {
                await this.setDefaultStatus();
                await this.clearVoiceChannelStatus(guildId);
            }
        } catch (error) {
            console.error('❌ Error updating status and voice channel:', (error as Error)?.message || error);
        }
    }

    async setPlayingStatus(trackTitle: string): Promise<void> {
        this.stopCurrentStatus();
        this.isPlaying = true;

        const activity = `🎵 ${trackTitle}`;
        await this.client.user?.setPresence({
            activities: [{ name: activity, type: ActivityType.Listening }],
            status: 'online'
        });

        this.currentInterval = setInterval(() => {
            if (this.isPlaying) {
                void this.client.user?.setPresence({
                    activities: [{ name: activity, type: ActivityType.Listening }],
                    status: 'online'
                });
            }
        }, 30000);
    }

    async setDefaultStatus(): Promise<void> {
        this.stopCurrentStatus();
        this.isPlaying = false;
        await this.client.user?.setPresence({
            activities: [{ name: '🎵 Ready for music!', type: ActivityType.Watching }],
            status: 'online'
        });
    }

    async setServerCountStatus(serverCount: number): Promise<void> {
        if (!this.isPlaying) {
            await this.client.user?.setPresence({
                activities: [{ name: `🎸 Music in ${serverCount} servers`, type: ActivityType.Playing }],
                status: 'online'
            });
        }
    }

    

    async setVoiceChannelStatus(guildId: string, trackTitle: string): Promise<void> {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const voiceChannel = guild.members.me?.voice.channel as TopicableChannel | undefined;
            if (!voiceChannel) return;

            if (!this.voiceChannelData.has(voiceChannel.id)) {
                this.voiceChannelData.set(voiceChannel.id, {
                    originalName: voiceChannel.name,
                    originalTopic: 'topic' in voiceChannel ? voiceChannel.topic ?? null : null
                });
            }

            const botMember = guild.members.me;
            if (!botMember || !voiceChannel.permissionsFor(botMember).has('ManageChannels')) return;

            const statusText = `🎵 ${trackTitle}`;
            let success = await this.createVoiceStatusAPI(voiceChannel.id, statusText);
            if (success) return;

            success = await this.createChannelTopic(voiceChannel as unknown as { setTopic: (topic: string | null) => Promise<unknown> }, trackTitle);
            if (success) return;

            await this.createChannelName(voiceChannel);
        } catch (error) {
            console.error(`❌ Voice channel status creation failed: ${(error as Error)?.message}`);
        }
    }

    async clearVoiceChannelStatus(guildId: string): Promise<void> {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const voiceChannel = guild.members.me?.voice.channel as TopicableChannel | undefined;
            if (!voiceChannel) return;

            const botMember = guild.members.me;
            if (!botMember || !voiceChannel.permissionsFor(botMember).has('ManageChannels')) return;

            let success = await this.deleteVoiceStatusAPI(voiceChannel.id);
            if (success) return;

            success = await this.deleteChannelTopic(voiceChannel as unknown as { setTopic: (topic: string | null) => Promise<unknown>; id: string });
            if (success) return;

            await this.deleteChannelName(voiceChannel);
        } catch (error) {
            console.error(`❌ Voice channel status clearing failed: ${(error as Error)?.message}`);
        }
    }

    private async createVoiceStatusAPI(channelId: string, statusText: string): Promise<boolean> {
        try {
            await this.client.rest.put(`/channels/${channelId}/voice-status`, { body: { status: statusText } });
            return true;
        } catch {
            return false;
        }
    }

    private async deleteVoiceStatusAPI(channelId: string): Promise<boolean> {
        try {
            await this.client.rest.put(`/channels/${channelId}/voice-status`, { body: { status: null } });
            return true;
        } catch {
            try {
                await this.client.rest.delete(`/channels/${channelId}/voice-status`);
                return true;
            } catch {
                return false;
            }
        }
    }

    private async createChannelTopic(voiceChannel: { setTopic: (topic: string | null) => Promise<unknown> }, trackTitle: string): Promise<boolean> {
        try {
            await voiceChannel.setTopic(`🎵 Now Playing: ${trackTitle}`);
            return true;
        } catch {
            return false;
        }
    }

    private async deleteChannelTopic(voiceChannel: { setTopic: (topic: string | null) => Promise<unknown>; id: string }): Promise<boolean> {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            await voiceChannel.setTopic(originalData?.originalTopic ?? null);
            return true;
        } catch {
            return false;
        }
    }

    private async createChannelName(voiceChannel: { name: string; setName: (name: string) => Promise<unknown>; id: string }): Promise<boolean> {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const baseName = originalData?.originalName || voiceChannel.name.replace(/🎵.*$/, '').trim();
            const newName = `🎵 ${baseName}`;
            if (newName !== voiceChannel.name && newName.length <= 100) {
                await voiceChannel.setName(newName);
            }
            return true;
        } catch {
            return false;
        }
    }

    private async deleteChannelName(voiceChannel: { name: string; setName: (name: string) => Promise<unknown>; id: string }): Promise<boolean> {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalName = originalData?.originalName;
            if (originalName && originalName !== voiceChannel.name) {
                await voiceChannel.setName(originalName);
                this.voiceChannelData.delete(voiceChannel.id);
            }
            return true;
        } catch {
            return false;
        }
    }

    stopCurrentStatus(): void {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    }

    async onTrackStart(guildId: string): Promise<void> {
        await this.updateStatusAndVoice(guildId);
    }

    async onTrackEnd(guildId: string): Promise<void> {
        setTimeout(() => void this.updateStatusAndVoice(guildId), 1000);
    }

    async onPlayerDisconnect(guildId: string | null = null): Promise<void> {
        await this.setDefaultStatus();
        if (guildId) {
            await this.clearVoiceChannelStatus(guildId);
        }
    }
}

export default StatusManager;
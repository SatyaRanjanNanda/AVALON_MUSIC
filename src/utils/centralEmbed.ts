import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type Client,
    type Guild,
    type Message,
    type MessageActionRowComponentBuilder
} from 'discord.js';
import config from '../config';
import settingsStore, { type GuildSettings, SettingsStore } from './settings';
import type { PlayerSnapshot } from '../types';
import { formatDuration, mentionRequester } from './helpers';
import { EMOJIS } from './emojis';

export interface CentralTrackInfo extends PlayerSnapshot {
    thumbnail: string | null;
}

function validateThumbnail(thumbnail: string | null | undefined): string | null {
    if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') return null;
    try {
        new URL(thumbnail);
        return thumbnail;
    } catch {
        return null;
    }
}

function getLoopEmoji(loopMode: string): string {
    switch (loopMode) {
        case 'track':
            return '🔂';
        case 'queue':
            return '🔁';
        default:
            return '⏺️';
    }
}

function createIdleEmbed(client: Client): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: 'Ultimate Music Control Center',
            iconURL: 'https://cdn.discordapp.com/emojis/896724352949706762.gif',
            url: config.bot.supportServer
        })
        .setDescription(
            [
                '',
                '- Simply type a **song name** or **YouTube link** to start the party!',
                '- In free version I only support **YouTube** only.',
                '',
                '✨ *Ready to fill this place with amazing music?*'
            ].join('\n')
        )
        .setColor(0x9966ff)
        .addFields(
            {
                name: '🎯 Quick Examples',
                value: [
                    '• `shape of you`',
                    '• `lofi hip hop beats`',
                    '• `https://youtu.be/dQw4w9WgXcQ`',
                    '• `imagine dragons believer`'
                ].join('\n'),
                inline: true
            },
            {
                name: '🚀 Features',
                value: ['• 🎵 High quality audio', '• 📜 Queue management', '• 🔁 Loop & shuffle modes', '• 🎛️ Volume controls', '• ⚡ Lightning fast search'].join('\n'),
                inline: true
            },
            {
                name: '💡 Pro Tips',
                value: ['• Join voice channel first', '• Use specific song names', '• Try artist + song combo', '• Playlists are supported!'].join('\n'),
                inline: false
            }
        )
        .setImage('https://i.ibb.co/DDSdKy31/ezgif-8aec7517f2146d.gif')
        .setFooter({ text: 'Ultimate Music Bot • Developed By GlaceYT!', iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
}

function createPlayingEmbed(client: Client, info: CentralTrackInfo): EmbedBuilder {
    const statusEmoji = info.paused ? '⏸️' : '▶️';
    const statusText = info.paused ? 'Paused' : 'Now Playing';
    const loopEmoji = getLoopEmoji(info.loop);
    const embedColor = info.paused ? 0xffa500 : 0x9966ff;
    const validThumbnail = validateThumbnail(info.thumbnail);

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${info.title}`,
            iconURL: 'https://cdn.discordapp.com/emojis/896724352949706762.gif',
            url: config.bot.supportServer
        })
        .setDescription(
            [
                `**🎤 Artist:** ${info.author}`,
                `**👤 Requested by:** ${mentionRequester(info.requester)}`,
                '',
                `⏰ **Duration:** \`${formatDuration(info.duration)}\``,
                `${loopEmoji} **Loop:** \`${info.loop || 'Off'}\``,
                `🔊 **Volume:** \`${info.volume || 50}%\``,
                '',
                '🎶 *Enjoying the vibes? Type more song names below to keep the party going!*'
            ].join('\n')
        )
        .setColor(embedColor)
        .setFooter({ text: `Ultimate Music Bot • ${statusText} • Developed By GlaceYT`, iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    if (validThumbnail) {
        embed.setThumbnail(validThumbnail);
    }
    if (!info.paused) {
        embed.setImage('https://i.ibb.co/KzbPV8jd/aaa.gif');
    }
    return embed;
}

function createControlButtons(info: CentralTrackInfo): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('music_skip').setEmoji(EMOJIS.skip).setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(info.paused ? 'music_resume' : 'music_pause')
            .setEmoji(info.paused ? EMOJIS.play : EMOJIS.pause)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('music_stop').setEmoji(EMOJIS.stop).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('music_queue').setEmoji(EMOJIS.queue).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setLabel('\u200B\u200BLoop\u200B').setCustomId('music_loop').setEmoji(getLoopEmoji(info.loop)).setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('music_volume_down').setEmoji(EMOJIS.volumeDown).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_volume_up').setEmoji(EMOJIS.volumeUp).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_clear').setEmoji(EMOJIS.clear).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_shuffle').setEmoji(EMOJIS.shuffle).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setURL(config.bot.supportServer)
    );

    return [row1, row2];
}

export class CentralEmbedHandler {
    private client: Client;
    private settings: SettingsStore;

    constructor(client: Client, settings: SettingsStore) {
        this.client = client;
        this.settings = settings;
    }

    async createCentralEmbed(channelId: string, guildId: string): Promise<Message | null> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !('send' in channel)) return null;

            const embed = createIdleEmbed(this.client);
            const message = await channel.send({ embeds: [embed] });

            await this.settings.set(guildId, {
                centralEmbedId: message.id,
                centralChannelId: channelId
            });

            console.log(`✅ Central embed created in ${guildId}`);
            return message;
        } catch (error) {
            console.error('Error creating central embed:', (error as Error)?.message || error);
            return null;
        }
    }

    async resetAllCentralEmbedsOnStartup(): Promise<void> {
        try {
            const servers = await this.settings.allCentralEnabled();
            let resetCount = 0;

            for (const { guildId, settings } of servers) {
                try {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild || !settings.centralChannelId) {
                        await this.settings.set(guildId, { centralEnabled: false, centralEmbedId: null });
                        continue;
                    }

                    const channel = await this.client.channels.fetch(settings.centralChannelId).catch(() => null);
                    if (!channel || !('messages' in channel)) {
                        await this.settings.set(guildId, { centralEnabled: false, centralEmbedId: null });
                        continue;
                    }

                    const permissions = 'permissionsFor' in channel ? channel.permissionsFor(this.client.user?.id || '') : null;
                    if (permissions && !permissions.has(['SendMessages', 'EmbedLinks'])) continue;

                    const message = settings.centralEmbedId ? await channel.messages.fetch(settings.centralEmbedId).catch(() => null) : null;
                    if (!message) {
                        const newMessage = await this.createCentralEmbed(channel.id, guildId);
                        if (newMessage) resetCount++;
                        continue;
                    }

                    await message.edit({ embeds: [createIdleEmbed(this.client)], components: [] });
                    resetCount++;
                    await new Promise((resolve) => setTimeout(resolve, 100));
                } catch (error) {
                    const code = (error as { code?: number })?.code;
                    if (code === 50001 || code === 10003 || code === 50013) {
                        await this.settings.set(guildId, { centralEnabled: false, centralEmbedId: null });
                    }
                }
            }

            console.log(`[central] Reset ${resetCount} central embeds on startup.`);
        } catch (error) {
            console.error('❌ Error during central embed auto-reset:', (error as Error)?.message || error);
        }
    }

    async updateCentralEmbed(guildId: string, settings: GuildSettings, info: CentralTrackInfo | null): Promise<void> {
        try {
            if (!settings.centralEnabled || !settings.centralChannelId || !settings.centralEmbedId) return;

            const channel = await this.client.channels.fetch(settings.centralChannelId);
            if (!channel || !('messages' in channel)) return;

            const message = await channel.messages.fetch(settings.centralEmbedId);
            let embed: EmbedBuilder | null;
            let components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

            if (info) {
                embed = createPlayingEmbed(this.client, info);
                components = createControlButtons(info);
            } else {
                embed = createIdleEmbed(this.client);
            }

            await message.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('Error updating central embed:', (error as Error)?.message || error);
        }
    }

    getLoopEmoji(loopMode: string): string {
        return getLoopEmoji(loopMode);
    }

    async disableCentral(guildId: string): Promise<boolean> {
        const reset = {
            centralEnabled: false,
            centralChannelId: null,
            centralEmbedId: null,
            centralVcChannelId: null,
            centralAllowedRoles: [] as string[]
        };

        const serverSettings = await this.settings.get(guildId);
        if (serverSettings.centralEnabled && serverSettings.centralChannelId && serverSettings.centralEmbedId) {
            const channel = await this.client.channels.fetch(serverSettings.centralChannelId).catch(() => null);
            if (channel && 'messages' in channel) {
                await channel.messages.delete(serverSettings.centralEmbedId).catch(() => undefined);
            }
        }

        await this.settings.set(guildId, reset);
        return true;
    }
}

export function buildTrackInfo(snapshot: PlayerSnapshot): CentralTrackInfo {
    return { ...snapshot, thumbnail: snapshot.thumbnail };
}

export default CentralEmbedHandler;
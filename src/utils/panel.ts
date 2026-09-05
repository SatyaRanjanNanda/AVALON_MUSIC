import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    type MessageActionRowComponentBuilder
} from 'discord.js';
import type { PlayerSnapshot } from '../types';
import { createNowPlayingEmbed } from './embedUtils';
import config from '../config';

export const FILTERS = [
    { name: 'bassboost', label: 'Bassboost' },
    { name: 'nightcore', label: 'Nightcore' },
    { name: 'vaporwave', label: 'Vaporwave' },
    { name: 'daycore', label: 'Daycore' },
    { name: '8d', label: '8D Audio' },
    { name: 'karaoke', label: 'Karaoke' },
    { name: 'tremolo', label: 'Tremolo' },
    { name: 'vibrato', label: 'Vibrato' },
    { name: 'slowmo', label: 'Slow Motion' },
    { name: 'pop', label: 'Pop' },
    { name: 'soft', label: 'Soft' },
    { name: 'tv', label: 'TV' },
    { name: 'china', label: 'China' }
];

export function buildControlRows(snapshot: PlayerSnapshot): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
    const paused = snapshot.paused;
    const loopLabel = snapshot.loop === 'track' ? '🔂 Track' : snapshot.loop === 'queue' ? '🔁 Queue' : '🔁 Off';

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('p:skip').setStyle(ButtonStyle.Secondary).setEmoji('⏭️').setLabel('Skip'),
        new ButtonBuilder()
            .setCustomId('p:pause')
            .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(paused ? '▶️' : '⏸️')
            .setLabel(paused ? 'Resume' : 'Pause'),
        new ButtonBuilder().setCustomId('p:stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️').setLabel('Stop'),
        new ButtonBuilder().setCustomId('p:queue').setStyle(ButtonStyle.Primary).setEmoji('📜').setLabel('Queue'),
        new ButtonBuilder().setCustomId('p:loop').setStyle(ButtonStyle.Secondary).setEmoji('🔁').setLabel(loopLabel)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('p:volume_down').setStyle(ButtonStyle.Secondary).setEmoji('🔉'),
        new ButtonBuilder().setCustomId('p:volume_up').setStyle(ButtonStyle.Secondary).setEmoji('🔊'),
        new ButtonBuilder().setCustomId('p:clear').setStyle(ButtonStyle.Danger).setEmoji('🧹').setLabel('Clear'),
        new ButtonBuilder().setCustomId('p:shuffle').setStyle(ButtonStyle.Primary).setEmoji('🔀').setLabel('Shuffle'),
        new ButtonBuilder()
            .setCustomId('p:autoplay')
            .setStyle(snapshot.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🤖')
            .setLabel(snapshot.autoplay ? 'Autoplay: On' : 'Autoplay: Off')
    );

    const row3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('filter')
            .setPlaceholder('🎚️ Select a filter ...')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                { label: 'Turn Off', value: 'default' },
                ...FILTERS.map((f) => ({ label: f.label, value: f.name }))
            )
    );

    return [row1, row2, row3];
}

export function buildNowPlayingPanel(snapshot: PlayerSnapshot): { embeds: import('discord.js').EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } {
    const embed = createNowPlayingEmbed(snapshot);
    return {
        embeds: [embed],
        components: buildControlRows(snapshot)
    };
}

export function buildSupportRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Support Server')
            .setURL(config.bot.supportServer)
    );
}
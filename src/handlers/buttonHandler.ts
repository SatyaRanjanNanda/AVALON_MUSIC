import { ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { shoukaku } from '../index';

export const handleButtonInteraction = async (interaction: ButtonInteraction) => {
    const player = shoukaku.players.get(interaction.guildId!);
    if (!player) {
        await interaction.reply({ content: 'There is no music playing right now.', ephemeral: true });
        return;
    }

    if (interaction.customId === 'music_pause') {
        const isPaused = player.paused;
        await player.setPaused(!isPaused);
        await interaction.reply({ content: isPaused ? '?? Resumed the music!' : '?? Paused the music!', ephemeral: true });
    } else if (interaction.customId === 'music_skip') {
        await player.stopTrack(); 
        await interaction.reply({ content: '?? Skipped the track!', ephemeral: true });
    } else if (interaction.customId === 'music_stop') {
        await shoukaku.leaveVoiceChannel(interaction.guildId!);
        await interaction.reply({ content: '?? Stopped the music and left the channel!', ephemeral: true });
    } else if (interaction.customId === 'music_filter_menu') {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('music_filter_select')
                    .setPlaceholder('Select a filter to apply')
                    .addOptions([
                        { label: 'Bassboost', value: 'bassboost' },
                        { label: 'Nightcore', value: 'nightcore' },
                        { label: '8D', value: '8d' },
                        { label: 'Vaporwave', value: 'vaporwave' },
                        { label: 'Clear (Remove Filters)', value: 'clear' }
                    ])
            );
        await interaction.reply({ content: 'Please select a filter:', components: [row], ephemeral: true });
    } else {
        await interaction.reply({ content: 'Unknown button interaction.', ephemeral: true });
    }
};

export const handleSelectMenuInteraction = async (interaction: StringSelectMenuInteraction) => {
    if (interaction.customId !== 'music_filter_select') return;

    const player = shoukaku.players.get(interaction.guildId!);
    if (!player) {
        await interaction.reply({ content: 'There is no music playing right now.', ephemeral: true });
        return;
    }

    const preset = interaction.values[0];

    switch (preset) {
        case 'bassboost':
            await player.setFilters({
                equalizer: [
                    { band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 },
                    { band: 3, gain: 0.05 }, { band: 4, gain: 0.0 }, { band: 5, gain: -0.05 },
                ]
            });
            break;
        case 'nightcore':
            await player.setFilters({ timescale: { speed: 1.1, pitch: 1.2, rate: 1.0 } });
            break;
        case '8d':
            await player.setFilters({ rotation: { rotationHz: 0.2 } });
            break;
        case 'vaporwave':
            await player.setFilters({ timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 } });
            break;
        case 'clear':
            await player.clearFilters();
            break;
    }

    await interaction.update({ content: \Applied filter: **\**\, components: [] });
};

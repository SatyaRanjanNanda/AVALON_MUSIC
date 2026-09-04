import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { useQueue } from 'discord-player';

const filterCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply audio filters to make the bot sound good')
        .addStringOption(option => 
            option.setName('preset')
                .setDescription('The filter preset to apply')
                .setRequired(true)
                .addChoices(
                    { name: 'Bassboost', value: 'bassboost' },
                    { name: 'Nightcore', value: 'nightcore' },
                    { name: '8D', value: '8D' },
                    { name: 'Vaporwave', value: 'vaporwave' },
                    { name: 'Clear', value: 'clear' }
                )
        ),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        const preset = interaction.options.getString('preset', true);

        if (preset === 'clear') {
            await queue.filters.ffmpeg.setFilters(false);
            await interaction.reply('Cleared all filters!');
            return;
        }

        await queue.filters.ffmpeg.toggle(preset as any);

        await interaction.reply(`Toggled filter: **${preset}**`);
    }
};

export default filterCommand;

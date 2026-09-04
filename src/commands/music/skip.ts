import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { useQueue } from 'discord-player';

const skipCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        queue.node.skip();

        await interaction.reply('Skipped the current song.');
    }
};

export default skipCommand;

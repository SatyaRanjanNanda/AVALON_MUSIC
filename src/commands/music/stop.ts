import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { useQueue } from 'discord-player';

const stopCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue) {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        // Delete the queue and leave the channel
        queue.delete();

        await interaction.reply('Stopped the music and left the voice channel.');
    }
};

export default stopCommand;

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';

const stopCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const player = shoukaku.players.get(interaction.guildId!);
        
        if (!player) {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        // Leave the voice channel
        await shoukaku.leaveVoiceChannel(interaction.guildId!);

        await interaction.reply('Stopped the music and left the voice channel.');
    }
};

export default stopCommand;

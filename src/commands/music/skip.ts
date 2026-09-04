import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';

const skipCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const player = shoukaku.players.get(interaction.guildId!);
        
        if (!player) {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        // Shoukaku v4 stops the track when we call stopTrack(). If we had a queue system we'd play the next one.
        // For now this will just stop the current track.
        await player.stopTrack();

        await interaction.reply('Skipped the current song.');
    }
};

export default skipCommand;

import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';
import { CommandContext } from '../../structures/CommandContext';

const skipCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    execute: async (context: CommandContext) => {
        await context.deferReply();

        const player = shoukaku.players.get(context.guildId!);
        
        if (!player) {
            await context.editReply('There is no music playing in this server.');
            return;
        }

        const member = context.member;
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            await context.editReply('You must be in a voice channel to skip music.');
            return;
        }

        await player.stopTrack(); // Emits end event for next song if queue is implemented
        await context.editReply('?? Skipped the track!');
    }
};

export default skipCommand;

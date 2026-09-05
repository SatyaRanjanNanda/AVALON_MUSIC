import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';
import { CommandContext } from '../../structures/CommandContext';

const stopCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and leaves the channel'),
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
            await context.editReply('You must be in a voice channel to stop music.');
            return;
        }

        await shoukaku.leaveVoiceChannel(context.guildId!);
        await context.editReply('?? Stopped the music and left the channel!');
    }
};

export default stopCommand;

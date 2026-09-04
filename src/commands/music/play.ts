import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { player } from '../../index';

const playCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube or Spotify')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('The song name or URL')
                .setRequired(true)
        ),
    execute: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();
        
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            await interaction.editReply('You must be in a voice channel to play music.');
            return;
        }

        const query = interaction.options.getString('query', true);

        try {
            const { track } = await player.play(voiceChannel, query, {
                nodeOptions: {
                    metadata: interaction,
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 30000,
                    leaveOnEnd: true,
                    leaveOnEndCooldown: 300000,
                }
            });

            await interaction.editReply(`Added to queue: **${track.title}** by ${track.author}`);
        } catch (e) {
            console.error(e);
            await interaction.editReply(`Something went wrong while trying to play **${query}**!`);
        }
    }
};

export default playCommand;

import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';
import { CommandContext } from '../../structures/CommandContext';

const playCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube or Spotify')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('The song name or URL')
                .setRequired(true)
        ),
    execute: async (context: CommandContext) => {
        await context.deferReply();
        
        const member = context.member;
        const voiceChannel = member?.voice.channel;
        
        if (!voiceChannel) {
            await context.editReply('You must be in a voice channel to play music.');
            return;
        }

        let query = '';
        if (context.isInteraction) {
            query = context.interaction!.options.getString('query', true);
        } else {
            if (context.args.length === 0) {
                await context.editReply('Please provide a song name or URL.');
                return;
            }
            query = context.args.join(' ');
        }
        
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        if (!node) {
            await context.editReply('No Lavalink nodes are available.');
            return;
        }

        const result = await node.rest.resolve(\ytmsearch:\\);
        if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
            await context.editReply('No results found.');
            return;
        }

        const track = result.data[0];

        let player = shoukaku.players.get(context.guildId!);
        if (!player) {
            player = await shoukaku.joinVoiceChannel({
                guildId: context.guildId!,
                channelId: voiceChannel.id,
                shardId: 0
            });
        }

        if (!player) {
            await context.editReply('Failed to join the voice channel.');
            return;
        }

        await player.playTrack({ track: { encoded: track.encoded } });

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Now Playing')
            .setDescription(\**\**\nby \\)
            .setURL(track.info.uri || null);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_filter_menu')
                    .setEmoji('???')
                    .setStyle(ButtonStyle.Success)
            );

        await context.editReply({ embeds: [embed], components: [row] });
    }
};

export default playCommand;

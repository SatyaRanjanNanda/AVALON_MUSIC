import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';

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
        
        // Get a lavalink node
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        if (!node) {
            await interaction.editReply('No Lavalink nodes are available.');
            return;
        }

        // Search for the track
        const result = await node.rest.resolve(`ytmsearch:${query}`);
        if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
            await interaction.editReply('No results found.');
            return;
        }

        const track = result.data[0];

        // Join the voice channel
        let player = shoukaku.players.get(interaction.guildId!);
        if (!player) {
            player = await shoukaku.joinVoiceChannel({
                guildId: interaction.guildId!,
                channelId: voiceChannel.id,
                shardId: 0 // Default shard id
            });
        }

        if (!player) {
            await interaction.editReply('Failed to join the voice channel.');
            return;
        }

        // Play the track
        await player.playTrack({ track: { encoded: track.encoded } });

        await interaction.editReply(`Now playing: **${track.info.title}** by ${track.info.author}`);
    }
};

export default playCommand;

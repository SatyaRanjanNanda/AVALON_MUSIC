import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { client, settings } from '../../core';
import { CentralEmbedHandler } from '../../utils/centralEmbed';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('setup-central')
        .setDescription('Setup the central music system in current channel')
        .addChannelOption((option) =>
            option
                .setName('voice-channel')
                .setDescription('Voice channel for music (optional)')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option.setName('allowed-role').setDescription('Role allowed to use central system (optional)').setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guildId;
        if (!guildId) return;

        const channelId = interaction.channel?.id;
        if (!channelId) return;

        const serverConfig = await settings.get(guildId);
        if (serverConfig.centralEnabled) {
            await interaction.editReply({
                content: '❌ Central music system is already setup! Use `/disable-central` first to reset.'
            });
            return;
        }

        const voiceChannel = interaction.options.getChannel('voice-channel');
        const allowedRole = interaction.options.getRole('allowed-role');

        const channel = interaction.channel;
        const botMember = interaction.guild?.members.me;
        const permissions = channel && 'permissionsFor' in channel && botMember ? channel.permissionsFor(botMember) : null;
        if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks', 'ManageMessages'])) {
            await interaction.editReply({
                content: '❌ I need `Send Messages`, `Embed Links`, and `Manage Messages` permissions in this channel!'
            });
            return;
        }

        const centralHandler = new CentralEmbedHandler(client, settings);
        const embedMessage = await centralHandler.createCentralEmbed(channelId, guildId);

        if (!embedMessage) {
            await interaction.editReply({ content: '❌ Failed to create central embed!' });
            return;
        }

        await settings.set(guildId, {
            centralEnabled: true,
            centralChannelId: channelId,
            centralEmbedId: embedMessage.id,
            centralVcChannelId: voiceChannel?.id ?? null,
            centralAllowedRoles: allowedRole ? [allowedRole.id] : []
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Central Music System Setup Complete!')
            .setDescription(`Central music control has been setup in <#${channelId}>`)
            .addFields(
                { name: '📍 Channel', value: `<#${channelId}>`, inline: true },
                { name: '🔊 Voice Channel', value: voiceChannel ? `<#${voiceChannel.id}>` : 'Not set', inline: true },
                { name: '👥 Allowed Role', value: allowedRole ? `<@&${allowedRole.id}>` : 'Everyone', inline: true }
            )
            .setColor(0x00ff00)
            .setFooter({ text: 'Users can now type song names in the channel to play music!' });

        await interaction.editReply({ embeds: [successEmbed] });

        setTimeout(async () => {
            try {
                if (!interaction.channel || !('send' in interaction.channel)) return;
                const usageEmbed = new EmbedBuilder()
                    .setTitle('🎵 Central Music System Active!')
                    .setDescription(
                        '• Type any **song name** to play music\n' +
                        '• Links (YouTube, Spotify) are supported\n' +
                        '• Other messages will be auto-deleted\n' +
                        '• Use normal commands (`!play`, `/play`) in other channels\n\n' +
                        '⚠️ This message will be automatically deleted in 10 seconds!'
                    )
                    .setColor(0x1db954)
                    .setFooter({ text: 'Enjoy your music!' });

                const msg = await interaction.channel.send({ embeds: [usageEmbed] }).catch(() => null);
                if (msg) {
                    setTimeout(() => {
                        msg.delete().catch(() => undefined);
                    }, 10000);
                }
            } catch (error) {
                console.error('Error sending usage instructions:', error);
            }
        }, 2000);
    }
};

export default command;
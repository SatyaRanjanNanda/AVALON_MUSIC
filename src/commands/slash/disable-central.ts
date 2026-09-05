import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { SlashCommand } from '../../types';
import { client, settings } from '../../core';
import { CentralEmbedHandler } from '../../utils/centralEmbed';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('disable-central')
        .setDescription('Disable the central music system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guildId;
        if (!guildId) return;

        const serverConfig = await settings.get(guildId);
        if (!serverConfig.centralEnabled) {
            await interaction.editReply({ content: '❌ Central music system is not configured!' });
            return;
        }

        const centralHandler = new CentralEmbedHandler(client, settings);
        await centralHandler.disableCentral(guildId);

        await interaction.editReply({ content: '✅ Central music system disabled successfully!' });
    }
};

export default command;
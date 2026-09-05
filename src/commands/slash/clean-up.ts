import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { SlashCommand } from '../../types';
import { client } from '../../core';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('clean-up')
        .setDescription('Clean up the bot\'s messages in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel || !('messages' in channel)) {
            await interaction.editReply({ content: '❌ This command can only be used in a text channel!' });
            return;
        }

        const botId = client.user?.id;
        if (!botId) return;

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const botMessages = messages.filter((message) => message.author.id === botId);

            let deleted = 0;
            for (const message of botMessages.values()) {
                const age = Date.now() - message.createdTimestamp;
                if (age < 2000) continue;
                try {
                    await message.delete();
                    deleted += 1;
                } catch {
                    /* skip messages too old to bulk manage */
                }
            }

            await interaction.editReply({
                content: deleted > 0 ? `🧹 Deleted **${deleted}** bot messages!` : '🧹 No bot messages found to clean up.'
            });
        } catch (error) {
            console.error('Clean-up error:', (error as Error)?.message || error);
            await interaction.editReply({ content: '❌ An error occurred while cleaning up messages!' });
        }
    }
};

export default command;
import type { MessageCommand } from '../../types';
import { settings } from '../../core';
import { createErrorEmbed, successEmbed } from '../../utils/embedUtils';

const command: MessageCommand = {
    name: 'setprefix',
    aliases: ['set-prefix'],
    description: 'Override the bot prefix for this server',
    async execute(message, args) {
        const guildId = message.guild!.id;
        const newPrefix = (args[0] || '').trim();

        if (!newPrefix) {
            await message.reply({
                embeds: [createErrorEmbed('❌ You must provide a new prefix, e.g. `setprefix ?`')]
            }).catch(() => undefined);
            return;
        }

        const blocked = ['@everyone', '@here', '<@', '>', '\\', '`'];
        if (newPrefix.length > 3 || blocked.some((token) => newPrefix.includes(token))) {
            await message.reply({
                embeds: [createErrorEmbed('❌ Invalid prefix! Use 1-3 characters without spaces, mentions or special symbols.')]
            }).catch(() => undefined);
            return;
        }

        const serverConfig = await settings.get(guildId);
        if (serverConfig.prefix === newPrefix) {
            await message.reply({
                embeds: [successEmbed(`✅ The prefix is already set to \`${newPrefix}\`.`)]
            }).catch(() => undefined);
            return;
        }

        await settings.set(guildId, { prefix: newPrefix });
        const mention = `<@${message.client.user?.id}>`;

        await message.reply({
            embeds: [
                successEmbed(
                    `✅ Prefix changed to \`${newPrefix}\` for this server.\n> Use \`${newPrefix}prefix\` to view it anytime, or tag the bot with \`${mention} <command>\`.`
                )
            ]
        }).catch(() => undefined);
    }
};

export default command;
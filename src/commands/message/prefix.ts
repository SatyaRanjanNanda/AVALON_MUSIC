import type { MessageCommand } from '../../types';
import { settings } from '../../core';
import { successEmbed } from '../../utils/embedUtils';

const command: MessageCommand = {
    name: 'prefix',
    aliases: [],
    description: 'Show the current bot prefix',
    async execute(message) {
        const serverConfig = await settings.get(message.guild!.id);
        const prefix = serverConfig.prefix || '!';
        const mention = `<@${message.client.user?.id}>`;

        await message.reply({
            embeds: [
                successEmbed(
                    `🏷️ **Current prefix:** \`${prefix}\`\n> You can also tag the bot to use commands, e.g. \`${mention} play <song>\`\n> Change it with \`${prefix}setprefix <new prefix>\``
                )
            ]
        }).catch(() => undefined);
    }
};

export default command;
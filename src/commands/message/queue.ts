import type { MessageCommand } from '../../types';
import { queueEmbed } from '../../utils/embedUtils';
import { autoDelete } from '../../utils/helpers';

const command: MessageCommand = {
    name: 'queue',
    aliases: ['q', 'list', 'playlist', 'songs'],
    description: 'Show the current queue',
    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const page = parseInt(args[0] || '1', 10) || 1;
        const embed = await queueEmbed(guildId, page);

        const reply = await message.reply({ embeds: [embed] }).catch(() => null);
        if (reply) autoDelete(reply, 10000);
        autoDelete(message, 4000);
    }
};

export default command;
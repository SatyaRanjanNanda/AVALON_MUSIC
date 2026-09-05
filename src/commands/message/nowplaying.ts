import type { MessageCommand } from '../../types';
import { queueEmbed } from '../../utils/embedUtils';
import { autoDelete } from '../../utils/helpers';

const command: MessageCommand = {
    name: 'nowplaying',
    aliases: ['np'],
    description: 'Show what is currently playing',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const embed = await queueEmbed(guildId, 1);
        const reply = await message.reply({ embeds: [embed] }).catch(() => null);
        if (reply) autoDelete(reply, 10000);
        autoDelete(message, 4000);
    }
};

export default command;
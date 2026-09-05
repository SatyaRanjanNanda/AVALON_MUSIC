import type { MessageCommand } from '../../types';
import config from '../../config';

const command: MessageCommand = {
    name: 'support',
    aliases: ['invite', 'server'],
    description: 'Get the support server invite link',
    async execute(message) {
        await message.reply({
            embeds: [
                {
                    color: 0x9966ff,
                    title: '🛠️ Support Server',
                    description: `Join our support server for help and updates!\n\n${config.bot.supportServer}`,
                    footer: { text: 'Avalon Music' }
                }
            ]
        }).catch(() => undefined);
    }
};

export default command;
import type { MessageCommand } from '../../types';
import { messageCommands } from '../../handlers/commandHandler';

const command: MessageCommand = {
    name: 'help',
    aliases: ['h', 'commands'],
    description: 'Show all available commands',
    async execute(message) {
        const uniqueCommands = new Map<string, MessageCommand>();
        for (const cmd of messageCommands.values()) {
            if (!uniqueCommands.has(cmd.name)) uniqueCommands.set(cmd.name, cmd);
        }

        const lines = [...uniqueCommands.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((cmd) => {
                const aliases = cmd.aliases.length > 0 ? ` *(aliases: ${cmd.aliases.map((a) => `\`${a}\``).join(', ')})*` : '';
                return `**\`!${cmd.name}\`** - ${cmd.description}${aliases}`;
            });

        const reply = await message.reply({
            embeds: [
                {
                    color: 0x9966ff,
                    title: '🎵 Avalon Music Commands',
                    description: lines.join('\n'),
                    footer: { text: 'Use !help <command> for more info' }
                }
            ]
        }).catch(() => null);

        if (reply) setTimeout(() => reply.delete().catch(() => undefined), 15000);
    }
};

export default command;
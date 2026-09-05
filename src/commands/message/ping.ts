import type { MessageCommand } from '../../types';

const command: MessageCommand = {
    name: 'ping',
    aliases: ['latency'],
    description: 'Check the bot latency',
    async execute(message) {
        const sent = Date.now();
        const reply = await message.reply('🏓 Pinging...').catch(() => null);
        if (!reply) return;

        const latency = Date.now() - sent;
        const apiLatency = Math.round(message.client.ws.ping);
        const content = `🏓 **Pong!** Latency: **${latency}ms** | API Latency: **${apiLatency}ms**`;

        await reply.edit({
            embeds: [{ color: 0x9bff00, description: content }]
        }).catch(() => undefined);
    }
};

export default command;
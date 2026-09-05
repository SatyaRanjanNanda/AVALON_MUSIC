import { EmbedBuilder } from 'discord.js';

export function catchError(error: unknown): void {
    if (error instanceof Error) {
        console.error(`[error] ${error.name}: ${error.message}\n${error.stack || ''}`);
    } else {
        console.error('[error]', error);
    }
}

export function createErrorResponse(title: string, message: string): { embeds: EmbedBuilder[] } {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`❌ ${title}`)
        .setDescription(message);
    return { embeds: [embed] };
}
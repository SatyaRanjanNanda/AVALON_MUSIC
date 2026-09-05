import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { client, settings } from '../core';
import { ConditionChecker } from '../utils/checks';
import { autoDelete } from '../utils/helpers';

export interface ReplyOptions {
    ms?: number;
    color?: number;
    delete: boolean;
}

export function interactionVoiceChannelId(
    interaction: ChatInputCommandInteraction
): string | null {
    if (!interaction.inCachedGuild()) return null;
    return interaction.member?.voice?.channelId ?? null;
}

export async function createChecker(): Promise<ConditionChecker> {
    return new ConditionChecker(client, settings);
}

export async function getConditions(
    guildId: string,
    userId: string,
    voiceChannelId: string | null | undefined,
    fromCentral = false
): Promise<{ ok: boolean; error: string | null; conditions: Awaited<ReturnType<ConditionChecker['checkMusicConditions']>> }> {
    const checker = await createChecker();
    const conditions = await checker.checkMusicConditions(guildId, userId, voiceChannelId ?? null, fromCentral);
    return { ok: !checker.getErrorMessage(conditions), error: checker.getErrorMessage(conditions), conditions };
}

export function successEmbed(description: string, color = 0x9bff00): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export function errorEmbed(description: string, color = 0xff3b3b): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export async function msgReply(
    message: Message,
    description: string,
    options: Partial<ReplyOptions> = {}
): Promise<Message | null> {
    const { ms = 3000, delete: deleteCommand = true, color = 0x9966ff } = options;
    const embed = errorEmbed(description, color);
    const reply = await message.reply({ embeds: [embed] }).catch(() => null);
    if (reply) autoDelete(reply, ms);
    if (deleteCommand) autoDelete(message, 4000);
    return reply;
}

export async function msgError(
    message: Message,
    description: string,
    options: Partial<ReplyOptions> = {}
): Promise<Message | null> {
    return msgReply(message, description, { color: 0xff3b3b, ...options });
}

export async function slashReply(
    interaction: ChatInputCommandInteraction,
    description: string,
    ms = 3000
): Promise<void> {
    const embed = successEmbed(description);
    await interaction.editReply({ embeds: [embed] }).catch(() => undefined);
    if (ms > 0) setTimeout(() => interaction.deleteReply().catch(() => undefined), ms);
}

export async function slashError(
    interaction: ChatInputCommandInteraction,
    description: string,
    ms = 3000
): Promise<void> {
    const embed = errorEmbed(description);
    await interaction.editReply({ embeds: [embed] }).catch(() => undefined);
    if (ms > 0) setTimeout(() => interaction.deleteReply().catch(() => undefined), ms);
}
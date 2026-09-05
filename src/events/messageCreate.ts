import { Events, type Client, type Message } from 'discord.js';
import { music, settings } from '../core';
import { messageCommands } from '../handlers/commandHandler';
import { createErrorEmbed } from '../utils/embedUtils';
import { autoDelete, formatDuration, isUrl, mentionRequester, normalizeQuery } from '../utils/helpers';

const SUPPORT_TEXT = 'https://discord.gg/xQF9f9yUEM\nhttps://glaceyt.com';
const SPAM_THRESHOLD = 3;
const COOLDOWN_TIME = 5000;

const anthemSpam = new Map<string, { count: number; lastReset: number }>();

export const name = Events.MessageCreate;
export const once = false;

async function scheduleDelete(message: Message, ms = 4000): Promise<void> {
    autoDelete(message, ms);
}

async function sendCentralError(message: Message, description: string): Promise<void> {
    const reply = await message.reply({ embeds: [createErrorEmbed(description)] }).catch(() => null);
    if (reply) autoDelete(reply, 5000);
    scheduleDelete(message, 4000);
}

async function handleCentralSongRequest(message: Message): Promise<void> {
    const guildId = message.guild?.id;
    if (!guildId) return;

    const serverConfig = await settings.get(guildId);
    if (!serverConfig.centralEnabled) return;

    const member = message.member;
    const botVC = message.guild?.members.me?.voice.channelId ?? null;
    const centralVC = serverConfig.centralVcChannelId ?? null;
    const userVC = member?.voice?.channelId ?? null;

    if (serverConfig.centralAllowedRoles?.length) {
        const hasRole = member?.roles.cache.some((role) => serverConfig.centralAllowedRoles!.includes(role.id));
        if (!hasRole) {
            scheduleDelete(message, 1500);
            return;
        }
    }

    const content = (message.content || '').trim();

    if (!isUrl(content)) {
        if (message.author.bot) {
            scheduleDelete(message, 1000);
            return;
        }

        const stamps = anthemSpam.get(guildId) ?? { count: 0, lastReset: 0 };
        const now = Date.now();
        if (now - stamps.lastReset > COOLDOWN_TIME) {
            stamps.count = 0;
            stamps.lastReset = now;
        }
        stamps.count += 1;
        anthemSpam.set(guildId, stamps);

        if (stamps.count >= SPAM_THRESHOLD) {
            stamps.count = 0;
            stamps.lastReset = now;
            await sendCentralError(message, '❌ Please slow down! Max 3 song requests every 5 seconds.');
            return;
        }

        const isSongQuery = /^(?!.*@)(?!.*#)(?!.*\d{17,19})(?=.*[a-zA-Z])[\s\S]{1,150}$/.test(content);
        if (!isSongQuery) {
            scheduleDelete(message, 1500);
            return;
        }
    }

    if (botVC && centralVC && botVC !== centralVC && (userVC !== centralVC)) {
        await sendCentralError(
            message,
            `❌ I'm currently in the central voice channel of another setup. Join <#${centralVC}> to control the music.`
        );
        return;
    }

    if (centralVC && (!userVC || userVC !== centralVC)) {
        await sendCentralError(message, `❌ You need to be in the central voice channel <#${centralVC}> to play music!`);
        return;
    }

    const targetVC = centralVC || userVC;
    if (!targetVC) {
        await sendCentralError(message, '❌ You need to be in a voice channel first!');
        return;
    }

    const player = await music.createPlayer(guildId, targetVC, message.channel.id);
    if (!player) {
        await sendCentralError(message, '❌ Failed to create voice connection!');
        return;
    }

    const query = normalizeQuery(content);
    const result = await music.playSong(player, query, message.author);

    if (result.type === 'error') {
        await sendCentralError(message, `❌ ${result.message}`);
        return;
    }

    if (result.type === 'playlist') {
        await message.reply({
            embeds: [
                createErrorEmbed(
                    `🎵 Added **${result.tracksCount}** songs from playlist **${result.name}** to the queue!`
                ).setColor(0x9bff00)
            ]
        }).catch(() => null);
    } else {
        const track = result.track;
        const title = track?.info.title || 'Unknown Song';
        await message.reply({
            embeds: [
                createErrorEmbed(
                    `🎵 Now playing **${title}** • ${mentionRequester(message.author)}\n> ${formatDuration(track?.info.length || 0)}`
                ).setColor(0x9bff00)
            ]
        }).catch(() => null);
    }

    scheduleDelete(message, 4000);
}

export async function execute(client: Client, message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const content = (message.content || '').trim();

    if (content === 'glaceyt' || content === 'shiva') {
        await message.reply(SUPPORT_TEXT).catch(() => undefined);
        return;
    }

    if (!client.user) return;

    const serverConfig = await settings.get(message.guild.id);

    if (serverConfig.centralEnabled && message.channel.id === serverConfig.centralChannelId) {
        if (message.author.bot) {
            autoDelete(message, 500);
            return;
        }
        await handleCentralSongRequest(message);
        return;
    }

    const mentionPrefix = `<@${client.user.id}>`;
    const hasMentionPrefix = content.startsWith(mentionPrefix) || content.startsWith(`<@!${client.user.id}>`);

    let prefix: string | null = null;
    if (content.startsWith(serverConfig.prefix || '!')) {
        prefix = serverConfig.prefix || '!';
    } else if (hasMentionPrefix) {
        prefix = mentionPrefix;
    }

    if (!prefix) return;

    let args = content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = messageCommands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`Error executing message command "${commandName}":`, error);
        await message.reply({ embeds: [createErrorEmbed('❌ An error occurred while executing that command.')] }).catch(() => undefined);
    }
}
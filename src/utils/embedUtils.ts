import { EmbedBuilder } from 'discord.js';
import config from '../config';
import { riffy, client } from '../core';
import { formatDuration, getProgressBar, getTrackThumbnail, mentionRequester } from './helpers';
import type { Track, PlayerSnapshot } from '../types';

export const embedColor = config.bot.embedColor;

const LOGO = 'https://cdn.dribbble.com/userupload/21568836/file/original-45df2d9f2c473228a5973292b0849286.gif';
// const BANNER = 'https://cdn.discordapp.com/attachments/1126319852531294250/1313984446153818159/bg.png';

export function createNowPlayingEmbed(snapshot: PlayerSnapshot): EmbedBuilder {
    const time = `\`${formatDuration(snapshot.position)} / ${formatDuration(snapshot.duration)}\``;
    const progressLine = getProgressBar(snapshot.position, snapshot.duration);
    const requester = mentionRequester(snapshot.requester);

    return new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '🎶 Now Playing', iconURL: LOGO })
        .setTitle(snapshot.title)
        .setDescription(`\`\`\`\n${progressLine}\n\`\`\`\n${time}`)
        .addFields(
            { name: '👤 Artist', value: snapshot.author, inline: true },
            { name: '⏱️ Duration', value: formatDuration(snapshot.duration), inline: true },
            { name: '🎚️ Volume', value: `${snapshot.volume}%`, inline: true },
            { name: '🔁 Loop', value: snapshot.loop === 'track' ? '🔂 Track' : snapshot.loop === 'queue' ? '🔁 Queue' : '❌ Off', inline: true },
            { name: '🤖 Autoplay', value: snapshot.autoplay ? '✅ On' : '❌ Off', inline: true },
            { name: '🎧 Requested by', value: requester, inline: true }
        )
        .setThumbnail(snapshot.thumbnail || LOGO)
        .setFooter({ text: `Library · Discord Music Bot`, iconURL: client.user?.displayAvatarURL({ extension: 'png', size: 128 }) });
}

export function createQueueEmbed(snapshot: Pick<PlayerSnapshot, 'loop' | 'volume' | 'autoplay' | 'queueLength' | 'title' | 'author' | 'duration' | 'thumbnail' | 'requester' | 'position'>): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '📜 Current Queue', iconURL: LOGO })
        .setTitle(snapshot.title)
        .setDescription(`by ${snapshot.author}`)
        .addFields(
            { name: '🔁 Loop', value: snapshot.loop === 'track' ? 'Track' : snapshot.loop === 'queue' ? 'Queue' : 'Off', inline: true },
            { name: '🎚️ Volume', value: `${snapshot.volume}%`, inline: true },
            { name: '🤖 Autoplay', value: snapshot.autoplay ? 'On' : 'Off', inline: true }
        )
        .setThumbnail(snapshot.thumbnail || LOGO);
}

export function createQueueEndedEmbed(brief: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '🎵 List Ended', iconURL: LOGO })
        .setTitle('Queue / Playlist Finished')
        .setDescription(`\`\`\`\n─────────────────●\n\`\`\`\n${brief}\n\nAdd more songs with \`/play <name or URL>\`.`)
        .setFooter({ text: 'Library · Discord Music Bot', iconURL: client.user?.displayAvatarURL({ extension: 'png', size: 128 }) });
}

export async function queueEmbed(guildId: string, page = 1): Promise<EmbedBuilder> {
    const player = riffy.players.get(guildId);
    const embed = new EmbedBuilder().setColor(embedColor).setAuthor({ name: '📜 Current Queue', iconURL: LOGO });

    if (!player || !player.current) {
        return embed.setDescription('❌ Nothing is playing right now!');
    }

    const queueTracks = player.queue.map((track, index) => {
        const duration = track?.info?.length ? formatDuration(track.info.length) : 'Unknown';
        return `**\`${index + 1}.\`** ${track?.info?.title || 'Unknown'} • \`${duration}\` • ${track?.info?.author || 'Unknown'}`;
    });

    const maxPages = Math.max(1, Math.ceil(player.queue.size / 10));
    const pageItems = queueTracks.slice((page - 1) * 10, page * 10);

    embed
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${player.current.info?.title || 'Unknown'}](${player.current.info?.uri || ''})**\n👤 ${player.current.info?.author || 'Unknown'} • \`${formatDuration(player.current.info?.length || 0)}\``)
        .addFields({
            name: `📃 Queue (${player.queue.size} tracks)`,
            value: pageItems.length > 0 ? pageItems.join('\n') : '*Queue is empty*'
        })
        .setFooter({ text: `Page ${page}/${maxPages}` });

    const currentThumb = player.current.info?.uri ? getTrackThumbnail(player.current) : null;
    if (currentThumb) {
        embed.setThumbnail(currentThumb);
    }

    return embed;
}

export function successEmbed(description: string, color = 0x4caf50): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export function errorEmbed(description: string, color = 0xff5555): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export function createSuccessEmbed(description: string, color = 0x4caf50): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export function createErrorEmbed(description: string, color = 0xff5555): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

export function createTrackAddedEmbed(
    track: Track,
    requester: unknown,
    positionInQueue: number,
    type: 'track' | 'playlist' | 'search' = 'track',
    extra = ''
): EmbedBuilder {
    const thumbnail = getTrackThumbnail(track);
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '🎵 Track Added to Queue', iconURL: 'https://img.icons8.com/color/96/000000/music--v1.png' })
        .setTitle(track.info.title)
        .setURL(track.info.uri || '')
        .setDescription(
            [
                `**👤 Artist:** ${track.info.author}`,
                `**⏱️ Duration:** \`${formatDuration(track.info.length)}\``,
                `**📌 Position:** \`${positionInQueue}\``,
                extra
            ]
                .filter(Boolean)
                .join('\n')
        )
        .setFooter({ text: `Requested by ${mentionRequester(requester)}` });

    if (thumbnail) embed.setThumbnail(thumbnail);
    return embed;
}

export function createTrackInfoEmbed(track: Track): EmbedBuilder {
    const thumbnail = getTrackThumbnail(track);
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(track.info.title)
        .setURL(track.info.uri || '')
        .addFields(
            { name: '👤 Artist', value: track.info.author || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: formatDuration(track.info.length), inline: true },
            { name: '📡 Source', value: track.info.sourceName || 'Unknown', inline: true }
        );
    if (thumbnail) embed.setThumbnail(thumbnail);
    return embed;
}

export { formatDuration, getTrackThumbnail, mentionRequester } from './helpers';
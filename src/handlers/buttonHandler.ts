import { EmbedBuilder, MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from 'discord.js';
import { music, riffy, settings } from '../core';
import { ConditionChecker } from '../utils/checks';
import { queueEmbed, successEmbed, errorEmbed } from '../utils/embedUtils';

async function getPlayer(guildId: string) {
    try {
        return riffy.players.get(guildId);
    } catch {
        return null;
    }
}

async function replyOn(interaction: ButtonInteraction, text: string[] | string, error = false) {
    const lines = Array.isArray(text) ? text : [text];
    const embed = error ? errorEmbed(lines.join('\n')) : successEmbed(lines.join('\n'));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => undefined);
    setTimeout(() => interaction.deleteReply().catch(() => undefined), 3000);
}

async function refreshState(guildId: string) {
    const player = await getPlayer(guildId);
    if (!player) return;
    await music.updateNowPlaying(guildId);
    await music.refreshPlayer(guildId);
}

export async function handleMusicButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'music_support' || customId === 'p:support') {
        return;
    }

    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    if (!guildId) return;

    const member = interaction.member;
    const voiceChannelId = member && 'voice' in member ? (member.voice as { channelId: string | null }).channelId : null;

    const checker = new ConditionChecker(interaction.client, settings);
    const conditions = await checker.checkMusicConditions(guildId, userId, voiceChannelId, true);
    const canUseFromCentralVc = await checker.canUseCentralSystem(guildId, userId);

    if (customId.startsWith('music_')) {
        const serverConfig = conditions.settings;
        if (conditions.centralEnabled && interaction.channelId === serverConfig.centralChannelId) {
            if (!voiceChannelId || voiceChannelId === conditions.centralVC) {
                if (!canUseFromCentralVc) {
                    return replyOn(interaction, '❌ You do not have permission to use the central music system!', true);
                }
            }
        } else if (!conditions.fromCentral || conditions.hasActivePlayer && !conditions.sameVoiceChannel) {
            if (conditions.botInCentralVC && conditions.centralVC && voiceChannelId !== conditions.centralVC) {
                return replyOn(
                    interaction,
                    `❌ I'm currently in the central music system! Join <#${conditions.centralVC}> first to control the bot.`,
                    true
                );
            }
        }
    }

    const player = await getPlayer(guildId);
    const loopModes = ['none', 'track', 'queue'] as const;

    switch (customId) {
        case 'music_pause':
        case 'p:pause': {
            if (!player || !conditions.isPlaying) return replyOn(interaction, '❌ Nothing is playing right now!', true);
            await player.pause(true);
            await replyOn(interaction, '⏸️ Music paused!');
            break;
        }
        case 'music_resume':
        case 'p:resume': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            await player.pause(false);
            await replyOn(interaction, '▶️ Music resumed!');
            break;
        }
        case 'music_skip':
        case 'p:skip': {
            if (!player || !conditions.isPlaying) return replyOn(interaction, '❌ Nothing to skip!', true);
            await music.skip(guildId);
            await replyOn(interaction, '⏭️ Skipped!');
            break;
        }
        case 'music_stop':
        case 'p:stop': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            await music.stop(guildId);
            await replyOn(interaction, '⏹️ Stopped and left the voice channel!');
            break;
        }
        case 'music_clear':
        case 'p:clear': {
            if (!player || player.queue.length === 0) return replyOn(interaction, '❌ Queue is already empty!', true);
            player.queue.clear();
            await replyOn(interaction, '🧹 Queue cleared!');
            break;
        }
        case 'music_loop':
        case 'p:loop': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            const next = loopModes[(loopModes.indexOf(player.loop as 'none' | 'track' | 'queue') + 1) % loopModes.length];
            await player.setLoop(next);
            const labels = { none: 'OFF', track: 'TRACK', queue: 'QUEUE' } as const;
            await replyOn(interaction, `🔁 Loop mode set to **${labels[next]}**`);
            break;
        }
        case 'music_queue':
        case 'p:queue': {
            const embed = await queueEmbed(guildId, 1);
await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => undefined);
            break;
        }
        case 'music_shuffle':
        case 'p:shuffle': {
            if (!player || player.queue.length === 0) return replyOn(interaction, '❌ Queue is empty!', true);
            player.queue.shuffle();
            await replyOn(interaction, '🔀 Queue shuffled!');
            break;
        }
        case 'music_volume_up':
        case 'p:volume_up': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            const volume = Math.min(100, player.volume + 10);
            await player.setVolume(volume);
            await replyOn(interaction, `🔊 Volume set to **${volume}%**`);
            break;
        }
        case 'music_volume_down':
        case 'p:volume_down': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            const volume = Math.max(0, player.volume - 10);
            await player.setVolume(volume);
            await replyOn(interaction, `🔉 Volume set to **${volume}%**`);
            break;
        }
        case 'p:autoplay': {
            if (!player) return replyOn(interaction, '❌ No active player!', true);
            const next = !player.isAutoplay;
            await music.setAutoplay(guildId, next);
            await replyOn(interaction, `🎲 Autoplay **${next ? 'enabled' : 'disabled'}**`);
            break;
        }
        case 'p:refresh': {
            await refreshState(guildId);
            await interaction.deferUpdate().catch(() => undefined);
            break;
        }
        default:
            await interaction.deferUpdate().catch(() => undefined);
            return;
    }

    await refreshState(guildId).catch(() => undefined);
}

export async function handleFilterSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    const player = await getPlayer(guildId);
    if (!player) {
        await replyOn(interaction as unknown as ButtonInteraction, '❌ No active player!', true);
        return;
    }

    const filter = interaction.values[0];
    try {
        if (filter === 'default') {
            await player.filters.clearFilters();
        } else {
            await player.filters.setEqualizer([]);
            switch (filter) {
                case 'bassboost':
                    await player.filters.setBassboost(true, { value: 5 });
                    break;
                case 'nightcore':
                    await player.filters.setNightcore(true);
                    break;
                case 'vaporwave':
                    await player.filters.setVaporwave(true);
                    break;
                case 'daycore':
                    await player.filters.setTimescale(true, { speed: 0.75, pitch: 0.9, rate: 1 });
                    break;
                case '8d':
                    await player.filters.setRotation(true, { rotationHz: 0.1 });
                    break;
                case 'karaoke':
                    await player.filters.setKaraoke(true);
                    break;
                case 'tremolo':
                    await player.filters.setTremolo(true);
                    break;
                case 'vibrato':
                    await player.filters.setVibrato(true);
                    break;
                case 'slowmo':
                    await player.filters.setTimescale(true, { speed: 0.6, pitch: 1, rate: 1 });
                    break;
                case 'pop':
                    await player.filters.setEqualizer([
                        { band: 0, gain: -0.05 },
                        { band: 1, gain: 0.1 },
                        { band: 2, gain: 0.05 },
                        { band: 3, gain: -0.05 },
                    ]);
                    break;
                case 'soft':
                    await player.filters.setLowPass(true, { smoothing: 100 });
                    break;
                case 'tv':
                    await player.filters.setEqualizer([
                        { band: 0, gain: 0 },
                        { band: 1, gain: 0.8 },
                        { band: 2, gain: -0.8 },
                    ]);
                    break;
                case 'china':
                    await player.filters.setTimescale(true, { speed: 1.12, pitch: 0.6, rate: 1 });
                    break;
            }
        }
        await interaction.deferUpdate().catch(() => undefined);
        await replyOn(interaction as unknown as ButtonInteraction, '✅ Filter applied!');
        await refreshState(guildId).catch(() => undefined);
    } catch (error) {
        console.error('Filter error:', error);
        await replyOn(interaction as unknown as ButtonInteraction, '❌ Failed to apply filter!', true);
    }
}
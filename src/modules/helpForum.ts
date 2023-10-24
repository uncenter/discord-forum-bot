import {
	ActionRowBuilder,
	AnyThreadChannel,
	ButtonBuilder,
	ButtonStyle,
	Channel,
	ChannelType,
	Events,
	ForumChannel,
	Message,
	TextBasedChannel,
	TextChannel,
	ThreadChannel,
} from 'discord.js';
import { Bot } from '~/bot';
import { ForumThread } from '~/types';

import { config } from '~/env';
import { del, get, set } from '~/utils/db';
import { logger } from '~/utils/logger';
import { buildEmbedMessage } from '~/utils/embed';
import { sendEmbedMessage } from '~/utils/message';
import { bold, cyan } from 'kleur/colors';

function findTag(channel: ForumChannel, name: string) {
	const tag = channel.availableTags.find((x) => x.name === name);
	if (!tag) throw new Error(`Could not find tag ${name}.`);
	return tag.id;
}

function generateHelpRequest(thread: ThreadChannel, forum: ForumChannel) {
	const tagStrings = thread.appliedTags.flatMap((t) => {
		const tag = forum.availableTags.find((at) => at.id === t);
		if (!tag) return [];
		if (!tag.emoji) return tag.name;

		const emoji = tag.emoji.id
			? `<:${tag.emoji.name}:${tag.emoji.id}>`
			: tag.emoji.name;
		return `${emoji} ${tag.name}`;
	});
	const tags = tagStrings ? `(${tagStrings.join(', ')})` : '';

	return `<@&${config.HELPER_ROLE_ID}> ${thread} ${tags}`;
}

export async function questionMeetsRequirements(
	thread: AnyThreadChannel,
	edit?: boolean,
) {
	const msg = await thread.fetchStarterMessage();
	if (!msg) logger.error("Couldn't find original message of thread.");
	const { content, id, channelId } = msg as Message<true>;

	const fields = [];

	if (content.length < 100 || content.split(' ').length < 20) {
		fields.push({
			name: 'Too short!',
			value: `Questions should be at least 100 characters or 20 words (currently at ${
				content.length
			} characters / ${
				content.split(' ').length
			} words) and include all relevant details about the problem.`,
		});
	}

	let embed;
	const components: ActionRowBuilder<ButtonBuilder>[] = [];
	if (fields.length > 0) {
		embed = buildEmbedMessage({
			title: 'We found some issues with your post.',
			fields: fields,
			type: 'error',
		});
		components.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Success)
					.setLabel('Try Again')
					.setCustomId(
						`try-again-thread-requirements::${channelId}::${id}`,
					),
			),
		);
	} else {
		embed = buildEmbedMessage({
			title: 'Your question meets all of the requirements.',
			description: 'A helper will help you as soon as possible.',
			type: 'success',
		});
	}
	if (!edit)
		thread.send({
			embeds: [embed],
			components: components,
		});
	return { embed, components };
}

const MAX_TAG_COUNT = 5;

function resolvedByHelper(owner: string, helper: string) {
	return `
<@${owner}>
Because your issue seemed to be resolved, this post was marked as resolved by <@${helper}>.
If your issue is not resolved, **you can reopen this post by running \`!reopen\`**.
*If you have a different question, make a new post in <#${config.HELP_FORUM_CHANNEL}>.*
`;
}

export async function helpForumModule(bot: Bot) {
	const channel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(config.HELP_FORUM_CHANNEL);
	if (channel?.type !== ChannelType.GuildForum) {
		logger.error(
			`Expected ${config.HELP_FORUM_CHANNEL} to be a forum channel.`,
		);
		return;
	}
	const forum = channel;
	const openTag = findTag(forum, config.HELP_FORUM_OPEN_TAG);
	const resolvedTag = findTag(forum, config.HELP_FORUM_RESOLVED_TAG);

	const helpRequestChannel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(config.HELP_REQUESTS_CHANNEL);
	if (!helpRequestChannel?.isTextBased()) {
		logger.fatal(`Expected ${helpRequestChannel} to be a text channel.`);
		return;
	}

	bot.client.on(Events.ThreadCreate, async (thread) => {
		const owner = await thread.fetchOwner();
		if (!owner?.user || !isHelpThread(thread)) return;
		logger.info(
			`Received new question from ${bold(
				owner.user.tag,
			)} in thread ${cyan(thread.id)}.`,
		);

		await set(
			['forum', thread.id],
			JSON.stringify({
				ownerId: owner.user.id,
			}),
			7 * 24 * 60 * 60,
		);

		await setStatus(thread, openTag);
		await questionMeetsRequirements(thread);
	});

	bot.client.on(Events.ThreadDelete, async (thread) => {
		if (!isHelpThread(thread)) return;
		await del(['forum', thread.id]);
	});

	bot.registerCommand({
		aliases: ['helper', 'helpers'],
		async listener(msg) {
			if (!isHelpThread(msg.channel)) {
				await sendEmbedMessage(
					msg.channel,
					buildEmbedMessage({
						title: 'You may only ping helpers from a help post!',
						type: 'warning',
					}),
				);
				return;
			}

			const thread = msg.channel;
			const threadData = await getHelpThread(thread.id);

			const isAsker = msg.author.id === threadData.ownerId;
			const isHelper = bot.isHelper(msg);

			if (!isAsker && !isHelper) {
				await sendEmbedMessage(
					thread,
					buildEmbedMessage({
						title: 'Only the asker can ping helpers!',
						type: 'warning',
					}),
				);
				return;
			}

			const pingAllowedAfter =
				+(
					threadData.lastHelpersPing ??
					thread.createdTimestamp ??
					Date.now()
				) +
				1000 * 60 * 60 * 2;

			// Ensure they've waited long enough (2 hours after posting).
			// Helpers (who aren't the asker) are allowed to disregard the timeout.

			if (isAsker && Date.now() < pingAllowedAfter) {
				await sendEmbedMessage(
					thread,
					buildEmbedMessage({
						title: 'Please wait a bit longer.',
						description: `You can ping helpers <t:${Math.ceil(
							pingAllowedAfter / 1000,
						)}:R>.`,
						type: 'warning',
					}),
				);
				return;
			}

			const helpRequestMsg = await helpRequestChannel.send(
				generateHelpRequest(thread, forum),
			);
			await sendEmbedMessage(
				thread,
				buildEmbedMessage({
					title: 'Helpers are on the way!',
					type: 'special',
				}),
			);
			await set(
				['forum', thread.id],
				JSON.stringify({
					...threadData,
					lastHelpersPing: Date.now(),
					helpRequestMsg: helpRequestMsg.id,
				}),
			);
		},
	});

	bot.registerCommand({
		aliases: ['resolved', 'resolve', 'close', 'closed', 'done', 'solved'],
		async listener(msg) {
			changeStatus(msg, true);
		},
	});

	bot.registerCommand({
		aliases: ['reopen', 'open', 'unresolved', 'unresolve'],
		async listener(msg) {
			changeStatus(msg, false);
		},
	});

	bot.client.on(Events.MessageReactionAdd, async (reaction) => {
		const message = reaction.message;
		const thread = await message.channel.fetch();
		if (!isHelpThread(thread)) return;

		const initial = await thread.fetchStarterMessage();
		if (initial?.id !== message.id) return;
		const tag = forum.availableTags.find(
			(t) =>
				t.emoji &&
				!t.moderated &&
				t.emoji.id === reaction.emoji.id &&
				t.emoji.name === reaction.emoji.name,
		);
		if (!tag) return;
		if (thread.appliedTags.length < MAX_TAG_COUNT) {
			await thread.setAppliedTags([...thread.appliedTags, tag.id]);
		}
		await reaction.remove();
	});

	async function changeStatus(msg: Message, resolved: boolean) {
		const thread = msg.channel;
		if (!isHelpThread(thread)) {
			await sendEmbedMessage(
				thread,
				buildEmbedMessage({
					title: 'Can only be run in a help post!',
					type: 'warning',
				}),
			);
			return;
		}

		const threadData = await getHelpThread(thread.id);

		const isAsker = msg.author.id === threadData.ownerId;
		const isHelper = bot.isHelper(msg);

		if (!isAsker && !isHelper) {
			await sendEmbedMessage(
				thread,
				buildEmbedMessage({
					title: 'Only the asker can change the status of a help post!',
					type: 'warning',
				}),
			);
			return;
		}

		await setStatus(thread, resolved ? resolvedTag : openTag);
		await sendEmbedMessage(
			thread,
			buildEmbedMessage({
				title: `Thread marked as ${resolved ? 'resolved' : 'opened'}.`,
				description: `Enter \`!${
					resolved ? 'reopen' : 'resolve'
				}\` to ${resolved ? 'reopen' : 'resolve'} the thread.`,
				type: 'info',
			}),
		);
		(helpRequestChannel as TextBasedChannel)?.messages.edit(
			threadData.helpRequestMsg,
			generateHelpRequest(thread, forum),
		);

		if (resolved && !isAsker) {
			await thread.send(resolvedByHelper(thread.ownerId!, msg.author.id));
		}
	}

	async function getHelpThread(threadId: string): Promise<ForumThread> {
		const threadData = (await get(['forum', threadId])) as ForumThread;

		if (!threadData) {
			// Thread was created when the bot was down.
			const thread = await forum.threads.fetch(threadId);
			if (!thread) throw new Error('Not a forum thread ID!');

			await set(
				['forum', threadId],
				JSON.stringify({ ownerId: thread.ownerId! }),
			);
			return getHelpThread(threadId);
		}

		return threadData;
	}

	function isHelpThread(
		channel: ThreadChannel | Channel,
	): channel is ThreadChannel & { parent: TextChannel } {
		return (
			channel instanceof ThreadChannel && channel.parent?.id === forum.id
		);
	}

	async function setStatus(thread: ThreadChannel, tag: string) {
		let tags = thread.appliedTags.filter(
			(x) => x !== openTag && x !== resolvedTag,
		);
		if (tags.length === MAX_TAG_COUNT) {
			tags = tags.slice(0, -1);
		}
		await thread.setAppliedTags([tag, ...tags]);
	}
}

import {
	Channel,
	ChannelType,
	Events,
	ForumChannel,
	Message,
	TextChannel,
	ThreadChannel,
} from 'discord.js';
import { Bot } from '~/bot';
import { ForumThread } from '~/types';

import { sendWarningMessage } from '~/utils/message';
import { config } from '~/env';
import { del, get, set } from '~/utils/db';
import { logger } from '~/utils/logger';

function getTag(channel: ForumChannel, name: string) {
	const tag = channel.availableTags.find((x) => x.name === name);
	if (!tag) throw new Error(`Could not find tag ${name}.`);
	return tag.id;
}

const MAX_TAG_COUNT = 5;

const helperResolve = (owner: string, helper: string) => `
<@${owner}>
Because your issue seemed to be resolved, this post was marked as resolved by <@${helper}>.
If your issue is not resolved, **you can reopen this post by running \`!reopen\`**.
*If you have a different question, make a new post in <#${config.HELP_FORUM_CHANNEL}>.*
`;

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
	const forumChannel = channel;
	const openTag = getTag(forumChannel, config.HELP_FORUM_OPEN_TAG);
	const resolvedTag = getTag(forumChannel, config.HELP_FORUM_RESOLVED_TAG);

	const helpRequestChannel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(config.HELP_REQUESTS_CHANNEL);
	if (!helpRequestChannel?.isTextBased()) {
		console.error(`Expected ${helpRequestChannel} to be a text channel.`);
		return;
	}

	bot.client.on(Events.ThreadCreate, async (thread) => {
		const owner = await thread.fetchOwner();
		if (!owner?.user || !isHelpThread(thread)) return;
		logger.info(
			`Received new question from ${owner.user.tag} in thread ${thread.id}.`,
		);

		await set(
			['forum', thread.id],
			JSON.stringify({
				ownerId: owner.user.id,
			}),
			7 * 24 * 60 * 60,
		);

		await setStatus(thread, openTag);
	});

	bot.client.on(Events.ThreadDelete, async (thread) => {
		if (!isHelpThread(thread)) return;
		await del(['forum', thread.id]);
	});

	bot.registerCommand({
		aliases: ['helper', 'helpers'],
		description: 'Help System: Ping the @Helper role from a help post.',
		async listener(msg, comment) {
			if (!isHelpThread(msg.channel)) {
				await sendWarningMessage(msg.channel, {
					title: 'You may only ping helpers from a help post!',
				});
				return;
			}

			const thread = msg.channel;
			const threadData = await getHelpThread(thread.id);

			const isAsker = msg.author.id === threadData.ownerId;
			const isHelper = bot.isHelper(msg);

			if (!isAsker && !isHelper) {
				await sendWarningMessage(thread, {
					title: 'Only the asker can ping helpers!',
				});
				return;
			}

			const pingAllowedAfter =
				+(
					threadData.lastHelpersPing ??
					thread.createdTimestamp ??
					Date.now()
				) +
				60_000 * 10;

			// Ensure they've waited long enough.
			// Helpers (who aren't the asker) are allowed to disregard the timeout.

			if (isAsker && Date.now() < pingAllowedAfter) {
				await sendWarningMessage(thread, {
					title: 'Please wait a bit longer.',
					description: `You can ping helpers <t:${Math.ceil(
						pingAllowedAfter / 1000,
					)}:R>.`,
				});
				return;
			}

			const tagStrings = thread.appliedTags.flatMap((t) => {
				const tag = forumChannel.availableTags.find(
					(at) => at.id === t,
				);
				if (!tag) return [];
				if (!tag.emoji) return tag.name;

				const emoji = tag.emoji.id
					? `<:${tag.emoji.name}:${tag.emoji.id}>`
					: tag.emoji.name;
				return `${emoji} ${tag.name}`;
			});
			const tags = tagStrings ? `(${tagStrings.join(', ')})` : '';

			await Promise.all([
				helpRequestChannel.send(
					`<@&${config.HELPER_ROLE_ID}> ${msg.channel} ${tags} ${
						isHelper ? comment : ''
					}`,
				),
				msg.react('✅'),
				await set(
					['forum', thread.id],
					JSON.stringify({
						...threadData,
						lastHelpersPing: Date.now(),
					}),
				),
			]);
		},
	});

	bot.registerCommand({
		aliases: ['resolved', 'resolve', 'close', 'closed', 'done', 'solved'],
		description: 'Help System: Mark a post as resolved.',
		async listener(msg) {
			changeStatus(msg, true);
		},
	});

	bot.registerCommand({
		aliases: ['reopen', 'open', 'unresolved', 'unresolve'],
		description: 'Help System: Reopen a resolved post.',
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
		const tag = forumChannel.availableTags.find(
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
			await sendWarningMessage(thread, {
				title: 'Can only be run in a help post!',
			});
			return;
		}

		const threadData = await getHelpThread(thread.id);
		const isAsker = msg.author.id === threadData.ownerId;
		const isHelper = bot.isHelper(msg);

		if (!isAsker && !isHelper) {
			await sendWarningMessage(thread, {
				title: 'Only the asker can change the status of a help post!',
			});
			return;
		}

		await setStatus(thread, resolved ? resolvedTag : openTag);
		await msg.react('✅');

		if (resolved && !isAsker) {
			await thread.send(helperResolve(thread.ownerId!, msg.author.id));
		}
	}

	async function getHelpThread(threadId: string): Promise<ForumThread> {
		const threadData = (await get(['forum', threadId])) as ForumThread;

		if (!threadData) {
			// Thread was created when the bot was down.
			const thread = await forumChannel.threads.fetch(threadId);
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
			channel instanceof ThreadChannel &&
			channel.parent?.id === forumChannel.id
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

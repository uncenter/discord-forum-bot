// Adapted from https://github.com/ryanccn/blahaj/blob/4bc327ab9445cccdc6268cef9842000525a36e8a/src/features/githubExpansion.ts.

import type { Bot } from '~/bot';
import type { Snippet } from '~/types';

import { get } from '~/db';
import { buildEmbedMessage, sendEmbedMessage } from '~/utils/embed';
import { logger } from '~/utils/logger';

export async function snippetsModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['snippet'],
		async listener(message, content) {
			logger.info(`Snippet request from ${message.author}: "${content}"`);
			const snippet = (await get(['snippets', content])) as
				| Snippet
				| undefined;
			if (snippet) {
				await sendEmbedMessage(
					message.channel,
					buildEmbedMessage({
						title: snippet.content.title,
						description: snippet.content.description,
						type: 'special',
					}),
				);
			} else {
				logger.error('Snippet not found!');
			}
		},
	});
}

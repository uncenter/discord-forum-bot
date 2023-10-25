// Adapted from https://github.com/ryanccn/blahaj/blob/4bc327ab9445cccdc6268cef9842000525a36e8a/src/features/githubExpansion.ts.

import type { Message } from 'discord.js';
import type { Bot } from '~/bot';

import { EmbedBuilder, Events } from 'discord.js';

import { HEX_PURPLE } from '~/constants';
import { logger } from '~/utils/logger';

const GITHUB_URL_REGEX =
	/https?:\/\/github\.com\/([\w-]+\/[\w.-]+)\/blob\/(.+?)\/(.+?)#L(\d+)[~-]?L?(\d*)/g;
const LANGUAGE_MAP = {
	njk: 'jinja',
};

export async function expandGitHubLinksModule(bot: Bot) {
	bot.client.on(Events.MessageCreate, async (message: Message) => {
		const { content } = message;

		// Check if the message contains GitHub links.
		if (!GITHUB_URL_REGEX.test(content)) return;

		let codeBlocks: {
			language: string;
			content: string;
			name: string;
			body?: string;
		}[] = [];

		content.match(GITHUB_URL_REGEX);

		// Iterate over all matches of GitHub URLs in the message.
		for (const match of content.matchAll(GITHUB_URL_REGEX)) {
			const [fullURL, repo, reference, file, startString, endString] =
				match;
			const start = Number.parseInt(startString);
			let end = endString ? Number.parseInt(endString) : null;

			// Get the file extension / language.
			let language = new URL(fullURL).pathname.split('.').at(-1) || '';
			if (LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP])
				language = LANGUAGE_MAP[language as keyof typeof LANGUAGE_MAP];

			// Fetch the content from the GitHub URL.
			const text = await fetch(
				`https://raw.githubusercontent.com/${repo}/${reference}/${file}`,
			).then((response) => {
				if (!response.ok) {
					logger.error(`Failed to fetch ${fullURL} contents.`);
				}
				return response.text();
			});

			// Skip invalid line numbers.
			if (Number.isNaN(start) || Number.isNaN(end)) continue;

			let content = text
				.split('\n')
				.slice(start - 1, end === null ? start : end)
				.join('\n');

			let linesSliced = 0;

			// Slice content until it's well within Discord's 2000 character limit.
			while (content.length > 1950) {
				const lines = content.split('\n');
				if (lines.length === 1) {
					content = content.slice(0, 1950);
					break;
				}
				lines.pop();
				content = lines.join('\n');
				linesSliced += 1;
			}
			(end as number) -= linesSliced;

			// Ex. "user123/some-repo@main package.json L1-11".
			const name = `${repo}@${
				reference.length === 40 ? reference.slice(0, 8) : reference
			} ${file} L${start}${end ? `-${end}` : ''}`;

			// Ex. "... (3000 lines not displayed)".
			const body =
				linesSliced > 0
					? `... (${linesSliced} lines not displayed)`
					: '';

			codeBlocks.push({ name, language, content, body });
		}

		// Filter out empty code blocks.
		codeBlocks = codeBlocks.filter((block) => !!block.content.trim());

		// If there are code blocks, send them as replies to the message.
		if (codeBlocks.length > 0) {
			await message.suppressEmbeds(true);
			await message.reply({
				embeds: codeBlocks.map((block) =>
					new EmbedBuilder()
						.setDescription(
							`\`\`\`${block.language}\n${block.content}\n\`\`\`\n${block.body}`,
						)
						.setAuthor({ name: block.name })
						.setColor(HEX_PURPLE),
				),
				allowedMentions: { repliedUser: false, roles: [], users: [] },
			});
		}
	});
}

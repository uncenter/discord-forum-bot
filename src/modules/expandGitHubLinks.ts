import type { Message } from 'discord.js';
import type { Bot } from '~/bot';

import { EmbedBuilder, Events } from 'discord.js';

import { HEX_PURPLE } from '~/utils/constants';
import { logger } from '~/utils/logger';

const GITHUB_URL_REGEX =
	/https?:\/\/github\.com\/([\w-]+\/[\w.-]+)\/blob\/(.+?)\/(.+?)#L(\d+)[~-]?L?(\d*)/g;

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
			const [fullURL, repo, ref, file, startStr, endStr] = match;
			const start = Number.parseInt(startStr);
			let end = endStr ? Number.parseInt(endStr) : null;

			// Get the file extension / language.
			const language = new URL(fullURL).pathname.split('.').at(-1) || '';

			// Fetch the content from the GitHub URL.
			const text = await fetch(
				`https://raw.githubusercontent.com/${repo}/${ref}/${file}`,
			).then((res) => {
				if (!res.ok) {
					logger.error(`Failed to fetch ${fullURL} contents.`);
				}
				return res.text();
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
				ref.length === 40 ? ref.slice(0, 8) : ref
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

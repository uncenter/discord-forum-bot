import type { Bot } from '~/bot';
import type { Message } from 'discord.js';

import { EmbedBuilder, Events } from 'discord.js';

import { HEX_PURPLE } from '~/utils/constants';
import { logger } from '~/utils/logger';

const regex =
	/https?:\/\/github\.com\/([\w-]+\/[\w.-]+)\/blob\/(.+?)\/(.+?)#L(\d+)[~-]?L?(\d*)/g;

export async function expandGitHubLinksModule(bot: Bot) {
	bot.client.on(Events.MessageCreate, async (message: Message) => {
		const { content } = message;
		if (!regex.test(content)) return;

		let codeBlocks: {
			language: string;
			content: string;
			name: string;
			body?: string;
		}[] = [];

		content.match(regex);

		for (const match of content.matchAll(regex)) {
			const [fullURL, repo, ref, file, startStr, endStr] = match;

			const start = Number.parseInt(startStr);
			let end = endStr ? Number.parseInt(endStr) : null;
			const language = new URL(fullURL).pathname.split('.').at(-1) || '';

			const text = await fetch(
				`https://raw.githubusercontent.com/${repo}/${ref}/${file}`,
			).then((res) => {
				if (!res.ok)
					logger.error(`Failed to fetch ${fullURL} contents.`);
				return res.text();
			});
			if (Number.isNaN(start) || Number.isNaN(end)) continue;

			let content = text
				.split('\n')
				.slice(start - 1, end === null ? start : end)
				.join('\n');

			// Ensure code blocks won't go over message length limit (2000 characters).
			let linesSliced = 0;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				if (content.length < 1970) break;

				const lines = content.split('\n');
				if (lines.length === 1) {
					content = content.slice(0, 1970);
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

			// Ex. "... (1966 lines not displayed)".
			const body =
				linesSliced > 0
					? `... (${linesSliced} lines not displayed)`
					: '';

			codeBlocks.push({ name, language, content, body });
		}

		codeBlocks = codeBlocks.filter((block) => !!block.content.trim());

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

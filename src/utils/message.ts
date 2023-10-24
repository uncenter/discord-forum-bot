import {
	DMChannel,
	EmbedBuilder,
	NewsChannel,
	PartialDMChannel,
	PrivateThreadChannel,
	PublicThreadChannel,
	StageChannel,
	TextChannel,
	VoiceChannel,
} from 'discord.js';

type SendableChannel =
	| DMChannel
	| PartialDMChannel
	| NewsChannel
	| StageChannel
	| TextChannel
	| PrivateThreadChannel
	| PublicThreadChannel
	| VoiceChannel;

export async function sendEmbedMessage(
	channel: SendableChannel,
	embed: EmbedBuilder,
) {
	await channel.send({
		embeds: [embed],
	});
}

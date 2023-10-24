import * as v from 'valibot';

import { logger } from '~/utils/logger';
import { formatValiError } from '~/utils/valibot';

const snowflake = v.string([
	v.regex(/^\d+$/, 'Should be a snowflake, not a generic string.'),
]);

const Config = v.object({
	NODE_ENV: v.string([v.minLength(1)]),
	PORT: v.optional(v.string([v.regex(/^\d+$/)])),

	DISCORD_TOKEN: v.string([v.minLength(1)]),
	REDIS_URL: v.optional(v.string([v.url()])),

	GUILD_ID: snowflake,

	HOW_TO_GET_HELP_CHANNEL: snowflake,
	HOW_TO_GIVE_HELP_CHANNEL: snowflake,

	HELP_FORUM_CHANNEL: snowflake,
	HELP_REQUESTS_CHANNEL: snowflake,
	HELP_FORUM_OPEN_TAG: v.string(),
	HELP_FORUM_RESOLVED_TAG: v.string(),
	HELPER_ROLE_ID: snowflake,

	COMMAND_PREFIXES: v.transform(v.string(), (value) =>
		value.split(',').map((v) => v.trim()),
	),
	ADMINS: v.transform(v.string(), (value) =>
		value.split(',').map((v) => v.trim()),
	),
});

type Config = v.Output<typeof Config>;

let config_: Config;

try {
	config_ = v.parse(Config, process.env);
} catch (error) {
	if (error instanceof v.ValiError) {
		logger.error(formatValiError(error));
		process.exit(1);
	} else {
		throw error;
	}
}

export const config: Readonly<typeof config_> = config_;

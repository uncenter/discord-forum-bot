import type { ValiError } from 'valibot';

import { blue, bold, cyan, dim, red } from 'kleur/colors';

export const formatValiError = (error: ValiError) => {
	const issues = error.issues;
	let output = red(
		bold(
			`${issues.length} validation error${
				issues.length === 1 ? '' : 's'
			}!\n`,
		),
	);

	for (const issue of issues) {
		const issuePath =
			issue.path
				?.map((p) => (p.key as string | number | symbol).toString())
				.join(dim(' > ')) ?? 'unknown path';

		output += blue(issuePath) + '\n';
		output += '  ' + dim('Validation ') + issue.validation + '\n';
		output += '  ' + dim('Reason ') + issue.reason + '\n';
		output += '  ' + dim('Message ') + cyan(issue.message) + '\n';
	}

	return output.trim();
};

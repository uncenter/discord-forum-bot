import { blue, bold, cyan, dim, red } from 'kleur/colors';

import { type ValiError } from 'valibot';

export const formatValiError = (err: ValiError) => {
	const issues = err.issues;
	let ret = red(
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

		ret += blue(issuePath) + '\n';
		ret += '  ' + dim('Validation ') + issue.validation + '\n';
		ret += '  ' + dim('Reason ') + issue.reason + '\n';
		ret += '  ' + dim('Message ') + cyan(issue.message) + '\n';
	}

	return ret.trim();
};

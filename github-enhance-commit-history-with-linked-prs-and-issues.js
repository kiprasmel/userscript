// ==UserScript==
// @name         GitHub enhance commit history with linked PRs and issues
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @updateURL    https://raw.githubusercontent.com/kiprasmel/userscript/master/github-enhance-commit-history-with-linked-prs-and-issues.js
// @downloadURL  https://raw.githubusercontent.com/kiprasmel/userscript/master/github-enhance-commit-history-with-linked-prs-and-issues.js
// @description
// @author       Kipras Melnikovas
// @match        https://github.com/*/*/commits/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

/**
 * create an auth token yourself
 * with the "repo" scope,
 * and enable SSO if needed.
 *
 * https://github.com/settings/tokens/new?description=github-prs-in-commit-history&scopes=repo
 */
const authToken = "";

/**
 * ---
 */

init();

async function init() {
	const commitList = Array.from(document.querySelectorAll(".TimelineItem-body li"));

	const query = getQuery();
	const variables = getVariables({
		commitListLength: commitList.length,
	});

	log({ commitList, query, variables });

	const datas = commitList
		.map((el) => el.attributes["data-channel"].nodeValue)
		.map((x) => x.split("--")[0])
		.map((x) => atob(x))
		.map((x) => JSON.parse(x))
		.map((x) => x.c.split(":")[3]);

	log({ datas });

	const body = JSON.stringify({
		query,
		variables,
	});

	log({ body });

	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
		body,
	}).then((r) => r.json());

	log("graphql res", res);
}

function log(...xs) {
	const DEBUG = true;
	if (DEBUG) {
		console.log(...xs);
	}
}

/**
 * poor man's graphql
 * @param {string} x
 */
function gql(x) {
	return x[0].replace(/\t/g, "  ");
}

function getQuery() {
	return gql`
		query resolvedIssuesByCommitsOrTheirPRs(
			$org: String!
			$repo: String!
			$refName: String!
			$before: String
			$after: String
			$first: Int!
		) {
			repository(followRenames: true, owner: $org, name: $repo) {
				ref(qualifiedName: $refName) {
					name
					target {
						... on Commit {
							history(first: $first, after: $after, before: $before) {
								edges {
									node {
										oid
										message
										messageBody
										url
										associatedPullRequests(last: 100) {
											edges {
												node {
													title
													body
													number
													url
													closingIssuesReferences(last: 100) {
														edges {
															node {
																author {
																	login
																}
																number
																title
																url
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	`;
}

function getVariables({
	commitListLength, //
}) {
	const url = new URL(window.location.href);

	/**
	 * ["", <org>, <repo>, "commits", <refName>]
	 */
	const paths = url.pathname.split("/");

	const org = paths[1];
	const repo = paths[2];
	const refName = paths[4];

	const after = url.searchParams.get("after");
	const before = url.searchParams.get("before");

	/**
	 * maybe not needed if in between before & after? tho prolly needed, thus count amount of items
	 */
	const first = commitListLength;

	return {
		org,
		repo,
		refName,

		after,
		before,

		first,
	};
}

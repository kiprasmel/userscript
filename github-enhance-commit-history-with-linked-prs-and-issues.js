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
 * and enable SSO if needed,
 * and then paste it in here.
 *
 * https://github.com/settings/tokens/new?description=github-prs-in-commit-history&scopes=repo
 *
 * note that extensions update automatically (unless disabled),
 * and in that case the `authToken` will be reset
 * & you'll need to re-create it.
 * will improve later.
 */
const authToken = "";

const DEBUG = true;

/**
 * ---
 */

init();

async function init() {
	const commitList = Array.from(document.querySelectorAll(".TimelineItem-body li"));

	/**
	 * take already github-rendered commit elements
	 */
	const commitElements = commitList.map((el) => ({
		oid: parseCommitSHAFromEl(el),
		el,
	}));
	log({ commitElements });

	/**
	 * fetch enhanced data w/ commits,
	 * their PRs if avail, and issues of the PRs of avail
	 */
	const commitData = await fetchCommitsWithPRs(commitList.length);

	const zipped = zip(commitElements, commitData, ([el, c]) => ({
		el,
		c,
		hasGithubPR: !!c.associatedPullRequests?.length,
	}));

	for (const { el, c } of zipped) {
		console.assert(el.oid === c.oid);
	}
	log("all commits matched");

	/**
	 * render
	 */
	zipped //
		.filter(({ hasGithubPR }) => hasGithubPR)
		.forEach(({ el, c }) => render(el, c));
}

function parseCommitSHAFromEl(el) {
	const base64 = el.attributes["data-channel"].nodeValue.split("--")[0];
	const { c: content } = JSON.parse(atob(base64));
	const oid = content.split(":")[3];
	return oid;
}

function log(...xs) {
	if (DEBUG) {
		console.log(...xs);
	}
}

async function fetchCommitsWithPRs(commitListLength) {
	const query = getQuery();
	const variables = getVariables(commitListLength);

	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
		body: JSON.stringify({
			query,
			variables,
		}),
	}).then((r) => r.json());

	/**
	 * flatten data
	 */
	const commits = res.data.repository.ref.target.history.edges
		.map((e) => e.node)
		.map((c) =>
			!("associatedPullRequests" in c)
				? c
				: Object.assign(c, {
						associatedPullRequests: c.associatedPullRequests.edges.map((e) => e.node), // eslint-disable-line indent
				  })
		);
	log({ commits });

	return commits;
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

/**
 * poor man's graphql
 * @param {string} x
 */
function gql(x) {
	return x[0].replace(/\t/g, "  ");
}

function getVariables(commitListLength) {
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

function zip(A, B, zipper = (x) => x) {
	console.assert(A.length === B.length);

	const zipped = [];

	for (let i = 0; i < A.length; i++) {
		const a = A[i];
		const b = B[i];

		zipped.push(zipper([a, b]));
	}

	return zipped;
}

function render(el, c) {
	Object.assign(el.el.style, {
		position: "relative",
	});

	const cont = renderContainer();
	el.el.appendChild(cont);

	const containerWidth = Math.floor(cont.getBoundingClientRect().width);
	const dx = -61 - containerWidth;
	Object.assign(cont.style, {
		transform: `translate(${dx}px, -9px)`,
	});

	return;

	function renderContainer() {
		const container = document.createElement("div");

		Object.assign(container.style, {
			position: "absolute",
			display: "flex",
			width: "auto",
			height: "100%",
		});

		container.innerHTML = `
			<span>
				prs:
			</span>
			&nbsp;
			<div>
				${renderPRs()}
			</div>
		`.trim();

		return container;

		function renderPRs() {
			return c.associatedPullRequests.map((pr) =>
				`
					<div>
						<a href="${pr.url}">#${pr.number}</a>
					</div>
				`.trim()
			);
		}
	}
}

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

	const commitElements = commitList.map((el) => {
		const base64 = el.attributes["data-channel"].nodeValue.split("--")[0];
		const { c: content } = JSON.parse(atob(base64));
		const oid = content.split(":")[3];
		return {
			oid,
			el,
		};
	});

	log({ commitElements });

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

	console.assert(commitElements.length === commits.length);

	const zipped = [];
	for (let i = 0; i < commits.length; i++) {
		const el = commitElements[i];
		const c = commits[i];

		const hasGithubPR = !!c.associatedPullRequests?.length;

		zipped.push({
			el,
			c,
			hasGithubPR,
		});
	}

	zipped.forEach(({ el, c }) => {
		console.assert(el.oid === c.oid);
	});
	console.log("all commits matched");

	zipped //
		.filter(({ hasGithubPR }) => hasGithubPR)
		.forEach(({ el, c }) => render(el, c));
}

function render(el, c) {
	/**
	 *
	 */
	Object.assign(el.el.style, {
		position: "relative",
	});

	const cont = renderContainer();
	el.el.appendChild(cont);

	const dx = -61 - Math.floor(cont.getBoundingClientRect().width);
	log({ dx, boundingRect: cont.getBoundingClientRect() });
	Object.assign(cont.style, {
		transform: `translate(${dx}px, -9px)`,
	});

	function renderContainer() {
		/**
		 *
		 */
		const container = document.createElement("div");

		Object.assign(container.style, {
			position: "absolute",
			display: "flex",
			// backgroundColor: "red",
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

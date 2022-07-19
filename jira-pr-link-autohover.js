// ==UserScript==
// @name         Jira PR link auto-hover
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @updateURL    https://raw.githubusercontent.com/kiprasmel/userscript/master/jira-pr-link-autohover.js
// @downloadURL  https://raw.githubusercontent.com/kiprasmel/userscript/master/jira-pr-link-autohover.js
// @description  try to take over the world!
// @author       You
// @match        http*://*.atlassian.net/jira/software/projects/*/boards/*
// @match        http*://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.net
// @grant        none
// ==/UserScript==

init();

function init() {
	if (window.location.href.includes("/browse")) {
		run();
		return;
	}

	if (window.location.href.includes("jira/software/projects")) {
		run();

		let lastSearch = window.location.search;
		const rerun = () => {
			const newSearch = window.location.search;
			if (newSearch && lastSearch !== newSearch) {
				lastSearch = newSearch;
				run();
			}
		};

		setInterval(rerun, 1000);
		return;
	}
}

function run() {
	const timeout1 = 15000;
	const timeout2 = 15000;

	const opacities = [
		`[data-testid="development-summary-pull-request.ui.summary-item"] > div > div:nth-child(2)`,
		`[data-testid="development-summary-build.ui.summary-item"] > div > div:nth-child(2)`,
	];

	opacities.forEach((selector) =>
		waitForEl(selector, timeout1).then(() =>
			document.querySelectorAll(selector).forEach((el) => (el.style.opacity = 1))
		)
	);

	const margins = [`[data-testid="development-summary-common.ui.summary-item.secondary-data-container"]`];
	margins.forEach((selector) =>
		waitForEl(selector, timeout2).then(() =>
			document.querySelectorAll(selector).forEach((el) => (el.style.marginRight = "43.6px"))
		)
	);
}

/**
 * https://stackoverflow.com/a/61511955/9285308
 */
function waitForEl(selector, timeoutMs) {
	return new Promise((_resolve, reject) => {
		let done = false;
		const resolve = (x) => {
			if (done) return;
			done = true;
			_resolve(x);
		};

		const el1 = document.querySelector(selector);
		if (el1) {
			return resolve(el1);
		}

		if (timeoutMs) {
			setTimeout(() => {
				if (done) return;

				console.error(`timeout waiting for element "${selector}".`);
				observer.disconnect();
				return reject();
			}, timeoutMs);
		}

		const observer = new MutationObserver(() => {
			const el2 = document.querySelector(selector);
			if (el2) {
				resolve(el2);
				observer.disconnect();
				return;
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	});
}

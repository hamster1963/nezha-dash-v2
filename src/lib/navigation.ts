export function saveMainPageScrollPosition() {
	const scrollPosition =
		window.scrollY ||
		document.documentElement.scrollTop ||
		document.body.scrollTop ||
		0;

	sessionStorage.setItem("fromMainPage", "true");
	sessionStorage.setItem("scrollPosition", String(scrollPosition));
}

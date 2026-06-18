export const THEME_BOOTSTRAP_SCRIPT = `try {
  var theme = window.localStorage.getItem("linted-theme") === "light" ? "light" : "dark";
  document.documentElement.dataset.appTheme = theme;
} catch (error) {
  document.documentElement.dataset.appTheme = "dark";
}`;

export const THEME_BOOTSTRAP_CSP_HASH =
	"sha256-YVcIm6fjHtXSaEkizgQQ7rF5KHlGOg9lzKHt1kWbxt8=";

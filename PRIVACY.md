# Screen Fit privacy

[Türkçe](PRIVACY.tr.md)

Screen Fit does not collect or transmit personal data, viewing history, media URLs, or analytics. It uses no account, external API, telemetry service, or runtime server.

When invoked, it locally inspects video elements, visible player geometry, and eligible frame information. These observations are not stored as browsing history. Compatibility hints remain on the page and are not sent elsewhere.

Preferences, including language, selection mode, image scale, player size, outlines, and notifications, stay in `chrome.storage.local` on the device. Translations are bundled with the extension.

## Permissions

- `activeTab`: temporary access to the tab invoked by the user.
- `scripting`: inject the video controller on request.
- `storage`: local preferences and temporary session state.
- `webNavigation`: identify the selected player's frame IDs and descendants; no continuous navigation tracking is performed.
- Optional HTTP / HTTPS origins: requested only for selected eligible player origins after the user reviews the access page. There are no mandatory host permissions.

Approved origin permissions are managed by the browser and can be revoked in extension site-access settings. Known advertising and verification frames are filtered from access requests.

During expansion, optional frame helpers handle Esc and apply video display styles. They do not log keystrokes or record other keys. Frame IDs, origin patterns, display values, and a random session key temporarily use `storage.session`, with cleanup on exit, navigation, or tab closure. Full video URLs are not included in that stored state.

The GitHub repository, downloads, and browser stores have their own policies. This notice describes the extension's runtime behavior.

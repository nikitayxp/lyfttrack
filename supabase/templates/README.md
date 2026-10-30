# Auth rollout

I deploy the app code before changing the recovery email template. The new link
uses `/reset-password?token_hash=...&type=recovery`; older app versions do not
process that link. I keep the six-digit email code available for recovery in a
different browser or device, including when a link is expired.

My active delivery scope is the web app. I validate the published web flow
before changing its production configuration. Native-device validation is a
separate gate if APK delivery resumes: that build must include Expo Crypto
15.0.9 for secure PKCE random bytes and SHA-256. Existing installed APKs are not
updated by a web deployment, and web checks do not establish their behavior.

I use this production Site URL: `https://lyfttrack-app.vercel.app`.
The proposed production redirect allow-list contains only:

- `https://lyfttrack-app.vercel.app/callback`
- `https://lyfttrack-app.vercel.app/reset-password`
- `https://lyfttrack-app.vercel.app/sign-in`
- `lyfttrack://callback`

I remove development HTTP/Expo entries and the old `lan_return` wildcard only
after the production configuration change is approved. Development Google OAuth
needs a separate backend configuration and a secure browser context; password
sign-in remains available for local testing. I do not add development origins to
the production allow-list to make a local Google login work.

I apply only the reviewed auth fields/templates and read them back afterward.
The template script updates all six templates, so I review its entire payload
before using it. No auth configuration or template is applied by this PR.

I reconcile the overlapping OAuth work in PR #277 without restoring implicit
callbacks or LAN forwarding. Google sign-in must continue using S256 PKCE on
both web and native. I verify the external Google login and recovery email
delivery separately from local SDK and renderer tests. Physical-device return
remains unverified and is not a requirement for this web-only delivery.

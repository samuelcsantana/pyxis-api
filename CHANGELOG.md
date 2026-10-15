# Changelog

## [0.17.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.16.0...v0.17.0) (2026-10-15)


### Features

* **billing:** keep the cards that started a free trial ([921ec15](https://github.com/samuelcsantana/pyxis-api/commit/921ec1599e5050bd07452bc68262f369a3c5335d))
* **billing:** read the card fingerprint of a subscription ([16258c2](https://github.com/samuelcsantana/pyxis-api/commit/16258c250fcbb0637326e57f9861db4f7c5621d3))
* **billing:** warn when a card starts a second free trial ([05765bc](https://github.com/samuelcsantana/pyxis-api/commit/05765bc79f85b5954369e333640227c2982ac9e8))
* **infra:** alarm when a card starts a second free trial ([758395a](https://github.com/samuelcsantana/pyxis-api/commit/758395a6c19e4dd56ecafe30c1dad946af01484f))
* **retention:** delete the cards of trials older than a year ([fef7a55](https://github.com/samuelcsantana/pyxis-api/commit/fef7a55e9756c10956cdacf3df2e9cbf8fe6bb26))


### Documentation

* describe the detection of repeated free trials ([929235f](https://github.com/samuelcsantana/pyxis-api/commit/929235f756390d763359e9da7660975db552088d))

## [0.16.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.15.0...v0.16.0) (2026-10-15)


### Features

* **accounts:** close an account at once when its owner asks ([7d606f3](https://github.com/samuelcsantana/pyxis-api/commit/7d606f35b62e45302f7bbe264086aa1434adfc92))
* **billing:** cancel a subscription and refund its first payment inside a window ([331cc07](https://github.com/samuelcsantana/pyxis-api/commit/331cc0713c89a739bc1843f41eb52958811c30d5))
* **exports:** ask for an export from the dashboard and run it in the jobs function ([9574f9f](https://github.com/samuelcsantana/pyxis-api/commit/9574f9f6ce7e2da0ebfe7aebf08f91e0b644870a))
* **exports:** export a project's events to a compressed file ([6acc403](https://github.com/samuelcsantana/pyxis-api/commit/6acc403f1b0ff28e43056c6b336fbc995097daa5))
* **exports:** write a project's events as CSV lines ([367a63b](https://github.com/samuelcsantana/pyxis-api/commit/367a63bc75cc69d874014508aa7bd2763eddabcf))
* **http:** let the owner close an account from the dashboard ([f908c5f](https://github.com/samuelcsantana/pyxis-api/commit/f908c5f11a6ac5a4d21e341904a28e5716682772))
* **infra:** keep the exports in a private bucket that forgets them after a week ([09567d3](https://github.com/samuelcsantana/pyxis-api/commit/09567d31098138e2cf92aed9209eb71d35e6499f))
* **mail:** write the export-ready e-mail ([3c30984](https://github.com/samuelcsantana/pyxis-api/commit/3c30984a6dc86c7e03f5472cdd3cf8b92380dc0c))


### Documentation

* describe exports and add ADR 0024 ([f88363f](https://github.com/samuelcsantana/pyxis-api/commit/f88363f51d461c4eccee88d1e626389f5de84785))
* describe the closure of an account and add ADR 0025 ([27a89df](https://github.com/samuelcsantana/pyxis-api/commit/27a89df66b70086b1aebb8d5a3645782de73ab7c))

## [0.15.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.14.0...v0.15.0) (2026-10-15)


### Features

* **accounts:** add accounts that own projects ([f00e1ec](https://github.com/samuelcsantana/pyxis-api/commit/f00e1ecb31293a7a232671f922f21e8363dc6be5))
* **accounts:** create a free account and show an account ([ea576f4](https://github.com/samuelcsantana/pyxis-api/commit/ea576f45642452f0e61974e44abc40749cd474cc))
* **accounts:** hold an account to the plan's project limit ([37f2d0b](https://github.com/samuelcsantana/pyxis-api/commit/37f2d0b3e73fa709b82d335d22c4efd5a94f5dd4))
* **accounts:** mark each step of an account's end, and clear the marks on return ([cc91a57](https://github.com/samuelcsantana/pyxis-api/commit/cc91a57fe2d60c7d0ce8790c2d495d3148f68347))
* **accounts:** measure each account's month and pause it past 150% ([7bd477d](https://github.com/samuelcsantana/pyxis-api/commit/7bd477d5854a36dcfebe87c6e59197ab4e9c2960))
* **accounts:** read an owner's live account and the accounts an admin belongs to ([3771576](https://github.com/samuelcsantana/pyxis-api/commit/37715761b0e7b1fa5e582bffdd27e9cd0cd1c513))
* **accounts:** record each acceptance of the terms ([cf4f692](https://github.com/samuelcsantana/pyxis-api/commit/cf4f6921960eaa8308bbd10f9e0171a5a218416a))
* **accounts:** require the address of the published terms to open sign-up ([d1428ca](https://github.com/samuelcsantana/pyxis-api/commit/d1428cad1ecdfcb1f6c7d8a4e769daffd174106a))
* **accounts:** run each account through the end of its subscription ([5568d91](https://github.com/samuelcsantana/pyxis-api/commit/5568d91938edcd1d86f34af25befb5d0b4b51fb4))
* **accounts:** sign up with an e-mailed code, then subscribe through Checkout ([0e80413](https://github.com/samuelcsantana/pyxis-api/commit/0e80413562b5c3b65ed4cfa3dcddca0fc4ccdb16))
* **accounts:** tell owners at 80%, 100% and when ingestion pauses ([ff36023](https://github.com/samuelcsantana/pyxis-api/commit/ff3602331c250ef5b3aa69f77ce278fafb987cb6))
* **accounts:** welcome the owner right after the subscription starts ([d1f87b6](https://github.com/samuelcsantana/pyxis-api/commit/d1f87b6471e7c5e270a8628ddf44611b696de233))
* **auth:** create, list, revoke and authenticate access tokens ([c601f53](https://github.com/samuelcsantana/pyxis-api/commit/c601f53f346f0b79f7e9eb8f68f427227448cfba))
* **auth:** define read-only access tokens in the domain ([a9d620f](https://github.com/samuelcsantana/pyxis-api/commit/a9d620f83320b9fdd75f2095f1b0fd50c09d6deb))
* **auth:** give each e-mailed code a purpose ([4cf40a3](https://github.com/samuelcsantana/pyxis-api/commit/4cf40a351608ad82f2917fb2aaf1e9e74aca59ee))
* **auth:** read the dashboard queries with access tokens ([e0debce](https://github.com/samuelcsantana/pyxis-api/commit/e0debced2c6a1434df2c0a3f0d3f61b1dba2ed2e))
* **auth:** store access tokens in admin_access_tokens ([ca2a0f2](https://github.com/samuelcsantana/pyxis-api/commit/ca2a0f2b54a89d6aacf3266166054174c036a5d0))
* **billing:** add a billing gateway backed by Stripe ([0a9a3ce](https://github.com/samuelcsantana/pyxis-api/commit/0a9a3ceb14d6da2a29fe5f25d5039af7214345b4))
* **billing:** keep each account's subscription state ([06b4225](https://github.com/samuelcsantana/pyxis-api/commit/06b4225f9564017c08cdb1d5b504405cb7fafe82))
* **billing:** open a Checkout without a trial when asked ([c540465](https://github.com/samuelcsantana/pyxis-api/commit/c540465d3e9c1279608474bbf36ecd24eef300ad))
* **billing:** take Stripe's signed events at a webhook ([c571e24](https://github.com/samuelcsantana/pyxis-api/commit/c571e241d39310bce061d3a10ad2de59f9c02026))
* **cli:** add project:delete ([87cef79](https://github.com/samuelcsantana/pyxis-api/commit/87cef79846d769ac4a932c5e576f758ea2f70cbf))
* **cli:** add usage:report ([a606565](https://github.com/samuelcsantana/pyxis-api/commit/a606565390c9067b597d0336dec247f523f7d6f5))
* **cli:** link a subscription paid by payment link to an account ([fe3973a](https://github.com/samuelcsantana/pyxis-api/commit/fe3973af9b9945974c0365ccfe27c43a69e3a319))
* **cli:** open free accounts and put projects in them ([caab19f](https://github.com/samuelcsantana/pyxis-api/commit/caab19f6cbf4034fc35b31c6b64738cdf1a1a2c7))
* **cli:** take a person off a project with admin:revoke ([43554de](https://github.com/samuelcsantana/pyxis-api/commit/43554de94167a84a8b259b399aacbbeb974422c0))
* **infra:** add the sign-up switch and the terms version to the parameter store ([f6e3e5c](https://github.com/samuelcsantana/pyxis-api/commit/f6e3e5c8f746f32defc53c4c8761f1f8f2d8fc5b))
* **infra:** keep the Stripe keys in the parameter store ([80d1c0c](https://github.com/samuelcsantana/pyxis-api/commit/80d1c0caf031d442be1a3b6474c4db317ee41a88))
* **infra:** verify the mail domain in Amazon SES and let the functions send ([d17d32e](https://github.com/samuelcsantana/pyxis-api/commit/d17d32ea9c825693f3589b3c2f94dc8261b9a850))
* **ingest:** refuse the batches of a paused account ([24e3fff](https://github.com/samuelcsantana/pyxis-api/commit/24e3fff66d577ce77b94e5c482906d6458706aa4))
* **jobs:** run the account lifecycle every day ([5bbd6c2](https://github.com/samuelcsantana/pyxis-api/commit/5bbd6c25e730aa175cbd8eb590f08e7fdc00358a))
* **mail:** link the e-mails to the configured dashboard ([25f0944](https://github.com/samuelcsantana/pyxis-api/commit/25f0944eb987981286391c4a386f780f902922ec))
* **mail:** send e-mail through Amazon SES when configured ([6a287d2](https://github.com/samuelcsantana/pyxis-api/commit/6a287d225c861d0c56a40b7a64cb9521ca567e60))
* **mail:** write and send the invitation e-mail ([b1e1265](https://github.com/samuelcsantana/pyxis-api/commit/b1e12654a3921d90e137a086b90738a6eb1d9854))
* **mail:** write and send the sign-up code e-mail ([92d08f3](https://github.com/samuelcsantana/pyxis-api/commit/92d08f31212f2eeca2dd8001ed708a8ded4e117d))
* **mail:** write the notices of an account's end ([33d4c01](https://github.com/samuelcsantana/pyxis-api/commit/33d4c0175658abd0943e5d772cc62d2e0dc1d9ac))
* **mail:** write the quota notice e-mail in three languages ([f57dbc0](https://github.com/samuelcsantana/pyxis-api/commit/f57dbc07b69061fc28bf531c6c1fb66ae7e15801))
* **mail:** write the welcome e-mail ([6ea6483](https://github.com/samuelcsantana/pyxis-api/commit/6ea6483e47ed9a1d967ce2e0bfb604bee1017ce8))
* **people:** add, list and remove the people of a project ([12f1d6c](https://github.com/samuelcsantana/pyxis-api/commit/12f1d6c24db8689a45c2cde4ecf93cd3806cdae1))
* **people:** manage the people of a project from the dashboard ([1e2802b](https://github.com/samuelcsantana/pyxis-api/commit/1e2802b0e431974d044ce77e519f177b3ff2be13))
* **projects:** delete a project with everything it owns ([7e2e6e0](https://github.com/samuelcsantana/pyxis-api/commit/7e2e6e09133b75ccb16244f0e1b0f92072bbb2a4))
* **projects:** let an account's owner manage its projects and keys ([b2b2d7e](https://github.com/samuelcsantana/pyxis-api/commit/b2b2d7ee86795ca9b84834fe7b8d01871842a085))
* **projects:** manage projects and keys from the dashboard ([960e6d2](https://github.com/samuelcsantana/pyxis-api/commit/960e6d2b88da491ffb5a5aee4e7eacd42daf64a6))
* **projects:** rename a project and allow at most five origins ([750de7b](https://github.com/samuelcsantana/pyxis-api/commit/750de7b35531fda197d00d1f7478473f64c501f2))
* **projects:** report each project's usage in a month ([e18bf2b](https://github.com/samuelcsantana/pyxis-api/commit/e18bf2b2fe37f973a2d03f4ba2e095a4108c2610))
* **queries:** tell the dashboard who may change a project ([97b8511](https://github.com/samuelcsantana/pyxis-api/commit/97b851137bcf64183a7db33b6c10a03948d675ee))


### Bug Fixes

* **lambda:** keep query values with commas whole ([28c4e09](https://github.com/samuelcsantana/pyxis-api/commit/28c4e0990d9f631cdc6bc583a9a7720b8758a813))
* **preferences:** accept the e-mail preferences change only from the dashboard ([4291be5](https://github.com/samuelcsantana/pyxis-api/commit/4291be59f38fa4d3f86bea4ce0b29fe4254f7a13))


### Refactoring

* **mail:** share the call-to-action button of the e-mails ([75c6c45](https://github.com/samuelcsantana/pyxis-api/commit/75c6c45f650a289778207a357ac5aebedae44aa0))


### Documentation

* describe accounts and add ADR 0016 ([9d612d7](https://github.com/samuelcsantana/pyxis-api/commit/9d612d7a9d9638060960e8301b50ed4dee37fbc4))
* describe project management by the owner and add ADR 0020 ([daea20d](https://github.com/samuelcsantana/pyxis-api/commit/daea20d99e25c2f3a835f7f0361dce99b139d3f1))
* describe sending through Amazon SES ([1acbd72](https://github.com/samuelcsantana/pyxis-api/commit/1acbd726aa4b295d39e7e7f4978eac1f2c4d9f78))
* describe sign-up and add ADR 0019 ([8900f57](https://github.com/samuelcsantana/pyxis-api/commit/8900f57bbae5eeafda6d89bb77d5624bb58f3e06))
* describe the billing webhook and add ADR 0018 ([efbd228](https://github.com/samuelcsantana/pyxis-api/commit/efbd228a890da03af6730aff8a4db0fd0c3073c5))
* describe the end of an account and add ADR 0022 ([5f040d4](https://github.com/samuelcsantana/pyxis-api/commit/5f040d4db806cac985ff5c7bad946a4087059ddc))
* describe the monthly quota and add ADR 0017 ([e0f9ce1](https://github.com/samuelcsantana/pyxis-api/commit/e0f9ce1cc5d8ac7ac964aae7984b06cffddec953))
* describe the people of a project and add ADR 0021 ([85e1342](https://github.com/samuelcsantana/pyxis-api/commit/85e1342ed4d4eab26cab90b41e0d253b5e13313c))
* describe the quota notices in the README ([d0bde5c](https://github.com/samuelcsantana/pyxis-api/commit/d0bde5c449866f87ff7ae8306f8be78cf48810bc))
* describe the welcome e-mail and add ADR 0023 ([9ce75a6](https://github.com/samuelcsantana/pyxis-api/commit/9ce75a696842f0f6003c7f7f380a4ba91a06d344))
* document read-only access tokens and add ADR 0015 ([e32f125](https://github.com/samuelcsantana/pyxis-api/commit/e32f1256f47e07de723d4d7fdc0be2bdc0b0fa54))
* **iam:** publish the provisioning role and the deployer's policy ([9a20850](https://github.com/samuelcsantana/pyxis-api/commit/9a2085006ec534c5f9fcf5a9407fdc7b8300b320))
* **runbook:** list the alarms and what they do not cover ([daeb61b](https://github.com/samuelcsantana/pyxis-api/commit/daeb61bcd86160bd9853fa994e4e648ad54ca753))
* **runbook:** walk the first-time setup through on a new account ([093d449](https://github.com/samuelcsantana/pyxis-api/commit/093d449adbb0deb4c93f7ad93a107bf31f774c02))

## [0.14.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.13.0...v0.14.0) (2026-10-13)


### Features

* **mail:** write the sign-in and weekly digest e-mails in Spanish ([6c4acc5](https://github.com/samuelcsantana/pyxis-api/commit/6c4acc5ea18c7f51972cec614af04228e0fac30f))


### Documentation

* **api:** name Spanish among the sign-in e-mail languages ([575358e](https://github.com/samuelcsantana/pyxis-api/commit/575358e4f010b3180779d8efad5e5cfec5cffcfb))
* **readme:** link the introduction post ([ee69372](https://github.com/samuelcsantana/pyxis-api/commit/ee6937262bf26a4b4940fdb72178531be4846f84))

## [0.13.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.12.0...v0.13.0) (2026-10-12)


### Features

* **devices:** break the visits down by region ([1fb66d5](https://github.com/samuelcsantana/pyxis-api/commit/1fb66d5c33eeca40262b62d71fdb704fe3f4b199))
* **events:** normalize the viewer's region from CloudFront headers ([9011ef7](https://github.com/samuelcsantana/pyxis-api/commit/9011ef75045a525e3e393246a4e4bcd51edd496e))
* **ingest:** store the viewer's region next to the country ([127fb61](https://github.com/samuelcsantana/pyxis-api/commit/127fb61a805b1b5d4b8026105b2bee444efb5f19))
* **subjects:** include the region in a person's exported events ([c5dfdee](https://github.com/samuelcsantana/pyxis-api/commit/c5dfdee5996cae2bde1d8cc421c1d68c6a732d4a))
* **timeline:** show the region of each visit ([9c1adec](https://github.com/samuelcsantana/pyxis-api/commit/9c1adece3aeb9047aa976f2c25f4f001dd163f69))
* **visits:** show and filter the visits by region ([a88a110](https://github.com/samuelcsantana/pyxis-api/commit/a88a1105364661c6d26428a72b04b7fe963c75b3))


### Documentation

* record why the region is kept and the city never is ([a7e46e8](https://github.com/samuelcsantana/pyxis-api/commit/a7e46e87008236c2a72afc57f017d88051de35bf))

## [0.12.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.11.0...v0.12.0) (2026-10-11)


### Features

* **domain:** classify a visit tagged with a social network source as social ([b54a069](https://github.com/samuelcsantana/pyxis-api/commit/b54a069c646696ad6a3125cecf2af627df7eb355))

## [0.11.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.10.0...v0.11.0) (2026-10-11)


### Features

* **projects:** choose and recognise a site's icon ([75d322d](https://github.com/samuelcsantana/pyxis-api/commit/75d322db627674f096b6c5d622e6b34bf6fa0dde))
* **projects:** fetch a site's icon behind an address guard ([17ed3af](https://github.com/samuelcsantana/pyxis-api/commit/17ed3afca04b4d323500df2905511a8995fd4145))
* **projects:** keep project icons in Postgres ([696edcf](https://github.com/samuelcsantana/pyxis-api/commit/696edcfc1d5a32b15310c10836ba488bcd44f98e))
* **projects:** refresh the project icons in the daily job ([c71fc3f](https://github.com/samuelcsantana/pyxis-api/commit/c71fc3f89deefeb35ce4bc2539cd64dba641607e))
* **projects:** serve a project's icon and tell its version in /me ([15a8494](https://github.com/samuelcsantana/pyxis-api/commit/15a8494edfe2993a09ff91a62f187077134a7394))


### Documentation

* describe project icons in the README and ADR 0013 ([7147186](https://github.com/samuelcsantana/pyxis-api/commit/714718695c5aacdd1a4fa7e29ab4b0fd0d343092))

## [0.10.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.9.0...v0.10.0) (2026-10-10)


### Features

* **auth:** list the sessions of an admin and end one by id ([46f67cc](https://github.com/samuelcsantana/pyxis-api/commit/46f67cc69e05e3442485bcf1fb84da3eb8673650))
* **auth:** sign an admin out of every device at once ([5376363](https://github.com/samuelcsantana/pyxis-api/commit/53763630bb36cd434faa623ac9e3db6f43504d36))


### Documentation

* **readme:** describe the sessions list among the ways a session ends ([7bea4af](https://github.com/samuelcsantana/pyxis-api/commit/7bea4af93a3cfbeadd6819f227b27542ad16f0c6))
* **readme:** name the sign-out-everywhere route among the ways a session ends ([0b978ec](https://github.com/samuelcsantana/pyxis-api/commit/0b978ec561efca592d58a2338324f110b3d73fff))

## [0.9.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.8.0...v0.9.0) (2026-10-10)


### Features

* **auth:** answer the session token in the sign-in body ([9d194a8](https://github.com/samuelcsantana/pyxis-api/commit/9d194a82659c4d130cf64b89fb904a5e0f18ae49))
* **infra:** alarm when sign-in codes are guessed or an inbox flooded ([911735b](https://github.com/samuelcsantana/pyxis-api/commit/911735b5ec00b3e835919c6dcade7a63a8f76c74))


### Bug Fixes

* **subjects:** throttle the client address before the key is checked ([c7e60ff](https://github.com/samuelcsantana/pyxis-api/commit/c7e60ffcdefbeb6b5f83aff5ebdc6a43a7c30772))


### Refactoring

* **auth:** stop setting the session cookie, the dashboard keeps it ([099db3d](https://github.com/samuelcsantana/pyxis-api/commit/099db3ddd69f8bbab0b30f31c360bf4bf2429737))


### Documentation

* **adr:** mark ADR 0007 as amended by the dashboard-set cookie ([7bdbef6](https://github.com/samuelcsantana/pyxis-api/commit/7bdbef6adcea2ff7443007408176e8532b8d71f8))
* **adr:** record the session cookie moving to the dashboard's host ([7d13f9c](https://github.com/samuelcsantana/pyxis-api/commit/7d13f9ca86f7eeabd92fa5e4a898985055550425))
* **readme:** state the production status ([fc7935d](https://github.com/samuelcsantana/pyxis-api/commit/fc7935d6ace451315fbd70287532c0f47bb1cabd))

## [0.8.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.7.0...v0.8.0) (2026-10-09)


### Features

* **mail:** name the project's time zone in the digest as readers say it ([727874a](https://github.com/samuelcsantana/pyxis-api/commit/727874a7a9d776bddc3affa508b0c444244582ab))
* **mail:** preview the week's numbers in the digest's inbox line ([647739d](https://github.com/samuelcsantana/pyxis-api/commit/647739d6b973c0456d04ef17cf547c6a87f01bf3))
* **mail:** send email from noreply@pyxis-analytics.dev ([a3bbabe](https://github.com/samuelcsantana/pyxis-api/commit/a3bbabec1a99c3dc66aa60f5624a4701ee50e4bf))


### Bug Fixes

* **mail:** correct the warnings and the pt-BR instruction of the sign-in email ([4c05915](https://github.com/samuelcsantana/pyxis-api/commit/4c05915555be3bf868e6bd844d94d3380d9213be))
* **mail:** name the digest's route list and footer as the dashboard does ([2427bb0](https://github.com/samuelcsantana/pyxis-api/commit/2427bb0cc3f26d9dde837bbd22e00ca52e4770fe))
* **mail:** separate the week from the visits in the digest subject with a dot ([9b22b1d](https://github.com/samuelcsantana/pyxis-api/commit/9b22b1dea34d218fdca1e8eb25f20323526a45e0))
* **mail:** word the digest's empty states for the week that ended ([2240507](https://github.com/samuelcsantana/pyxis-api/commit/224050761ff02b5c5ef003f5bdf48092362dcde1))

## [0.7.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.6.1...v0.7.0) (2026-10-09)


### Features

* **infra:** move the dashboard settings to app.pyxis-analytics.dev ([5c770a0](https://github.com/samuelcsantana/pyxis-api/commit/5c770a0db909ad11148c71d4edffa34cbc14fa46))
* **infra:** serve the API on api.pyxis-analytics.dev, keeping the old name ([c1925fa](https://github.com/samuelcsantana/pyxis-api/commit/c1925fabab1b2ed87f67fa83ac9e523bbe4f099e))


### Documentation

* **runbook:** note the traps of moving the API to another domain ([dd76264](https://github.com/samuelcsantana/pyxis-api/commit/dd7626452ba6ac16c0709c359b05b8f6099144c6))

## [0.6.1](https://github.com/samuelcsantana/pyxis-api/compare/v0.6.0...v0.6.1) (2026-10-09)


### Bug Fixes

* **queries:** return lists as jsonb so the Lambda's connection reads them ([9104d54](https://github.com/samuelcsantana/pyxis-api/commit/9104d543c8c45fef2b09111a8758a689649b5a4c))

## [0.6.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.5.0...v0.6.0) (2026-10-09)


### Features

* **auth:** remember the language of the admin's last sign-in ([06d246d](https://github.com/samuelcsantana/pyxis-api/commit/06d246d355574e8a3305e397776ea853b7969434))
* **digest:** assemble a project's week from the dashboard queries ([0b7aff4](https://github.com/samuelcsantana/pyxis-api/commit/0b7aff40d112f11bc636f6d22a1bb9204d075439))
* **digest:** find the last closed week of a project ([c925768](https://github.com/samuelcsantana/pyxis-api/commit/c925768e0e6141f014be56a2637868fc961a25c2))
* **digest:** list the digest recipients and remember what was sent ([94d92ba](https://github.com/samuelcsantana/pyxis-api/commit/94d92baa32bc6cc0eea43692855e230b7a3ad8dc))
* **digest:** send each admin the last closed week of their projects ([ffb609a](https://github.com/samuelcsantana/pyxis-api/commit/ffb609abdb5e72b4b0121981cc6ab52a6945f535))
* **infra:** schedule the weekly digest on Mondays ([7376ddd](https://github.com/samuelcsantana/pyxis-api/commit/7376ddd48eac79fa73a7a2523f5dd4319ec02af3))
* **jobs:** run the weekly digest when the schedule asks for it ([524913b](https://github.com/samuelcsantana/pyxis-api/commit/524913b6a14f5138e116129ef702220a8a2ff90e))
* **mail:** send the weekly digest through Resend ([616b949](https://github.com/samuelcsantana/pyxis-api/commit/616b949c26ff3b13be417ffdd7ca6decffe939ea))
* **mail:** write the weekly digest e-mail in English and Portuguese ([f4ab5bb](https://github.com/samuelcsantana/pyxis-api/commit/f4ab5bbfce8b8c1fd962d3771c774e28e38c8cc6))
* **preferences:** keep a weekly digest switch per admin and project ([ed6ba53](https://github.com/samuelcsantana/pyxis-api/commit/ed6ba53f2f684f96689a93d56d167ef92c2601a0))
* **preferences:** serve the e-mail preferences of the signed-in admin ([7babf0e](https://github.com/samuelcsantana/pyxis-api/commit/7babf0ecfc354ef41b6a83f12ca807922e508823))


### Refactoring

* **mail:** share the e-mail layout between messages ([b0650f7](https://github.com/samuelcsantana/pyxis-api/commit/b0650f7ef3ca412220f58b15044010a4c33d28fa))


### Documentation

* describe the weekly digest ([885ebd8](https://github.com/samuelcsantana/pyxis-api/commit/885ebd8f8fc400e32a964e18ae0fc98ccf514450))
* **readme:** describe the e-mail preferences routes ([72be655](https://github.com/samuelcsantana/pyxis-api/commit/72be655d27571b82e6b0ee3730b332d8a8c73a10))

## [0.5.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.4.0...v0.5.0) (2026-10-09)


### Features

* **keys:** list the live keys of a project ([af781f7](https://github.com/samuelcsantana/pyxis-api/commit/af781f73b888eb8a6171b0be167d750d480a8776))
* **projects:** answer the settings of a project on GET /settings ([8464562](https://github.com/samuelcsantana/pyxis-api/commit/846456240ed44c787eedee3955c27c25293a5100))
* **projects:** describe the settings of a project for its admin ([cdc42ba](https://github.com/samuelcsantana/pyxis-api/commit/cdc42bac209a6f53b9f65d3d52c211381f038d86))
* **queries:** answer a funnel per device or channel on GET /funnel/segments ([0e9e7d2](https://github.com/samuelcsantana/pyxis-api/commit/0e9e7d2b001d8895f971a5f0a154e97da1106f5e))
* **queries:** answer how visits entered, left and lasted on GET /engagement ([9357428](https://github.com/samuelcsantana/pyxis-api/commit/9357428fa6982e5bbdbf894119a30be2fccbb0f9))
* **queries:** answer when the visits started on GET /time-of-day ([99809c9](https://github.com/samuelcsantana/pyxis-api/commit/99809c9c14f82f6db1ad05e127cdb379ee4543ed))
* **queries:** count a funnel per device type or channel of the visit ([943769a](https://github.com/samuelcsantana/pyxis-api/commit/943769a3ad420cfb531fd7496ee8e25b8ca0721e))
* **queries:** count visits by the weekday and hour they started ([4ece273](https://github.com/samuelcsantana/pyxis-api/commit/4ece2732fc878d217fd8057ae1fc44ec1946da14))
* **queries:** describe how the visits of a range entered, left and lasted ([127cce7](https://github.com/samuelcsantana/pyxis-api/commit/127cce7a41cae7441a4d74843d9214deddaa099c))
* **queries:** describe when the visits of a range started ([390ca09](https://github.com/samuelcsantana/pyxis-api/commit/390ca0943dc913012f7c1a5c2ee4e5acc2873c8a))
* **queries:** measure how visits enter, leave and last ([f7869d9](https://github.com/samuelcsantana/pyxis-api/commit/f7869d95c2f1c3024a5a2946a6fa70bbbebdf759))


### Documentation

* **readme:** describe the engagement route ([53b325b](https://github.com/samuelcsantana/pyxis-api/commit/53b325b8ecf2ccc0f4d4d74648001868e4f78e42))
* **readme:** describe the funnel segments route ([2a7c2e9](https://github.com/samuelcsantana/pyxis-api/commit/2a7c2e9df625a7dd2c3610c387553cb3fe8490e7))
* **readme:** describe the read-only settings route ([10cc573](https://github.com/samuelcsantana/pyxis-api/commit/10cc5737eda3f489497aa63ed6bf573dfb2ae62a))
* **readme:** describe the time-of-day route ([bae9d30](https://github.com/samuelcsantana/pyxis-api/commit/bae9d3065bef38a93bfd431c75e05a794b1d4c20))

## [0.4.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.3.0...v0.4.0) (2026-10-08)


### Features

* **auth:** resolve the language a sign-in email is written in ([b411fb7](https://github.com/samuelcsantana/pyxis-api/commit/b411fb7aa5034027247df280350fd43b03b77c18))
* **auth:** take the dashboard's language when it asks for a sign-in code ([d5e5be0](https://github.com/samuelcsantana/pyxis-api/commit/d5e5be08b2b97c129d7b005d36ceba37cc742c29))
* **mail:** write the sign-in email in English or Brazilian Portuguese ([931f658](https://github.com/samuelcsantana/pyxis-api/commit/931f65831e03fb3fb3bc9df077d1484657882de5))


### Documentation

* **readme:** say the sign-in email follows the dashboard's language ([80bc31a](https://github.com/samuelcsantana/pyxis-api/commit/80bc31ad98570c234f3fe6d9dd9356e743e08f4c))

## [0.3.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.2.0...v0.3.0) (2026-10-08)


### Features

* **acquisition:** rank the campaigns that brought visits ([bfc7bd5](https://github.com/samuelcsantana/pyxis-api/commit/bfc7bd58b845a94095957f9c36f5b429acd09b09))
* **funnel:** list the visits or people behind one step ([3ff5baf](https://github.com/samuelcsantana/pyxis-api/commit/3ff5baf44ebfe5ee68212fa924770fcf1d309ec2))
* **funnel:** time each step from the previous one and the whole funnel ([5a65051](https://github.com/samuelcsantana/pyxis-api/commit/5a6505125bd11b7b1e6963b7e0d5911608cccf7a))
* **requests:** count failures per day by status class and add the p95 ([977aa1f](https://github.com/samuelcsantana/pyxis-api/commit/977aa1f2aaf21ceba1cf07bc2db2b9dc5a70a8a5))
* **timeline:** name the person each visit was identified as ([b9800f0](https://github.com/samuelcsantana/pyxis-api/commit/b9800f00107ac99e30f7e1623a20536f994b727e))
* **visits:** filter by country, source, campaign and failed requests ([d632a02](https://github.com/samuelcsantana/pyxis-api/commit/d632a0298100c6242bd6c5b1de6895489876e9ec))


### Refactoring

* **queries:** name the entry page view and the source it carries ([6bd075e](https://github.com/samuelcsantana/pyxis-api/commit/6bd075eb08da1fa80f8a8d1705e2e5d5b3c1e080))


### Documentation

* **readme:** describe the new visit filters and the matching total ([cd47b70](https://github.com/samuelcsantana/pyxis-api/commit/cd47b706560c909b846e1978355732498a5891eb))
* **readme:** describe the per-day health of the requests ([52298b9](https://github.com/samuelcsantana/pyxis-api/commit/52298b93d886c86e98ce0d27868630dc33b8da2e))
* **readme:** describe the visits and people behind a funnel step ([3c287e9](https://github.com/samuelcsantana/pyxis-api/commit/3c287e90423109d9de106ed735a9963742f0ed3f))
* **readme:** mention the campaigns in the acquisition answer ([b805853](https://github.com/samuelcsantana/pyxis-api/commit/b80585300c311f5e9e0e00649ee5d8a62cdc52c8))
* **readme:** say the funnel gives the median time between steps ([a7d03c9](https://github.com/samuelcsantana/pyxis-api/commit/a7d03c9cfea4a2c6cb9a38817fd276e857b8d38d))
* **readme:** say the timeline names the person of each visit ([c506ba8](https://github.com/samuelcsantana/pyxis-api/commit/c506ba8ebbb6e5fd0c00a1b363f14143f0b3795a))

## [0.2.0](https://github.com/samuelcsantana/pyxis-api/compare/v0.1.1...v0.2.0) (2026-10-08)


### Features

* **auth:** tell when each project's first and latest events happened ([7fde3d9](https://github.com/samuelcsantana/pyxis-api/commit/7fde3d9e9c68a8e49a0b090bb1b74a23ab7148b9))
* **http:** add GET /v1/projects/{projectId}/visits ([adc438d](https://github.com/samuelcsantana/pyxis-api/commit/adc438d131b3466009ea587702dbbb409778268a))
* **mail:** send a branded sign-in email that reads in light and dark ([f15c503](https://github.com/samuelcsantana/pyxis-api/commit/f15c5033f1113a39ad4c4e38b3f93bc051c442ab))
* **queries:** add the property breakdown of a named event ([53bbda4](https://github.com/samuelcsantana/pyxis-api/commit/53bbda45b27c4ab111c2a011afc9face8aa6aed0))
* **queries:** add the visits list use case and its port ([a39eb25](https://github.com/samuelcsantana/pyxis-api/commit/a39eb25bd4d3cfcaa248fde99d8c0d8563f35890))
* **queries:** answer the comparison cutoff and the previous days on /overview ([c0cef62](https://github.com/samuelcsantana/pyxis-api/commit/c0cef6299abb5c38d5498d84b6e44e24c6d61ab9))
* **queries:** compare today with the same hours of the previous period ([bf0d389](https://github.com/samuelcsantana/pyxis-api/commit/bf0d389d8deb1a529a1e212d8eb97a20efcd8cb7))
* **queries:** count an event's property values in Postgres ([cc76650](https://github.com/samuelcsantana/pyxis-api/commit/cc76650cf983239491c5f9981b8f56a1f95e0ce8))
* **queries:** count converting visits on the overview ([230ae0a](https://github.com/samuelcsantana/pyxis-api/commit/230ae0aadebe47b70f48ce1c7ae071530297ee32))
* **queries:** count converting visits per device, browser, system and country ([463e9da](https://github.com/samuelcsantana/pyxis-api/commit/463e9daec93905ea992485789500bf01953bc9db))
* **queries:** count converting visits per source ([2338218](https://github.com/samuelcsantana/pyxis-api/commit/23382184a34db7e73470d6caa604469592240792))
* **queries:** let a scope stop its last day at a local time of day ([83d9cc8](https://github.com/samuelcsantana/pyxis-api/commit/83d9cc8ced28aa197d7a8851e525dec586aeb323))
* **queries:** list visits from the raw events with Drizzle ([d1d3158](https://github.com/samuelcsantana/pyxis-api/commit/d1d3158346a5f931da920136390a90144ebebcef))
* **queries:** report failed reads per route with kind=reads ([ff94d8c](https://github.com/samuelcsantana/pyxis-api/commit/ff94d8c047fd05c030aee46f57e4ea10d3fc67fc))
* **queries:** serve the property breakdown on GET /features/properties ([4210f4d](https://github.com/samuelcsantana/pyxis-api/commit/4210f4d49b2fe14ab0371b5a17bfa636fdddaa89))
* **queries:** tell the local time a range that ends today stops at ([0104286](https://github.com/samuelcsantana/pyxis-api/commit/0104286ac8426067a33c29f66d2d30699e06f0c1))


### Bug Fixes

* **mail:** escape the code before it is written into the sign-in email's HTML ([39c96b9](https://github.com/samuelcsantana/pyxis-api/commit/39c96b968fff4e051e83704ca1002059957bad3f))


### Refactoring

* **queries:** define a failed request once, with the other definitions ([daeaad8](https://github.com/samuelcsantana/pyxis-api/commit/daeaad8f0918c6c0a7bb8f3159e86b311532a365))


### Documentation

* **adr:** record the comparison of an unfinished day ([21b6c9c](https://github.com/samuelcsantana/pyxis-api/commit/21b6c9ccce118ecf90cafd516188379e42cbe993))
* **readme:** describe the branded sign-in email ([0c6d51c](https://github.com/samuelcsantana/pyxis-api/commit/0c6d51cf6f8f937a47276b901829cc84aa4660df))
* **readme:** describe the failed reads on /requests ([bddee1e](https://github.com/samuelcsantana/pyxis-api/commit/bddee1efbc6b455f580fbf073d82df3d127e9dc7))
* **readme:** document the visits list ([780f7c2](https://github.com/samuelcsantana/pyxis-api/commit/780f7c20072ecd0a39209fa39ed7bb775de05ff9))
* **readme:** list the property breakdown route ([96c1f15](https://github.com/samuelcsantana/pyxis-api/commit/96c1f15c6cac38dfafd36de60f6121aa08f04c01))
* **readme:** name converting visits next to conversion events ([400bf63](https://github.com/samuelcsantana/pyxis-api/commit/400bf63829e8a2cc5cc99716f17c634bc9dd06ec))
* **readme:** record the load test through CloudFront ([3b565aa](https://github.com/samuelcsantana/pyxis-api/commit/3b565aa0387590e1209f5de6ce91edfa68b3a57a))
* **readme:** say that /v1/me tells when each project's events began and last arrived ([b73f0c0](https://github.com/samuelcsantana/pyxis-api/commit/b73f0c062016990b98335196acf00d9c83478840))

## [0.1.1](https://github.com/samuelcsantana/pyxis-api/compare/v0.1.0...v0.1.1) (2026-10-07)


### Documentation

* **readme:** document the load test script ([ca725ca](https://github.com/samuelcsantana/pyxis-api/commit/ca725caaeca4e2b30460f62d6ee21dc84e1d8599))

## 0.1.0 (2026-10-06)


### Features

* **cli:** add the project and key scripts ([47ed96d](https://github.com/samuelcsantana/pyxis-api/commit/47ed96de10d2c2c669435d392c931afd1a24eff5))
* **cli:** grant an admin access to a project ([5cb439a](https://github.com/samuelcsantana/pyxis-api/commit/5cb439aace36c9c1f8f4b840c66c9e33ec32c5cf))
* **config:** validate the database settings ([4982a10](https://github.com/samuelcsantana/pyxis-api/commit/4982a101de9378a0540a0ed864d06eeca52ec8cf))
* **contract:** add the batch ingestion schemas ([af362e4](https://github.com/samuelcsantana/pyxis-api/commit/af362e4c7d9cf459d1247337aea6ff00a0ee32d4))
* **database:** connect to postgres with drizzle and check the role at boot ([23a3dfb](https://github.com/samuelcsantana/pyxis-api/commit/23a3dfbd98144e5a31de2840a17d5abc4aa78b52))
* **database:** migrate as the owner and grant the app role row access ([cd0d699](https://github.com/samuelcsantana/pyxis-api/commit/cd0d6998adc1786ecfef8ee1090959286fc2bc13))
* delete events past thirteen months and expired sign-in data ([dcb5caf](https://github.com/samuelcsantana/pyxis-api/commit/dcb5cafc65849b0f448a3ffbe80ce9def188f096))
* **docs:** serve swagger and export the openapi 3.1 document ([b01dcf2](https://github.com/samuelcsantana/pyxis-api/commit/b01dcf26a418174f487b27a8b28f4bbfe3e548fe))
* **domain:** add the dashboard sign-in rules and ports ([6b10aa1](https://github.com/samuelcsantana/pyxis-api/commit/6b10aa1b76af02a74fbcfeded8cfa1a12ede1e5e))
* **domain:** add the ingestion errors, ports and event assembly ([24cc790](https://github.com/samuelcsantana/pyxis-api/commit/24cc790dbdf48a21fc8330cedaa559bcaf7a2f63))
* **domain:** add the PII barrier and server-side path templating ([d023512](https://github.com/samuelcsantana/pyxis-api/commit/d02351277868eb576335090f8bb6b534eb8df722))
* **domain:** add the project, key and tracked event entities ([df7bdaa](https://github.com/samuelcsantana/pyxis-api/commit/df7bdaaef3763616ba1420e9f4bbc7cd91072d5c))
* **domain:** date ranges of the dashboard queries ([effabda](https://github.com/samuelcsantana/pyxis-api/commit/effabda3d90c89c3590bc5580df16fb45d16ef38))
* **domain:** derive occurred_at, device, browser, os, channel and country ([d161af3](https://github.com/samuelcsantana/pyxis-api/commit/d161af3c9e73a3afdb522d53c7f6358c05705aa8))
* **domain:** generate project keys and hash secret keys ([876b732](https://github.com/samuelcsantana/pyxis-api/commit/876b732ae75476a1f9ab0f46106e32fa811daac0))
* **domain:** validate incoming events ([06736f4](https://github.com/samuelcsantana/pyxis-api/commit/06736f4935e153e1e8f2357a3e6761ab337fb669))
* **domain:** validate project settings ([6930df4](https://github.com/samuelcsantana/pyxis-api/commit/6930df4ef4e3b480da5e72dfc748cee86a97fda0))
* erase and export the events of a person ([680b277](https://github.com/samuelcsantana/pyxis-api/commit/680b2778fcfc56b4f766680a7a0c58d11e1653a9))
* **http:** add security headers and request ids to every response ([0f0a402](https://github.com/samuelcsantana/pyxis-api/commit/0f0a4027cec08f40c4624c09c7f0aeab4e332173))
* **http:** dashboard sign-in routes with a session cookie ([0ac0c6b](https://github.com/samuelcsantana/pyxis-api/commit/0ac0c6b13bfbcd2893e935bcea420003e8043ecb))
* **http:** log which client address sources arrive ([e4dbf9a](https://github.com/samuelcsantana/pyxis-api/commit/e4dbf9af5c9c6522f8c86fb941af16abd8913960))
* **http:** serve erasure and export to the site's backend ([fb10b28](https://github.com/samuelcsantana/pyxis-api/commit/fb10b2831c1dc3b809028c539866531d7a812a2a))
* **http:** serve POST /v1/batch ([c4be2e8](https://github.com/samuelcsantana/pyxis-api/commit/c4be2e824b57189be0ec420d5fbbb4a7b2648a1a))
* **http:** serve the features and the requests of a project ([d434f38](https://github.com/samuelcsantana/pyxis-api/commit/d434f38ac357743bcb48acec54da2351e874f877))
* **http:** serve the funnel of a project ([a6aa2b5](https://github.com/samuelcsantana/pyxis-api/commit/a6aa2b51c3ffe73daf05b5320b91879c81ff1b93))
* **http:** serve the project overview behind project access ([1a3eedf](https://github.com/samuelcsantana/pyxis-api/commit/1a3eedfb7b93810af61b910b68bee7905100bbd0))
* **http:** serve the timeline of a person or a visit ([12db916](https://github.com/samuelcsantana/pyxis-api/commit/12db916c214a1e02eb66364dfa5eeb8bd4f1f8b1))
* **infra:** alarm by email when the database passes 70% of its limit ([efee15f](https://github.com/samuelcsantana/pyxis-api/commit/efee15fac719da0911614efb444778673ca975b0))
* **infra:** find a project only when the admin was granted it ([6b5a8f6](https://github.com/samuelcsantana/pyxis-api/commit/6b5a8f69fd15298f45afc5a9df682204207e9a34))
* **infra:** send sign-in codes by email ([8ba4bcb](https://github.com/samuelcsantana/pyxis-api/commit/8ba4bcb1a80d42fdb707ba18a548ad6d666d9bf1))
* **infra:** store admins, their sessions and sign-in codes ([0bf5198](https://github.com/samuelcsantana/pyxis-api/commit/0bf5198689831b8c52f3e6d9bab68e7b45b15b8b))
* **infra:** store project settings and keys ([488abcd](https://github.com/samuelcsantana/pyxis-api/commit/488abcde027276f348cd12fd7d6ab7381653da66))
* **infra:** store projects, keys and events in Postgres ([3452bb7](https://github.com/samuelcsantana/pyxis-api/commit/3452bb7a958828c2df867ce65f9dd4a80577bac6))
* **infra:** the features and the requests in SQL ([6d40a67](https://github.com/samuelcsantana/pyxis-api/commit/6d40a673073269d7de2e9f270b61ce859b6d7d7f))
* **infra:** the funnel in SQL ([cafc54f](https://github.com/samuelcsantana/pyxis-api/commit/cafc54faa30a3dff48e918cb1e3e32013f9022d9))
* **infra:** the overview in SQL ([ab3329c](https://github.com/samuelcsantana/pyxis-api/commit/ab3329c5380eca22dc632f21637248b93de2a0fa))
* **infra:** the timeline in SQL ([374d93e](https://github.com/samuelcsantana/pyxis-api/commit/374d93ed6a4e6fb31a60f4326bec7f0551c49218))
* **lambda:** add the HTTP and migration handlers ([cd2b844](https://github.com/samuelcsantana/pyxis-api/commit/cd2b844bf6234fc0807f5e507f818edf78140f3a))
* **lambda:** run the retention from a daily jobs function ([af54952](https://github.com/samuelcsantana/pyxis-api/commit/af5495280a6abf14f957a0852304746195735def))
* **monitoring:** report the database size in the daily job ([64ceaea](https://github.com/samuelcsantana/pyxis-api/commit/64ceaeae847c5c9d6a62266cc5567fa217f10647))
* **usecases:** create projects, manage keys and update settings ([4fd7e75](https://github.com/samuelcsantana/pyxis-api/commit/4fd7e752c6b0c37d93274ebeaddda1c803c63cac))
* **usecases:** ingest a batch of events ([dff1d03](https://github.com/samuelcsantana/pyxis-api/commit/dff1d03d1b8fd476b410fb9231f797a8eae0dde5))
* **usecases:** sign admins in with an emailed code ([69ebe99](https://github.com/samuelcsantana/pyxis-api/commit/69ebe99706e8e3214c217e38a249c3bed855a7cf))
* **usecases:** the features and the requests of a project ([50c41ab](https://github.com/samuelcsantana/pyxis-api/commit/50c41abb0a4b7fa0fd412f10c8b37455860798ee))
* **usecases:** the funnel of a project ([17a34ed](https://github.com/samuelcsantana/pyxis-api/commit/17a34ed4d854cb72087dc008ffb09ae1504f4acb))
* **usecases:** the overview of a project ([bd8cb47](https://github.com/samuelcsantana/pyxis-api/commit/bd8cb4776b2cbfcf919654fe2c270b708391e674))
* **usecases:** the timeline of a person or a visit ([caccc72](https://github.com/samuelcsantana/pyxis-api/commit/caccc726c73221c637a7ba3dd00c5336d775a061))
* visits and conversions by device, browser, system and country ([a28b33e](https://github.com/samuelcsantana/pyxis-api/commit/a28b33e0a02edb8daad4355d356c3ecb03289409))
* visits per day and channel, and the sources that brought them ([8204667](https://github.com/samuelcsantana/pyxis-api/commit/8204667a09d6e75927517618daaaff1d2f6c47b9))


### Bug Fixes

* **auth:** let only one exchange use a sign-in code ([c283c76](https://github.com/samuelcsantana/pyxis-api/commit/c283c762b44bf25f1c9fb091685a74408190fd4c))
* **config:** require server-only settings only to start the server ([43ad81c](https://github.com/samuelcsantana/pyxis-api/commit/43ad81c0da2913eafa74f1771ade46cae38818e5))
* **domain:** give project keys their own pyxis_ prefixes ([ebdb0ac](https://github.com/samuelcsantana/pyxis-api/commit/ebdb0ac5e7a9b03849e9f0647935546e6732bde7))
* **infra:** keep the origin request policy comment within 128 characters ([55e2b56](https://github.com/samuelcsantana/pyxis-api/commit/55e2b56e4e207169bb016cbc20fe95eda3c2f667))


### Refactoring

* **http:** share one rate-limit module with named throttlers ([83a66ee](https://github.com/samuelcsantana/pyxis-api/commit/83a66ee13f1a6bef98147a183316908772ee4313))


### Documentation

* add community health files ([f9cc451](https://github.com/samuelcsantana/pyxis-api/commit/f9cc4519677a8a725deba068e5126f5f09af7efc))
* add the readme, the brand assets and the first adrs ([d60f0fa](https://github.com/samuelcsantana/pyxis-api/commit/d60f0fab3329d52d8d2f09e6c221d7e495343149))
* add the runbook and record ADR 0006 ([e3edd31](https://github.com/samuelcsantana/pyxis-api/commit/e3edd31e192770097f71e7be75dbff8184104d6c))
* describe the domain rules and the PII barrier ([7dec6bc](https://github.com/samuelcsantana/pyxis-api/commit/7dec6bcdd53f6ecd73bb24a5c023a499d0e0ec8c))
* document batch ingestion and record ADR 0005 ([7be22e5](https://github.com/samuelcsantana/pyxis-api/commit/7be22e5b12085865e6ed809d3c211657aa47f200))
* document dashboard sign-in and record ADR 0007 ([55292e0](https://github.com/samuelcsantana/pyxis-api/commit/55292e08982e387b51bb2dc9496db2e81e2ccee2))
* document erasure and export, and record ADR 0009 ([6951b35](https://github.com/samuelcsantana/pyxis-api/commit/6951b35e4ed214dc61a72a2d9452d601848bfd96))
* document the daily retention job ([98451ef](https://github.com/samuelcsantana/pyxis-api/commit/98451ef22a2af145b6f410aea26ad150388c9212))
* document the dashboard queries and record ADR 0008 ([7b3294f](https://github.com/samuelcsantana/pyxis-api/commit/7b3294fcaf703708cc1db795555cd1139d7769f2))
* document the database, the local stack and the coverage policy ([eda72f7](https://github.com/samuelcsantana/pyxis-api/commit/eda72f7c855ca0afa0add21ee93b73714f553374))
* document the features and requests queries ([52fe2be](https://github.com/samuelcsantana/pyxis-api/commit/52fe2be216f0854fa08729aeeba08471e461c7bc))
* document the funnel query ([322e238](https://github.com/samuelcsantana/pyxis-api/commit/322e238d7f43b2eaa654623880dada1d051b593e))
* document the project and key scripts ([cbc6dc9](https://github.com/samuelcsantana/pyxis-api/commit/cbc6dc96eb36da2df8104ac81b733a383ebc9e5f))
* document the timeline query ([deaecaa](https://github.com/samuelcsantana/pyxis-api/commit/deaecaae52b6cab16b1a34032fe83143ce7166be))
* **readme:** link the API reference and bring the status up to date ([2bb6647](https://github.com/samuelcsantana/pyxis-api/commit/2bb6647c5a3230de4ffe226bada5a4bfed22c085))
* **readme:** link the dashboard Storybook and the SDK playground ([f93dd15](https://github.com/samuelcsantana/pyxis-api/commit/f93dd1522216bce67693e2a24834f3d1dbb78de7))
* **readme:** mark the database size alarm on the roadmap ([28fc31d](https://github.com/samuelcsantana/pyxis-api/commit/28fc31dafe3351e4a328d64174d03332b21bbf72))

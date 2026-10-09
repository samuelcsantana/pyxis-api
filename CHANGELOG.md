# Changelog

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

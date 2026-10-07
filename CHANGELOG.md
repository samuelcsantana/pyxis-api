# Changelog

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

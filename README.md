<h1 align="center">Jellyfin Cast Web Receiver</h1>
<h3 align="center">Part of the <a href="https://jellyfin.org">Jellyfin Project</a></h3>

<p align="center">
<img alt="Logo Banner" src="https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-logo-solid.svg?sanitize=true"/>
<br/>
<br/>
<a href="https://github.com/jellyfin/jellyfin-chromecast">
<img alt="GPL 2.0 License" src="https://img.shields.io/github/license/jellyfin/jellyfin-chromecast.svg"/>
</a>
<a href="https://github.com/jellyfin/jellyfin-chromecast/releases">
<img alt="Current Release" src="https://img.shields.io/github/release/jellyfin/jellyfin-chromecast.svg"/>
</a>
</p>

The Jellyfin Cast Web Receiver is the frontend used when casting to a Google Cast capable device. It is used by default when casting from the Jellyfin Android app or Jellyfin web client.

### How do I use it?

A `stable` and `unstable` version of this app are already included in the Jellyfin server. There is no need to separately install this project. To host your own version (for developing) see `CONTRIBUTING.md`.

The `stable` version is the latest released version. `unstable` is updated automatically from the `master` branch.

### What does it do?

This is a `web receiver` as defined in the [Google Cast architecture](https://developers.google.com/cast/docs/overview).

As soon as you press the "cast" button on your client this application will start on you cast-capable device and handle playback functionality. 

### What doesn't it do?

Anything related to your non-cast device (e.g. your phone, browser, other device) or anything about the inclusion of casting for a specific client (e.g. casting from the iOS app).

Any issues/features related to that: check the respective repository.

### Something not working right?

First check if the issue is actually Google Cast related. So answer the question:

`"Can I reproduce the issue on any other way then when casting to a Google Cast capable device?"`

If yes: The issue probably lies somewhere else. 
If no: [Open an issue on GitHub](https://github.com/jellyfin/jellyfin-chromecast/issues/new/choose).

### Testing

Jellyfin allows switching between a `stable` and `unstable` version of the client. Go the client of your choice and: `user` -> `settings` -> `playback` -> `Google Cast version`.

Note that this setting is set per-user.

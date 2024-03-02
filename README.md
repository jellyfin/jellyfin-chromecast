<h1 align="center">Jellyfin Chromecast Web Receiver</h1>
<h3 align="center">Part of the <a href="https://jellyfin.org">Jellyfin Project</a></h3>

<p align="center">
<img alt="Logo Banner" src="https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-logo-solid.svg?sanitize=true"/>
<br/>
<br/>
<a href="https://github.com/jellyfin/jellyfin">
<img alt="GPL 2.0 License" src="https://img.shields.io/github/license/jellyfin/jellyfin-chromecast.svg"/>
</a>
<a href="https://github.com/jellyfin/jellyfin/releases">
<img alt="Current Release" src="https://img.shields.io/github/release/jellyfin/jellyfin-chromecast.svg"/>
</a>
</p>

Jellyfin Chromecast is a receiver app used when casting to a Google Cast capable device. It is used when casting from the Jellyfin Android client or Jellyfin web client.

### How do I use it?

A `stable` and `unstable` version of this app are already included in `jellyfin-server`. There is no need to seperately install this project. To host your own version (for developing) see `CONTRIBUTING.md`.

### What does it do?

This is a `web receiver` as defined in the [Google Chromecast architecture](https://developers.google.com/cast/docs/overview).

As soon as you push the "cast" button on your client this application will start on you cast-capable device & handle it from there. 

### What doesn't it do?

Anything related to your non-cast device (e.g. your phone, browser, other device) or anything about the inclusion of casting for a specific client (e.g. casting from the iOS app).

Any issues/features related to that: check the respective repository.

### Something not working right?
First check if the issue is actually Google Cast related. So answer the question:

`"Can I reproduce the issue on any other device than a Google Chromecast?"`

If yes: The issue probably lies somewhere else. 
If no: Open an <a href="https://github.com/jellyfin/jellyfin-chromecast/issues/new/choose">Issue</a> on GitHub.<br/>

### Testing

Jellyfin allows switching between a `stable` and `unstable` version of the client. Go the client of your choice and: `user` -> `settings` -> `playback` -> `Google Cast version`.

Note that this setting is set per-user.

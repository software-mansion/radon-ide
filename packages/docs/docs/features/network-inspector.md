---
id: network-inspector
title: Network Inspector
sidebar_position: 8
---

Radon IDE comes with a Network Inspector panel allowing you to inspect network traffic. The tool will capture and list all requests of `fetch` and `XMLHttpRequest` triggered by the JavaScript code. The panel works for both React Native CLI and Expo applications.

Images or websocket connections aren't currently supported and won't show up.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_network_inspector_new.mp4" type="video/mp4"/>
</video>

## Enabling the Network Inspector

To enable the Network Inspector tab, first click the Tools button located on the top-right corner of the IDE. Then, enable the toggle next to the Network label. A new `Network` tab will appear in your editor.

If you hide the Network panel, you can reopen it by using the Link icon next to the Network label.

<img width="300" src="/img/docs/ide_enable_network_inspector.png" className="shadow-image"/>

## Using the Network Inspector

You can access the Network tab from IDE by clicking the Link icon next to the Network label in the Tools menu.

You can customize the Network Inspector behaviour using the following buttons:

<img width="175" src="/img/docs/ide_network_inspector_buttons.png" className="shadow-image"/>

1. **Toggle network activity recording** - starts or stops the capture of network requests made by your application.
2. **Clear network log** - erases all currently displayed network requests displayed in a list.
3. **Filter domains** - allows you to show only the requests associated with the specified domain.

## Exploring network request details

<img width="700" src="/img/docs/ide_devtools_network_inspector.png" className="shadow-image" />

The Network Inspector displays a log of all network requests made by your application in a table. Each row represents a single request, and the columns provide key information about that request namely:

- **Name** - the segment of the path of the URL request.
- **Status** - a HTTP status code returned by the server.
- **Method** - a HTTP request method used (e.g. GET, POST, PUT, DELETE, etc.).
- **Type** - a MIME type of the requested resource. Currently, only `XHR` type is supported.
- **Size** - the total size of the transferred resource.
- **Time** - the total duration of the request.

Clicking on the network log shows more details about the contents of the request. The details of the request are grouped into into Headers, Payload, Response, and Timing tabs.

!(function (w, d) {
  if (!w.rdt) {
    var p = (w.rdt = function () {
      p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments);
    });
    p.callQueue = [];
    var t = d.createElement("script");
    (t.src = "https://www.redditstatic.com/ads/pixel.js"), (t.async = !0);
    var s = d.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(t, s);
  }
})(window, document);
rdt("init", "a2_h5mrjhcra8qw");
rdt("track", "PageVisit");

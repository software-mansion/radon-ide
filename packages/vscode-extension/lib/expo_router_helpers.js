function onRequestRouteChange({ router, pathname, params }) {
  router.navigate(pathname);
  router.setParams(params);
}

module.exports = {
  onRequestRouteChange,
};

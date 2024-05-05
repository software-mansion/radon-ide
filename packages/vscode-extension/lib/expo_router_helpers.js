function onRequestRouteChange({ router, pathname, params }) {
  // in order to close a modal (https://github.com/expo/expo/issues/26922#issuecomment-1996862878)
  router.dismissAll();
  setTimeout(() => {
    router.push(pathname, params);
  }, 0);
}

module.exports = {
  onRequestRouteChange,
};

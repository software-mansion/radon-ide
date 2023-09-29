require('expo-router/entry');
const { useContext, useEffect, useState } = require('react');
const { AppRegistry, RootTagContext, View } = require('react-native');
const { useRouter } = require('expo-router');
require('sztudio-original-entry-file');

global.rnsz_previews ||= new Map();

// window.__REACT_DEVTOOLS_PORT__
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

function PreviewAppWrapper({ children, ...rest }) {
  console.log("PreviewAppWrapper");
  const rootTag = useContext(RootTagContext);
  const [state, setState] = useState('loading');
  const { push } = useRouter();

  useEffect(() => {
    function _attachToDevtools(agent) {
      agent._bridge.addListener('rnp_openRouterLink', (payload) => {
        push(payload.href);
      });
      agent._bridge.addListener('rnp_listPreviews', () => {
        agent._bridge.send('rnp_previewsList', {
          previews: [...global.rnsz_previews.values()],
        });
      });
      agent._bridge.addListener('rnp_runApplication', (payload) => {
        AppRegistry.runApplication(payload.appKey, {
          rootTag,
          initialProps: {},
        });
      });
    }

    if (hook.reactDevtoolsAgent) {
      _attachToDevtools(hook.reactDevtoolsAgent);
    } else {
      hook.on('react-devtools', _attachToDevtools);
    }
  }, []);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={() => {
        console.log('READY', rest);
      }}>
      {children}
    </View>
  );
}

AppRegistry.setWrapperComponentProvider((appParameters) => {
  console.log('Hey!', appParameters);
  return PreviewAppWrapper;
});

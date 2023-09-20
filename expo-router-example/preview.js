import 'expo-router/entry';
import { useContext, useEffect, useState } from 'react';
import { AppRegistry, RootTagContext, View, Text } from 'react-native';
import { useRouter } from 'expo-router';

// window.__REACT_DEVTOOLS_PORT__
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

const previews = new Map();

function stringifyProps(obj) {
  const keyValuePairs = [];

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      keyValuePairs.push(`${key}=${obj[key]}`);
    }
  }

  return keyValuePairs.join(' ');
}

export function preview(component) {
  const name = `preview:/${component._source.fileName}:${component._source.lineNumber}`;
  console.log('Comp', Object.keys(component), component.props);
  function Preview() {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {component}
      </View>
    );
  }
  previews.set(name, {
    appKey: name,
    name: component.type.name,
    props: stringifyProps(component.props),
    fileName: component._source.fileName,
    lineNumber: component._source.lineNumber,
  });
  AppRegistry.registerComponent(name, () => Preview);
}

function PreviewAppWrapper({ children, ...rest }) {
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
          previews: [...previews.values()],
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

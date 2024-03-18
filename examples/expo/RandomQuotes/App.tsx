import 'react-native-gesture-handler'
import { Colors } from './src/Constants'
import ApplicationNavigator from './src/Navigators/Application'
import { persistor, store } from './src/Stores'
import React from 'react'
import Toast from 'react-native-toast-message'
import { Provider } from 'react-redux'
import { MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper'
import { PersistGate } from 'redux-persist/integration/react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { StatusBar, StyleSheet, View } from 'react-native'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: 'always', retry: false },
    mutations: {},
  },
})

const theme = {
  ...DefaultTheme,
  // Specify custom property in nested object
  colors: {
    ...DefaultTheme.colors,
  },
}

const App = () => (
  <>
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <PersistGate persistor={persistor} loading={null}>
          <QueryClientProvider client={queryClient}>
            <View style={styles.container}>
              <StatusBar barStyle={'dark-content'} backgroundColor={Colors.white} />
              <ApplicationNavigator />
              <Toast />
            </View>
          </QueryClientProvider>
        </PersistGate>
      </PaperProvider>
    </Provider>
  </>
)

export default App

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF4FF',
  },
})

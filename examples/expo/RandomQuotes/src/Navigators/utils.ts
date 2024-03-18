/**
 * Used to navigating without the navigation prop
 * @see https://reactnavigation.org/docs/navigating-without-navigation-prop/
 *
 * You can add other navigation functions that you need and export them
 */
import { CommonActions, createNavigationContainerRef } from '@react-navigation/native'

type RootStackParamList = {
  Splash: undefined
  Login: undefined
  DetailScreen: any
}

export const navigationRef = createNavigationContainerRef<RootStackParamList>()

export function navigate<RouteName extends keyof RootStackParamList>(
  options: RouteName extends unknown
    ?
        | {
            key: string
            params?: RootStackParamList[RouteName]
            merge?: boolean
          }
        | {
            name: RouteName
            key?: string
            params: RootStackParamList[RouteName]
            merge?: boolean
          }
    : never
) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(options)
  }
}

export function navigateAndReset(routes = [], index = 0) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index,
        routes,
      })
    )
  }
}

export function navigateAndSimpleReset(name: string, index = 0) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index,
        routes: [{ name }],
      })
    )
  }
}

export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack()
  }
}

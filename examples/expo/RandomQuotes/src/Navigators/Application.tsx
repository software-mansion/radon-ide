import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationRef } from './utils'
import { MainBottomNavigation } from './MainBottomNavigation'

const Stack = createStackNavigator()

const ApplicationNavigator = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <MainBottomNavigation />
      {/* <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name={'QuoteByAuthorScreen'} component={QuoteByAuthorScreen} />
      </Stack.Navigator> */}
    </NavigationContainer>
  )
}

export default ApplicationNavigator

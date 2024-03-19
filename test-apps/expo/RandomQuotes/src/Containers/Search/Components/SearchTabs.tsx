import React from 'react'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { AuthorList } from './AuthorList'
import { TagsList } from './TagsList'

const Tab = createMaterialTopTabNavigator()

export const MyTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#265CDF',
        tabBarLabelStyle: {
          textTransform: 'capitalize',
          fontSize: 16,
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
        },
        tabBarItemStyle: {},
      }}
    >
      <Tab.Screen name='Authors' component={AuthorList} options={{}} />
      <Tab.Screen name='Tags' component={TagsList} />
    </Tab.Navigator>
  )
}

import { StyleSheet, View, ActivityIndicator } from 'react-native'
import React from 'react'
import { Colors } from '../Constants'

type Props = {}

const LoadingView = (props: Props) => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignContent: 'center',
      }}
    >
      <ActivityIndicator size='large' color={Colors.blue} />
    </View>
  )
}

export default LoadingView

const styles = StyleSheet.create({})

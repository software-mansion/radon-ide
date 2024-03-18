import { StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native'
import React from 'react'
import Icon from 'react-native-vector-icons/Ionicons'
import { goBack } from '../Navigators/utils'
import { Text } from 'react-native'
import { Fonts } from '../Constants'

type Props = {
  title: string
  containerStyle?: ViewStyle
  titleStyle?: TextStyle
  showBorderBottom?: boolean
}

const HeaderNormal = ({ title, containerStyle, titleStyle, showBorderBottom = true }: Props) => {
  return (
    <View
      style={{
        ...styles.view,
        ...containerStyle,
        borderBottomWidth: showBorderBottom ? 0.5 : 0,
        borderBottomColor: '#999',
      }}
    >
      <TouchableOpacity
        onPress={() => {
          goBack()
        }}
      >
        <Icon name='arrow-back-outline' size={22} color={'#000'} />
      </TouchableOpacity>
      <Text style={{ ...styles.text, ...titleStyle }}>{title}</Text>
      <TouchableOpacity disabled={true}>
        <Icon name='arrow-back-outline' size={22} color={'transparent'} />
      </TouchableOpacity>
    </View>
  )
}

export default HeaderNormal

const styles = StyleSheet.create({
  view: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    height: 50,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    fontFamily: Fonts.BeVietnamProMedium,
  },
})
